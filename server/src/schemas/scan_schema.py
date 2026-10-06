"""Request and response shapes for the three scan endpoints.

All three return the same ``MedicineResult``. That is the point of the design:
the client makes one call and gets the fields *and* the verdict together.
"""

from datetime import datetime
from typing import Literal

from pydantic import Field

from ..models.scan import ScanMethod, VerificationStatus
from .common import CamelModel, Coordinates

# Bounds chosen to reject obvious abuse without rejecting real packs. The OCR
# text from one cropped frame is a few hundred characters; 20k is generous.
MAX_RAW_TEXT = 20_000
MAX_BARCODE_PAYLOAD = 4_096


class MedicineFields(CamelModel):
    """Mirrors `MedicineFields` in the client exactly.

    Every field defaults to "" rather than being optional, so the client never
    has to null-check. An absent value and an empty value are the same thing
    here: "we do not know".
    """

    name: str = ""
    salt: str = ""
    batch_number: str = ""
    mfd_date: str = ""
    exp_date: str = ""
    dose: str = ""


class MedicineResult(CamelModel):
    """The single response shape for every scan endpoint."""

    fields: MedicineFields
    status: VerificationStatus
    # Rendered verbatim on the result screen. Server-authored so the wording can
    # change without shipping an app update.
    title: str
    message: str
    gtin: str = ""
    serial: str = ""


class TextScanRequest(CamelModel):
    """OCR path: the client sends recognised text, the server does the rest."""

    raw_text: str = Field(min_length=1, max_length=MAX_RAW_TEXT)
    location: Coordinates | None = None
    method: Literal[ScanMethod.OCR, ScanMethod.OCR_CORRECTED] = ScanMethod.OCR


class BarcodeScanRequest(CamelModel):
    """Barcode path: the payload arrives undecoded, on purpose.

    The client decodes a copy for its on-screen hint, but the verdict is only
    trustworthy if the server derives the batch number itself - otherwise a
    modified client can name any batch it likes and be told it is safe.
    """

    raw: str = Field(min_length=1, max_length=MAX_BARCODE_PAYLOAD)
    symbology: str = Field(default="", max_length=64)
    location: Coordinates | None = None
    method: Literal[ScanMethod.BARCODE] = ScanMethod.BARCODE


class ManualEntryRequest(CamelModel):
    """Typed or corrected details. Nothing to extract, only to look up."""

    fields: MedicineFields
    gtin: str = Field(default="", max_length=14)
    serial: str = Field(default="", max_length=64)
    location: Coordinates | None = None
    method: Literal[
        ScanMethod.MANUAL,
        ScanMethod.OCR_CORRECTED,
        ScanMethod.BARCODE_CORRECTED,
    ] = ScanMethod.MANUAL


class ScanHistoryEntry(CamelModel):
    """One row of the history list."""

    id: str
    name: str
    dose: str = ""
    batch_number: str
    scanned_at: datetime
    status: VerificationStatus
