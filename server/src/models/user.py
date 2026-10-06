import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class User(Base):
    # "user" is a reserved word in Postgres - `SELECT ... FROM user` returns the
    # session user, not the table. Pluralised to avoid needing quotes forever.
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Not unique: people share names.
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Stored lower-cased so lookups are case-insensitive without a functional
    # index; the uniqueness constraint then actually means what it looks like.
    email: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False
    )
    # Nullable: accounts created through Google sign-in have no password.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
