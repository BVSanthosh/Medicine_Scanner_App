"""Barcode decoding.

Backed by `biip`, which implements the GS1 General Specifications properly:
FNC1-separated element strings, fixed-length AIs that need no separator, GTIN
check digits, and the "day 00 means end of month" expiry rule. Hand-rolling an
AI table is exactly the kind of thing that looks fine until a pack encodes an
AI you did not anticipate and every field after it shifts.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from biip import ParseError, parse

log = logging.getLogger("api.barcode")

# Some scanners prepend a symbology identifier.
_SYMBOLOGY_PREFIX = re.compile(r"^\](?:C1|e0|d2|Q3|J1)")
# One element of the human-readable form, e.g. "(10)ABC-123".
_HRI_ELEMENT = re.compile(r"\((\d{2,4})\)([^(]*)")

# FNC1, which GS1 scanners transmit as the ASCII group separator.
GS = "\x1d"

# GS1 Application Identifiers we care about on a medicine pack.
AI_GTIN = "01"
AI_BATCH = "10"
AI_PRODUCTION_DATE = "11"
AI_BEST_BEFORE = "15"
AI_EXPIRY = "17"
AI_SERIAL = "21"


@dataclass(slots=True)
class DecodedBarcode:
    raw: str
    gtin: str = ""
    batch_number: str = ""
    # Formatted for display: "MM/YYYY" when the pack only pins down the month,
    # "DD/MM/YYYY" when it gives a day.
    exp_date: str = ""
    mfd_date: str = ""
    serial: str = ""
    element_strings: dict[str, str] = field(default_factory=dict)

    @property
    def has_gs1_data(self) -> bool:
        return bool(self.element_strings)


def _normalise_payload(raw: str) -> str:
    """Converts the human-readable bracketed form to the transmission form.

    The brackets are not decoration - they are what terminates a variable-length
    AI. Simply deleting them turns "(10)B42(17)270930" into "10B4217270930", and
    since AI 10 runs to the next separator the batch number swallows the expiry.
    Each element is therefore rejoined with an explicit FNC1 instead.

    A redundant separator after a fixed-length AI is legal and parsers accept it,
    so inserting one between every element is always safe.
    """
    value = _SYMBOLOGY_PREFIX.sub("", raw.strip())

    elements = _HRI_ELEMENT.findall(value)
    if elements:
        return GS.join(f"{ai}{val.strip()}" for ai, val in elements)

    return value


def _format_gs1_date(element_value: str, parsed_date) -> str:
    """GS1 dates are YYMMDD with day 00 meaning "end of this month".

    We format from the *raw* digits rather than the resolved date so a
    month-only expiry is not silently presented as a specific day.
    """
    if parsed_date is None:
        return ""
    if len(element_value) >= 6 and element_value[4:6] == "00":
        return f"{parsed_date.month:02d}/{parsed_date.year}"
    return f"{parsed_date.day:02d}/{parsed_date.month:02d}/{parsed_date.year}"


def decode(raw: str) -> DecodedBarcode:
    """Decodes a scanned payload. Never raises - an unparseable payload simply
    comes back with empty fields, which the caller reports as unverifiable."""
    result = DecodedBarcode(raw=raw)
    payload = _normalise_payload(raw)
    if not payload:
        return result

    try:
        parsed = parse(payload)
    except (ParseError, ValueError) as exc:
        log.info("barcode payload not parseable", extra={"error": str(exc)})
        return result

    # A bare product code (EAN-13/UPC) carries only a GTIN - no batch, no
    # expiry. biip validates the check digit as part of parsing it.
    if parsed.gtin is not None:
        result.gtin = parsed.gtin.as_gtin_14()

    message = parsed.gs1_message
    if message is None:
        return result

    for element in message.element_strings:
        ai = element.ai.ai
        result.element_strings[ai] = element.value or ""

        if ai == AI_GTIN and element.value:
            # The AI form is already 14 digits.
            result.gtin = element.value
        elif ai == AI_BATCH:
            result.batch_number = element.value or ""
        elif ai == AI_SERIAL:
            result.serial = element.value or ""
        elif ai in (AI_EXPIRY, AI_BEST_BEFORE):
            # 17 is the real expiry; 15 (best before) is the fallback.
            if ai == AI_EXPIRY or not result.exp_date:
                result.exp_date = _format_gs1_date(element.value or "", element.date)
        elif ai == AI_PRODUCTION_DATE:
            result.mfd_date = _format_gs1_date(element.value or "", element.date)

    return result
