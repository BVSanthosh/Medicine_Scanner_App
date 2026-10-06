"""The catalogue and the register.

The original single `medicine` table conflated two different things:

  * a **product** - "Panadol, paracetamol, 500mg", identified by its GTIN, one
    row for millions of packs;
  * a **batch** - a specific production run of that product, identified by the
    batch number printed on the pack, which is what actually gets flagged as
    counterfeit.

Keeping them in one table means you cannot record two batches of the same
medicine without duplicating the product details, and you cannot flag a batch
whose product you have never seen. They are split here.
"""

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base


class BatchStatus(StrEnum):
    """Only the two verdicts the register can actually assert.

    "unknown" is deliberately absent: it is the *absence* of a row, not a state
    anyone records.
    """

    SAFE = "safe"
    UNSAFE = "unsafe"


class Product(Base):
    """A medicine as sold, keyed by GTIN."""

    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # GTIN-14, zero-padded. 14 chars exactly, so a GTIN-13 and its padded form
    # can never both be stored as separate products.
    gtin: Mapped[str] = mapped_column(String(14), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    salt: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    dose: Mapped[str] = mapped_column(String(64), default="", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    batches: Mapped[list["Batch"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class Batch(Base):
    """A production run, keyed by the batch number printed on the pack."""

    __tablename__ = "batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Stored normalised (label stripped, upper-cased) so a pack typed by hand as
    # "B.NO. 49302" resolves to the same row as the same pack scanned.
    batch_number: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    # Nullable: a batch can be flagged as counterfeit before anyone knows which
    # genuine product it is impersonating.
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[BatchStatus] = mapped_column(
        Enum(
            BatchStatus,
            name="batch_status",
            native_enum=False,
            length=16,
            # Store the VALUE ("safe"), not the member NAME ("SAFE"), which
            # is what SQLAlchemy does by default. Without this the database
            # disagrees with the JSON the API emits, and anyone writing SQL
            # or importing data has to know about the mismatch.
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
            # Emits a CHECK constraint, so the database itself rejects a
            # value outside the enum.
            create_constraint=True,
        ),
        nullable=False,
    )

    # Real dates, not strings: an expiry you cannot compare is not much use, and
    # this is what lets "expired" become a verdict later.
    mfd_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    exp_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    product: Mapped[Product | None] = relationship(back_populates="batches")
