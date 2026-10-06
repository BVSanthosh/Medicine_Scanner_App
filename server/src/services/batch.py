"""Batch number normalisation.

`B.NO.`, `BATCH NO:` and `LOT` are *labels* printed next to the code, not part
of it. OCR extraction strips them; a user typing the same pack by hand does not.
Normalising in one place, server-side, is what makes those two paths agree - and
it is why this cannot live on the client.
"""

import re

# The label must be followed by a separator or whitespace. Without that anchor a
# genuine batch called "LOT9" is mangled into "9".
_LABEL = re.compile(
    r"^(?:b\.?\s*no|batch(?:\s*(?:no|number))?|lot(?:\s*no)?)\s*(?:[.:\-]\s*|\s+)",
    re.IGNORECASE,
)

# Batch codes are alphanumeric with dashes and slashes. Anything else is OCR
# noise (stray punctuation, box-drawing artefacts) and is dropped.
_DISALLOWED = re.compile(r"[^A-Z0-9\-/]")

MAX_BATCH_LENGTH = 64


def normalise_batch_number(raw: str) -> str:
    """Returns the bare batch code, upper-cased. "" when nothing usable remains."""
    if not raw:
        return ""

    value = raw.strip()
    # Twice: OCR sometimes yields "LOT B.NO. 49302".
    for _ in range(2):
        stripped = _LABEL.sub("", value).strip()
        if stripped == value:
            break
        value = stripped

    value = _DISALLOWED.sub("", value.upper())
    return value[:MAX_BATCH_LENGTH]
