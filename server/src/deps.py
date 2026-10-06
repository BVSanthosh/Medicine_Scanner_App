"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .core.db import get_db
from .core.errors import AppError
from .core.security import TokenError, decode_access_token
from .models.user import User

# auto_error=False so a missing header produces our own JSON error shape rather
# than Starlette's, keeping every error response identical for the client.
_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """Resolves the caller from the Authorization header.

    Every user-scoped endpoint takes the identity from here and *never* from a
    path or query parameter. The original `/scan/medicines/{user_id}` let anyone
    read anyone else's scan history simply by changing the id in the URL.
    """
    if credentials is None or not credentials.credentials:
        raise AppError("Not authenticated.", status.HTTP_401_UNAUTHORIZED)

    try:
        user_id = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise AppError(
            "Your session has expired. Please sign in again.",
            status.HTTP_401_UNAUTHORIZED,
        ) from exc

    user = await db.get(User, user_id)
    if user is None:
        # Token is valid but the account is gone (deleted). Treat as unauthenticated.
        raise AppError("Account no longer exists.", status.HTTP_401_UNAUTHORIZED)

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]