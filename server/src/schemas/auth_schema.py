from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from .common import CamelModel

# OWASP's current guidance is a length floor rather than composition rules;
# complexity requirements push people towards predictable substitutions.
MIN_PASSWORD_LENGTH = 8
# Argon2 has no practical input limit, but an unbounded password is a cheap
# way to make the server burn CPU hashing a megabyte.
MAX_PASSWORD_LENGTH = 128


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class RegisterRequest(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("password")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be only whitespace.")
        return value


class GoogleLoginRequest(CamelModel):
    """The ID token returned by Google Sign-In on the device."""

    id_token: str = Field(min_length=1, max_length=4096)


class UserOut(CamelModel):
    id: UUID
    name: str
    email: EmailStr


class AuthResponse(CamelModel):
    """What the client stores on a successful sign-in.

    The original schema returned only the user and no token, so there was
    nothing to authenticate the next request with.
    """

    token: str
    # Lets the client refresh before expiry instead of discovering it via a 401.
    expires_in: int
    user: UserOut
