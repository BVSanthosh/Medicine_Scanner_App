"""Scan endpoints.

Each is a POST that takes raw input and returns the fields *and* the verdict in
one response. The client holds no extraction or verification logic.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query, Request, status
from sqlalchemy import select

from ..core.config import env
from ..deps import CurrentUser, DbSession
from ..models.scan import Scan
from ..rate_limit import limiter
from ..schemas.scan_schema import (
    BarcodeScanRequest,
    ManualEntryRequest,
    MedicineFields,
    MedicineResult,
    ScanHistoryEntry,
    TextScanRequest,
)
from ..services import barcode as barcode_service
from ..services import extraction, verification
from ..services.verification import VerificationInput

log = logging.getLogger("api.scan")

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("/text", response_model=MedicineResult, status_code=status.HTTP_200_OK)
@limiter.limit(env.RATE_LIMIT_SCAN)
async def verify_text_scan(
    request: Request,  # required by slowapi to identify the caller
    body: TextScanRequest,
    db: DbSession,
    user: CurrentUser,
) -> MedicineResult:
    """OCR path: extract the fields with the LLM, then check the register.

    Both steps happen in this one call so the device makes a single round trip.
    """
    fields = await extraction.extract_fields(body.raw_text)

    result = await verification.verify(
        db, VerificationInput(fields=fields, raw_input=body.raw_text)
    )
    await verification.record_scan(
        db,
        user_id=user.id,
        method=body.method,
        result=result,
        location=body.location,
        raw_input=body.raw_text,
    )
    return result


@router.post("/barcode", response_model=MedicineResult)
@limiter.limit(env.RATE_LIMIT_SCAN)
async def verify_barcode_scan(
    request: Request,
    body: BarcodeScanRequest,
    db: DbSession,
    user: CurrentUser,
) -> MedicineResult:
    """Barcode path: decode the payload, then check the register. No LLM.

    The payload arrives undecoded on purpose - see ``BarcodeScanRequest``.
    """
    decoded = barcode_service.decode(body.raw)

    result = await verification.verify(
        db,
        VerificationInput(
            fields=MedicineFields(
                batch_number=decoded.batch_number,
                exp_date=decoded.exp_date,
                mfd_date=decoded.mfd_date,
            ),
            gtin=decoded.gtin,
            serial=decoded.serial,
            raw_input=body.raw,
        ),
    )
    await verification.record_scan(
        db,
        user_id=user.id,
        method=body.method,
        result=result,
        location=body.location,
        raw_input=body.raw,
    )
    return result


@router.post("/manual", response_model=MedicineResult)
@limiter.limit(env.RATE_LIMIT_SCAN)
async def verify_manual_entry(
    request: Request,
    body: ManualEntryRequest,
    db: DbSession,
    user: CurrentUser,
) -> MedicineResult:
    """Typed or corrected details. Nothing to extract, only to look up."""
    result = await verification.verify(
        db,
        VerificationInput(fields=body.fields, gtin=body.gtin, serial=body.serial),
    )
    await verification.record_scan(
        db,
        user_id=user.id,
        method=body.method,
        result=result,
        location=body.location,
        raw_input=None,
    )
    return result


@router.get("", response_model=list[ScanHistoryEntry])
async def scan_history(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[ScanHistoryEntry]:
    """The signed-in user's scans, newest first.

    The user comes from the bearer token, never from the URL. Paginated because
    an unbounded list grows without limit and eventually times out the request.
    """
    rows = (
        await db.scalars(
            select(Scan)
            .where(Scan.user_id == user.id)
            .order_by(Scan.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return [
        ScanHistoryEntry(
            id=str(row.id),
            name=row.medicine_name or "Unknown medicine",
            dose=row.dose,
            batch_number=row.batch_number,
            scanned_at=row.created_at,
            status=row.status,
        )
        for row in rows
    ]
