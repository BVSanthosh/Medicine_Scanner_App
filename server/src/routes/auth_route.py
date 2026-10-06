"""Authentication endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..core.config import env
from ..core.errors import AppError
from ..core.security import (
    create_access_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from ..deps import CurrentUser, DbSession
from ..models.user import User
from ..rate_limit import limiter
from ..schemas.auth_schema import (
    AuthResponse,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    UserOut,
)

log = logging.getLogger("api.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


def _session_for(user: User) -> AuthResponse:
    token, expires_in = create_access_token(user.id)
    return AuthResponse(
        token=token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.post(
    "/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit(env.RATE_LIMIT_AUTH)
async def register(
    request: Request, body: RegisterRequest, db: DbSession
) -> AuthResponse:
    email = body.email.lower()

    user = User(
        name=body.name,
        email=email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    try:
        # Flush now so the unique-email violation surfaces here, where we can
        # turn it into a clean 409, rather than at commit time inside the
        # session dependency where it would become a 500.
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError(
            "An account with that email already exists.", status.HTTP_409_CONFLICT
        ) from exc

    log.info("user registered", extra={"user_id": str(user.id)})
    return _session_for(user)


@router.post("/login", response_model=AuthResponse)
@limiter.limit(env.RATE_LIMIT_AUTH)
async def login(request: Request, body: LoginRequest, db: DbSession) -> AuthResponse:
    user = await db.scalar(select(User).where(User.email == body.email.lower()))

    # One message and one code for "no such account" and "wrong password".
    # Distinguishing them turns the endpoint into an account enumeration oracle.
    if user is None or not user.password_hash:
        # Hash anyway so a missing account does not return measurably faster
        # than a wrong password.
        hash_password(body.password)
        raise AppError("Incorrect email or password.", status.HTTP_401_UNAUTHORIZED)

    if not verify_password(body.password, user.password_hash):
        raise AppError("Incorrect email or password.", status.HTTP_401_UNAUTHORIZED)

    # Transparently upgrade the stored hash when the cost parameters change.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)

    log.info("user logged in", extra={"user_id": str(user.id)})
    return _session_for(user)


@router.post("/google", response_model=AuthResponse)
@limiter.limit(env.RATE_LIMIT_AUTH)
async def google_login(
    request: Request, body: GoogleLoginRequest, db: DbSession
) -> AuthResponse:
    """Exchanges a Google ID token for one of ours.

    The token is verified against Google's published keys - never trusted
    because the client sent it, and never decoded without signature checking.
    """
    if not env.GOOGLE_CLIENT_ID:
        raise AppError(
            "Google sign-in is not configured on this server.",
            status.HTTP_501_NOT_IMPLEMENTED,
        )

    import jwt

    try:
        jwks = jwt.PyJWKClient(
            "https://www.googleapis.com/oauth2/v3/certs", cache_keys=True
        )
        signing_key = jwks.get_signing_key_from_jwt(body.id_token)
        claims = jwt.decode(
            body.id_token,
            signing_key.key,
            algorithms=["RS256"],
            # Without `audience` any Google-issued token for any app would be
            # accepted - the single most common mistake in this flow.
            audience=env.GOOGLE_CLIENT_ID,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        )
    except Exception as exc:
        log.warning("google id token rejected", extra={"error": str(exc)})
        raise AppError(
            "Could not verify that Google account.", status.HTTP_401_UNAUTHORIZED
        ) from exc

    if not claims.get("email_verified", False):
        raise AppError(
            "That Google account has no verified email address.",
            status.HTTP_401_UNAUTHORIZED,
        )

    email = str(claims["email"]).lower()
    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        # Password stays NULL: this account signs in through Google only.
        user = User(name=claims.get("name") or email.split("@")[0], email=email)
        db.add(user)
        await db.flush()
        log.info("user registered via google", extra={"user_id": str(user.id)})

    return _session_for(user)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    """Lets the client check whether a stored token is still valid on launch."""
    return UserOut.model_validate(user)
