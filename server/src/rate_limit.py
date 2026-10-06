"""Rate limiting.

Two endpoints genuinely need it: 

* **auth** - without a limit, the login endpoint is an offline password cracker
  with a network API in front of it;
* **scans** - every OCR scan costs an LLM call, so an unthrottled client is a
  direct line to your billing account.

The default in-memory backend counts per process. Behind more than one worker or
replica, point ``RATE_LIMIT_STORAGE_URI`` at Redis so the limit is shared.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from .core.security import TokenError, decode_access_token

def _identify(request: Request) -> str:
    """Rate-limit per user when we can, per IP otherwise.

    Keying only on IP punishes everyone behind a shared NAT (an office, a
    university, a mobile carrier) for one noisy client.
    """
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            return f"user:{decode_access_token(auth[7:])}"
        except TokenError:
            pass
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_identify)