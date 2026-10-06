# SureShot API

FastAPI service backing the mobile client in [`../client`](../client).

The client holds **no** extraction or verification logic. Every scan is a single
round trip: it sends raw input (OCR text, an undecoded barcode payload, or typed
fields) and receives the resolved medicine fields *and* the verdict together.

## Contract

The client's expectations live in
[`client/src/services/medicine.ts`](../client/src/services/medicine.ts). Each
`verify*` function there has the exact `fetch` it will make written out in a
comment above it. Keep the two in step.

### Shared response body

All three scan endpoints return the same shape:

```jsonc
{
  "fields": {
    "name": "Panadol",
    "salt": "Paracetamol",
    "batchNumber": "49302",
    "mfdDate": "06/2025",      // "" when unknown
    "expDate": "12/2026",      // "" when unknown
    "dose": "500mg"
  },
  "status": "safe",            // "safe" | "unsafe" | "unknown"
  "title": "Safe for consumption",
  "message": "This batch matches an authentic record in the register.",
  "gtin": "05000158103054",    // "" when the pack carried none
  "serial": ""                 // "" when the pack carried none
}
```

`title` and `message` are rendered verbatim on the result screen, so the
wording is yours to control without shipping an app update.

`status` drives the whole result UI:

| status    | Shown as     | Meaning                                          |
| --------- | ------------ | ------------------------------------------------ |
| `safe`    | Verified     | Batch matches an authentic record.               |
| `unsafe`  | Flagged      | Batch is in the counterfeit register.            |
| `unknown` | Unverified   | Could not be confirmed either way.               |

If `fields.batchNumber` comes back empty the client routes the user to the
manual entry form instead of the result screen, because a pack with no batch
number cannot be checked against the register. Return the product details you
*do* have (from the GTIN) so the form arrives pre-filled.

### Endpoints

#### `POST /scans/text`

The OCR path. Does **both** steps in one call.

```jsonc
// request
{ "rawText": "PANADOL\nB.NO.  49302\nEXP.  12/2026", "location": { "latitude": 12.97, "longitude": 77.59 } }
```

1. Send `rawText` to the LLM to extract the fields.
2. Query the medicine DB with the extracted batch number.
3. Return the merged fields plus the verdict.

`location` may be `null` (permission denied). It is for counterfeit-hotspot
reporting, not verification.

> **Note on `rawText`**: the client rebuilds the pack's printed rows from the
> OCR bounding boxes before sending, so labels and values arrive on the same
> line (`B.NO.  49302`). Without that the OCR engine interleaves the label and
> value columns. See `client/src/services/ocr-layout.ts`.

#### `POST /scans/barcode`

The barcode path. **No LLM** — decode and go straight to the DB.

```jsonc
// request
{ "raw": "01050001581030541726120010ABC-123", "symbology": "code128", "location": null }
```

1. Decode the payload with `biip`. Medicine packs carry either a bare GTIN
   (EAN-13/UPC) or GS1 element strings (GS1-128, GS1 DataMatrix) holding
   GTIN + batch + expiry + serial. `biip` implements the General
   Specifications properly: FNC1 separators, fixed-length AIs, GTIN check
   digits and the "day 00 means end of month" rule.

   > GS1's own `gs1encoder` binding was the first choice, but it ships as a C
   > extension with no wheel for current Python; `biip` is pure Python and
   > handled every payload in `tests/test_domain.py` correctly.
2. Query the DB with the GTIN and batch number.
3. Return the fields plus the verdict.

`raw` is sent **undecoded on purpose**. The client decodes a copy for its live
on-screen hint, but the verdict is only trustworthy if the server derives the
batch number itself — otherwise a modified client can ask for any batch it likes
and be told it is safe.

#### `POST /scans/manual`

Details the user typed or corrected. Nothing to extract; look up and return the
verdict.

```jsonc
// request
{ "fields": { /* MedicineFields */ }, "gtin": "05000158103054", "location": null }
```

### Batch number normalisation

`B.NO.`, `BATCH NO:` and `LOT` are *labels*, not part of the code. Strip them
server-side so a pack typed in by hand resolves to the same register key as the
same pack scanned. Require a separator or whitespace after the label, or a
genuine batch called `LOT9` gets mangled into `9`.

### Other endpoints

| Method | Path             | Auth | Returns                                     |
| ------ | ---------------- | ---- | ------------------------------------------- |
| `GET`  | `/scans`         | yes  | `ScanHistoryEntry[]`, newest first          |
| `POST` | `/auth/register` | no   | `{ token, expiresIn, user }`                |
| `POST` | `/auth/login`    | no   | `{ token, expiresIn, user }`                |
| `POST` | `/auth/google`   | no   | `{ token, expiresIn, user }`, 501 if unset  |
| `GET`  | `/auth/me`       | yes  | `UserOut`, for validating a stored token    |
| `GET`  | `/health`        | no   | liveness (no DB access)                     |
| `GET`  | `/health/ready`  | no   | readiness (checks the DB)                   |

All scan endpoints and `/scans` require `Authorization: Bearer <token>`. The
user is always taken from the token, never from the URL.

Errors share one shape, so the client can show `detail` directly:

```jsonc
{ "detail": "Incorrect email or password.", "requestId": "a1b2c3..." }
```

```jsonc
// ScanHistoryEntry
{ "id": "1", "name": "Panadol", "dose": "500mg", "batchNumber": "49302",
  "scannedAt": "2026-08-14T09:12:00Z", "status": "safe" }
```

## Quickstart

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # paste as SECRET_KEY
docker compose up --build            # runs migrations, then serves on :8000
docker compose exec api python -m src.seed
```

Seeded so the flow can be exercised end to end: batches `49302` (printed as
`B.NO.49302`), `ABC-123` and `LOT9` verify as genuine, anything starting `FAKE`
comes back flagged, everything else is "not on file". The GTINs are real and
check-digit valid; the product names attached to them are invented.

Without `GEMINI_API_KEY` the OCR endpoint falls back to rule-based extraction
rather than failing.

## Tests

```bash
pip install -r requirements-dev.txt
pytest          # 49 tests, in-memory SQLite, no Postgres needed
ruff check src tests
```

## Migrations

```bash
alembic revision --autogenerate -m "what changed"
alembic upgrade head
```

`alembic/env.py` imports `src.models` so autogenerate sees every table, and
takes the database URL from settings rather than `alembic.ini`. Always read the
generated migration before applying it — autogenerate does not detect renames.

## Local development against a physical phone

`localhost` on the phone is the *phone*, not your machine. Bind to all
interfaces and point the client at your machine's LAN address:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
# client/.env.local
EXPO_PUBLIC_API_URL=http://192.168.1.x:8000
```

Expo inlines `EXPO_PUBLIC_*` at build time and only via a static
`process.env.EXPO_PUBLIC_API_URL` reference — destructuring or bracket access
will not work. Restart the dev server after changing it.

Plain HTTP over the LAN works in **development** builds because the generated
`android/app/src/debug/AndroidManifest.xml` sets `usesCleartextTraffic="true"`.
Release builds do not, by design — production must be HTTPS.

## Keeping the types in sync

FastAPI publishes an OpenAPI 3.1 schema at `/openapi.json` for free. Generate
the client's types from it rather than hand-maintaining them:

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o ../client/src/services/api-types.d.ts
```

This is the reason there is no shared npm package here: the contract is defined
once, in the Pydantic models, and flows outward.
