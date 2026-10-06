"""The one place a verdict is decided.

All three scan endpoints funnel through :func:`verify`. Having a single
implementation is what guarantees a pack scanned by barcode, read by OCR and
typed by hand all reach the same answer - and it means the verdict wording
lives in exactly one file.

Deliberately *not* on the client: a verdict the device computes is a verdict the
device can forge.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.medicine import Batch, BatchStatus, Product
from ..models.scan import Scan, ScanMethod, VerificationStatus
from ..schemas.common import Coordinates
from ..schemas.scan_schema import MedicineFields, MedicineResult
from .batch import normalise_batch_number


@dataclass(slots=True)
class VerificationInput:
    fields: MedicineFields
    gtin: str = ""
    serial: str = ""
    raw_input: str | None = None


def _format_date(value: date | None) -> str:
    return f"{value.day:02d}/{value.month:02d}/{value.year}" if value else ""


def _result(
    fields: MedicineFields,
    status: VerificationStatus,
    title: str,
    message: str,
    gtin: str,
    serial: str,
) -> MedicineResult:
    return MedicineResult(
        fields=fields,
        status=status,
        title=title,
        message=message,
        gtin=gtin,
        serial=serial,
    )


async def _find_product(db: AsyncSession, gtin: str) -> Product | None:
    if not gtin:
        return None
    return await db.scalar(select(Product).where(Product.gtin == gtin))


async def _find_batch(db: AsyncSession, batch_number: str) -> Batch | None:
    if not batch_number:
        return None
    return await db.scalar(
        select(Batch)
        .where(Batch.batch_number == batch_number)
        # Eager-load the product. Touching `batch.product` on a lazily loaded
        # relationship triggers implicit IO, which asyncio SQLAlchemy cannot do
        # outside its greenlet context - it raises MissingGreenlet at runtime.
        # Loading it up front also turns two round trips into one.
        .options(selectinload(Batch.product))
    )


async def verify(db: AsyncSession, data: VerificationInput) -> MedicineResult:
    """Resolves the input against the catalogue and the register."""
    batch_number = normalise_batch_number(data.fields.batch_number)
    gtin = data.gtin.strip()

    # --- nothing to check against -------------------------------------
    # Not a verdict on the medicine: the input was incomplete. The client keys
    # off an empty batchNumber to send the user to the manual entry form, so we
    # return whatever product details we do have to pre-fill it.
    if not batch_number:
        product = await _find_product(db, gtin)
        fields = data.fields.model_copy(update={"batch_number": ""})
        if product:
            fields = fields.model_copy(
                update={
                    "name": product.name,
                    "salt": product.salt,
                    "dose": product.dose or fields.dose,
                }
            )
            message = (
                f"We identified this as {product.name}, but no batch number was "
                "captured. Add the batch number printed on the pack to check it "
                "against the register."
            )
        else:
            message = (
                "No batch number was captured, so this pack could not be checked "
                "against the register. Add the details printed on the pack."
            )
        return _result(
            fields,
            VerificationStatus.UNKNOWN,
            "Not enough to verify",
            message,
            gtin,
            data.serial,
        )

    batch = await _find_batch(db, batch_number)

    # The register is authoritative for product details, so its record wins over
    # whatever was read off the pack - OCR misreads a name far more often than
    # the database is wrong.
    product = batch.product if batch and batch.product else await _find_product(db, gtin)

    fields = data.fields.model_copy(update={"batch_number": batch_number})
    if product:
        fields = fields.model_copy(
            update={
                "name": product.name,
                "salt": product.salt,
                "dose": product.dose or fields.dose,
            }
        )
    if batch:
        fields = fields.model_copy(
            update={
                "mfd_date": _format_date(batch.mfd_date) or fields.mfd_date,
                "exp_date": _format_date(batch.exp_date) or fields.exp_date,
            }
        )

    resolved_gtin = product.gtin if product else gtin

    # --- batch not on file --------------------------------------------
    if batch is None:
        return _result(
            fields,
            VerificationStatus.UNKNOWN,
            "Not on file",
            "This batch number was not found in the manufacturer's register. "
            "That does not prove it is counterfeit, but check the pack with your "
            "pharmacist before taking it.",
            resolved_gtin,
            data.serial,
        )

    # --- flagged -------------------------------------------------------
    if batch.status is BatchStatus.UNSAFE:
        return _result(
            fields,
            VerificationStatus.UNSAFE,
            "Do not consume",
            "This batch has been flagged in the counterfeit register. Do not "
            "take this medicine - report it to your pharmacist.",
            resolved_gtin,
            data.serial,
        )

    # --- genuine -------------------------------------------------------
    return _result(
        fields,
        VerificationStatus.SAFE,
        "Safe for consumption",
        "This batch matches an authentic record in the manufacturer's register.",
        resolved_gtin,
        data.serial,
    )


async def record_scan(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    method: ScanMethod,
    result: MedicineResult,
    location: Coordinates | None,
    raw_input: str | None,
) -> Scan:
    """Appends the verdict to the user's history.

    Stores a snapshot rather than a link to the batch: if the register flags
    that batch next month, this row must still say what the user was told today.
    """
    scan = Scan(
        user_id=user_id,
        method=method,
        status=result.status,
        medicine_name=result.fields.name,
        salt=result.fields.salt,
        batch_number=result.fields.batch_number,
        mfd_date=result.fields.mfd_date,
        exp_date=result.fields.exp_date,
        dose=result.fields.dose,
        gtin=result.gtin,
        serial=result.serial,
        latitude=location.latitude if location else None,
        longitude=location.longitude if location else None,
        raw_input=raw_input,
    )
    db.add(scan)
    # Flush rather than commit: the session dependency owns the transaction, so
    # the scan and anything else in this request commit or roll back together.
    await db.flush()
    return scan
