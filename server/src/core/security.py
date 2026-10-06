"""Password hashing and JWT issuing/verification."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from .config import env

# Argon2id is the current password-hashing recommendation (OWASP). The library
# defaults are sensible; they encode cost parameters into the hash string, so
# raising them later does not invalidate existing hashes.
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True when the hash was made with weaker parameters than we now use."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired or not ours."""


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """Returns ``(token, expires_in_seconds)``.

    ``jti`` is included so individual tokens can be revoked later without
    changing the signing key and logging everyone out.
    """
    now = datetime.now(UTC)
    ttl = timedelta(minutes=env.ACCESS_TOKEN_TTL_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "jti": str(uuid.uuid4()),
        "typ": "access",
    }
    token = jwt.encode(payload, env.SECRET_KEY, algorithm=env.JWT_ALGORITHM)
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> uuid.UUID:
    """Returns the subject, or raises ``TokenError``.

    ``algorithms`` is pinned to our own algorithm on purpose: accepting whatever
    the token's header claims is the classic JWT confusion vulnerability.
    """
    try:
        payload = jwt.decode(
            token,
            env.SECRET_KEY,
            algorithms=[env.JWT_ALGORITHM],
            options={"require": ["exp", "sub", "iat"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("typ") != "access":
        raise TokenError("Not an access token.")

    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise TokenError("Token subject is not a valid user id.") from exc
