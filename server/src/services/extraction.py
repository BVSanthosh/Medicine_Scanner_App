"""Turning OCR text from a medicine pack into structured fields.

Two things matter here beyond "call the LLM":

1. **Structured output.** The model is given a JSON schema and a temperature of
   0, so we parse a typed object rather than scraping prose. Free-text output
   from an LLM is not an API.
2. **It must never take the endpoint down.** A missing API key, a timeout or a
   malformed response falls back to a deterministic regex parser. A degraded
   answer the user can correct beats a 500.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import re
from functools import lru_cache

from pydantic import BaseModel, Field

from ..core.config import env
from ..schemas.scan_schema import MedicineFields

log = logging.getLogger("api.extraction")

# Must leave room for the model's thinking tokens as well as the JSON answer.
_MAX_OUTPUT_TOKENS = 2048
# Transient 5xx only; see _generate.
_MAX_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = 1.0

_SYSTEM_INSTRUCTION = """\
You extract printed details from medicine packaging.

The text comes from OCR of a single cropped photo, with the pack's printed rows
reconstructed, so a label and its value normally appear on the same line.

Rules:
- Copy values exactly as printed. Never guess, correct or complete a value.
- If a field is not clearly present, return an empty string for it.
- batch_number: the code after B.NO. / BATCH NO. / LOT. Return only the code
  itself, never the label.
- mfd_date and exp_date: keep the printed format (e.g. "12/2026", "31/12/2026").
- dose: strength per unit, e.g. "500mg".
- name: the brand or product name. salt: the active ingredient.
"""


class _ExtractedFields(BaseModel):
    """Schema handed to the model. Snake_case and flat on purpose - the simpler
    the schema, the more reliably it is honoured."""

    name: str = Field(default="", description="Brand or product name")
    salt: str = Field(default="", description="Active ingredient")
    batch_number: str = Field(default="", description="Batch/lot code, no label")
    mfd_date: str = Field(default="", description="Manufacturing date as printed")
    exp_date: str = Field(default="", description="Expiry date as printed")
    dose: str = Field(default="", description="Strength, e.g. 500mg")


# --------------------------------------------------------------------------
# Deterministic fallback
# --------------------------------------------------------------------------

_BATCH_RE = re.compile(
    r"(?:b\.?\s*no\.?|batch\s*(?:no\.?|number)?|lot\s*(?:no\.?)?)\s*[:.\-]?\s*"
    r"([A-Z0-9][A-Z0-9\-/]{2,})",
    re.IGNORECASE,
)
_DATE = r"(\d{1,2}[/.\-]\d{2,4}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|[A-Z]{3}\s*\d{2,4})"
_EXP_RE = re.compile(
    rf"(?:exp(?:iry|\.)?|use\s*before|best\s*before)\s*(?:date)?\s*[:.\-]?\s*{_DATE}",
    re.IGNORECASE,
)
_MFD_RE = re.compile(
    rf"(?:mfg|mfd|manufactur(?:ed|ing)|packed)\s*(?:date)?\s*[:.\-]?\s*{_DATE}",
    re.IGNORECASE,
)
_DOSE_RE = re.compile(r"\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu)\b)", re.IGNORECASE)


def _first(text: str, pattern: re.Pattern[str]) -> str:
    match = pattern.search(text)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else ""


def _guess_name(text: str) -> str:
    for line in (line.strip() for line in text.splitlines()):
        if (
            3 <= len(line) <= 40
            and re.search(r"[a-z]{3}", line, re.IGNORECASE)
            and not _BATCH_RE.search(line)
            and not _EXP_RE.search(line)
            and not _MFD_RE.search(line)
        ):
            return line
    return ""


def extract_with_rules(raw_text: str) -> MedicineFields:
    """Regex extraction. Used when the LLM is unavailable, and as a safety net
    for fields the model leaves blank."""
    text = re.sub(r"[ \t]+", " ", raw_text)
    return MedicineFields(
        name=_guess_name(text),
        salt="",
        batch_number=_first(text, _BATCH_RE),
        mfd_date=_first(text, _MFD_RE),
        exp_date=_first(text, _EXP_RE),
        dose=_first(text, _DOSE_RE),
    )


# --------------------------------------------------------------------------
# LLM
# --------------------------------------------------------------------------


@lru_cache
def _client():
    """Built lazily and cached.

    The original code called ``genai.Client()`` at module import, which meant an
    unset API key crashed the whole app at startup rather than degrading one
    endpoint.
    """
    if not env.GEMINI_API_KEY:
        return None
    from google import genai

    return genai.Client(api_key=env.GEMINI_API_KEY)


def _generation_config():
    from google.genai import types

    return types.GenerateContentConfig(
        system_instruction=_SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_schema=_ExtractedFields,
        # Deterministic: this is extraction, not generation.
        temperature=0.0,
        # Thinking tokens are drawn from this same budget on Gemini 3.x. Set it
        # too low and the model spends the whole allowance reasoning, returns
        # MAX_TOKENS with no content, and `response.parsed` is None - which
        # looks exactly like the model failing to answer. 512 was not enough.
        max_output_tokens=_MAX_OUTPUT_TOKENS,
        # We pass no tools, so the function-calling machinery is dead weight
        # and the SDK warns about using it from generate_content directly.
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )


async def _generate(client, raw_text: str):
    """One call to Gemini, retrying only on transient server-side errors.

    A 503 ("high demand") is common and clears in a second or two. Falling
    straight back to regex on one blip needlessly degrades a scan. A 404 or a
    bad key is *not* transient, so it is raised immediately rather than burning
    the user's time on retries that cannot succeed.
    """
    from google.genai import errors

    last: Exception | None = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            return await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=env.GEMINI_MODEL,
                    contents=raw_text,
                    config=_generation_config(),
                ),
                timeout=env.GEMINI_TIMEOUT_SECONDS,
            )
        except errors.ServerError as exc:  # 5xx
            last = exc
            if attempt == _MAX_ATTEMPTS - 1:
                break
            await asyncio.sleep(_RETRY_BACKOFF_SECONDS * (attempt + 1))

    raise last  # type: ignore[misc]


async def extract_fields(raw_text: str) -> MedicineFields:
    """Extracts medicine fields from OCR text. Always returns a result."""
    fallback = extract_with_rules(raw_text)

    client = _client()
    if client is None:
        log.warning("GEMINI_API_KEY unset; using rule-based extraction")
        return fallback

    try:
        response = await _generate(client, raw_text)
    except TimeoutError:
        log.warning("gemini timed out; falling back to rules")
        return fallback
    except Exception:
        # Logged at ERROR with the traceback on purpose: a retired model or a
        # revoked key fails on *every* request, and the fallback would
        # otherwise hide that behind quietly worse extraction.
        log.exception("gemini call failed; falling back to rules")
        return fallback

    parsed = getattr(response, "parsed", None)
    print(f"PARSED: {parsed}")
    if not isinstance(parsed, _ExtractedFields):
        # finish_reason is the diagnostic that distinguishes "model had nothing
        # to say" from MAX_TOKENS, i.e. the budget being too small.
        finish = None
        with contextlib.suppress(Exception):
            finish = str(response.candidates[0].finish_reason)
        log.warning(
            "gemini returned no parseable object; falling back to rules",
            extra={"finish_reason": finish, "model": env.GEMINI_MODEL},
        )
        return fallback

    # Take the model's answer, but let the regexes fill anything it left blank.
    return MedicineFields(
        name=parsed.name or fallback.name,
        salt=parsed.salt or fallback.salt,
        batch_number=parsed.batch_number or fallback.batch_number,
        mfd_date=parsed.mfd_date or fallback.mfd_date,
        exp_date=parsed.exp_date or fallback.exp_date,
        dose=parsed.dose or fallback.dose,
    )
