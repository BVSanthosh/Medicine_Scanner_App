"""Scan history.

Each row is an immutable record of one verification: what was submitted, what
the register said at that moment, and where it happened. It stores a *snapshot*
of the resolved fields rather than only a foreign key to the batch, because the
register can change - a batch flagged next month should not silently rewrite
what the user was told today.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class ScanMethod(StrEnum):
    BARCODE = "barcode"
    BARCODE_CORRECTED = "barcode_corrected"
    OCR = "ocr"
    OCR_CORRECTED = "ocr_corrected"
    MANUAL = "manual"


class VerificationStatus(StrEnum):
    SAFE = "safe"
    UNSAFE = "unsafe"
    UNKNOWN = "unknown"


class Scan(Base):
    __tablename__ = "scans"
    __table_args__ = (
        # History is always read as "this user's scans, newest first". A
        # composite index on exactly that serves the query without a sort.
        Index("ix_scans_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    method: Mapped[ScanMethod] = mapped_column(
        Enum(
            ScanMethod,
            name="scan_method",
            native_enum=False,
            length=32,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
            create_constraint=True,
        ),
        nullable=False,
    )
    status: Mapped[VerificationStatus] = mapped_column(
        Enum(
            VerificationStatus,
            name="verification_status",
            native_enum=False,
            length=16,
            # See the note on Batch.status: store values, not member names.
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
            create_constraint=True,
        ),
        nullable=False,
    )

    # Snapshot of what was shown to the user.
    medicine_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    salt: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    batch_number: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    mfd_date: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    exp_date: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    dose: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    gtin: Mapped[str] = mapped_column(String(14), default="", nullable=False)
    serial: Mapped[str] = mapped_column(String(64), default="", nullable=False)

    # Where the pack was scanned, for counterfeit hotspot reporting. Nullable:
    # location permission is optional and refusing it must not block a scan.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Exactly what the device submitted. Kept for auditing a disputed verdict
    # and for re-running extraction offline when the parser improves.
    raw_input: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
