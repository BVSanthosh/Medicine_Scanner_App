/**
 * The app's backend seam.
 *
 * Each scan path makes exactly ONE call and gets back everything the result
 * screen needs - the extracted fields *and* the verdict. The client never
 * parses a label or decides whether a batch is genuine.
 *
 * The three exported `verify*` functions are the only things the screens call.
 * Each one currently returns mock data; replace the body of each with the real
 * `fetch` (the call is written out in a comment above it) and delete the MOCK
 * section at the bottom of this file. Nothing else in the app needs to change.
 */

import { parseBarcode } from "./barcode";

// ---------------------------------------------------------------------------
// Types - these are the contract with the backend
// ---------------------------------------------------------------------------

export type MedicineFields = {
  name: string;
  salt: string;
  batchNumber: string;
  mfdDate: string;
  expDate: string;
  dose: string;
};

export const EMPTY_FIELDS: MedicineFields = {
  name: "",
  salt: "",
  batchNumber: "",
  mfdDate: "",
  expDate: "",
  dose: "",
};

export type VerificationStatus = "safe" | "unsafe" | "unknown";

/** How the details were obtained. Recorded with the scan, shown on the result. */
export type ScanMethod =
  | "barcode"
  | "barcode_corrected"
  | "ocr"
  | "ocr_corrected"
  | "manual";

export type Coordinates = { latitude: number; longitude: number };

/**
 * Everything the result screen renders. This is the JSON body the backend is
 * expected to return from all three endpoints below.
 */
export type MedicineResult = {
  /** The medicine details, after the backend merged the DB record in. */
  fields: MedicineFields;
  /** The verdict. The client does not compute this. */
  status: VerificationStatus;
  /** Headline for the status card, e.g. "Safe for consumption". */
  title: string;
  /** The explanation shown under the headline. */
  message: string;
  /** 14-digit GTIN, when the pack carried one. Empty string otherwise. */
  gtin: string;
  /** GS1 serial number, when present. Empty string otherwise. */
  serial: string;
};

// ---------------------------------------------------------------------------
// Backend calls - REPLACE THE BODY OF EACH OF THESE
// ---------------------------------------------------------------------------

/**
 * OCR path. The text recognised on-device is sent as-is; the backend does the
 * whole job in this one call:
 *   1. sends `rawText` to the LLM to extract the fields
 *   2. queries the medicine DB with the extracted batch number
 *   3. returns the fields and the verdict together
 */
export async function verifyScannedText(
  rawText: string,
  location: Coordinates | null,
): Promise<MedicineResult> {
  // ==== TODO: REPLACE WITH THE REAL API CALL ==============================
  //
  // const response = await fetch(`${API_BASE_URL}/scans/text`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${token}`,
  //   },
  //   body: JSON.stringify({ rawText, location }),
  // });
  //
  // if (!response.ok) {
  //   throw new Error("Could not verify this medicine. Please try again.");
  // }
  //
  // return (await response.json()) as MedicineResult;
  //
  // ========================================================================
  return mockVerifyText(rawText, location);
}

/**
 * Barcode path. The undecoded payload is sent exactly as the scanner produced
 * it. No LLM is involved here - the backend decodes the GS1 element strings
 * and goes straight to the DB:
 *   1. decodes the payload (GTIN, batch, expiry, serial)
 *   2. queries the medicine DB with the GTIN and batch number
 *   3. returns the fields and the verdict together
 */
export async function verifyScannedBarcode(
  raw: string,
  symbology: string,
  location: Coordinates | null,
): Promise<MedicineResult> {
  // ==== TODO: REPLACE WITH THE REAL API CALL ==============================
  //
  // const response = await fetch(`${API_BASE_URL}/scans/barcode`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${token}`,
  //   },
  //   body: JSON.stringify({ raw, symbology, location }),
  // });
  //
  // if (!response.ok) {
  //   throw new Error("Could not verify this barcode. Please try again.");
  // }
  //
  // return (await response.json()) as MedicineResult;
  //
  // Send `raw` undecoded rather than decoding here first: the verdict is only
  // trustworthy if the server derives the batch number itself.
  //
  // ========================================================================
  return mockVerifyBarcode(raw, symbology, location);
}

/**
 * Manual entry path. The user typed or corrected the details, so there is
 * nothing to extract - the backend only needs to look the batch up and return
 * the verdict.
 */
export async function verifyManualEntry(
  fields: MedicineFields,
  location: Coordinates | null,
  gtin?: string,
): Promise<MedicineResult> {
  // ==== TODO: REPLACE WITH THE REAL API CALL ==============================
  //
  // const response = await fetch(`${API_BASE_URL}/scans/manual`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${token}`,
  //   },
  //   body: JSON.stringify({ fields, gtin, location }),
  // });
  //
  // if (!response.ok) {
  //   throw new Error("Could not verify this medicine. Please try again.");
  // }
  //
  // return (await response.json()) as MedicineResult;
  //
  // ========================================================================
  return mockVerifyManual(fields, location, gtin);
}

// ---------------------------------------------------------------------------
// Helpers used by the screens
// ---------------------------------------------------------------------------

/**
 * Flattens a result into route params for the result screen. Route params are
 * strings, so the stringifying happens here rather than at each call site.
 */
export function toResultParams(
  result: MedicineResult,
  context: {
    method: ScanMethod;
    location: Coordinates | null;
    barcode?: string;
  },
): Record<string, string> {
  return {
    ...result.fields,
    status: result.status,
    title: result.title,
    message: result.message,
    gtin: result.gtin,
    serial: result.serial,
    barcode: context.barcode ?? "",
    method: context.method,
    lat: context.location ? String(context.location.latitude) : "",
    lng: context.location ? String(context.location.longitude) : "",
  };
}

/**
 * True when the backend came back without enough to show a real verdict, so
 * the user should be sent to the form to fill in the gaps instead.
 */
export function needsManualEntry(result: MedicineResult): boolean {
  return !result.fields.batchNumber;
}

// ===========================================================================
// MOCK BACKEND - DELETE THIS ENTIRE SECTION once the real API is wired up.
//
// Everything below stands in for work the *server* does. It is here only so
// the app runs end to end without a backend; none of it belongs in the client.
// ===========================================================================

const MOCK_DELAY_MS = 800;

const mockDelay = () =>
  new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

/** Mock product catalogue, keyed by 14-digit GTIN. */
const MOCK_PRODUCTS: Record<
  string,
  Pick<MedicineFields, "name" | "salt" | "dose">
> = {
  "05000158103054": { name: "Panadol", salt: "Paracetamol", dose: "500mg" },
  "08901030865275": {
    name: "Crocin Advance",
    salt: "Paracetamol",
    dose: "500mg",
  },
};

/**
 * Mock batch register, keyed by the bare batch code. Seeded so the flow can be
 * exercised: 49302 / ABC-123 / LOT9 are genuine, anything starting FAKE is
 * flagged, everything else comes back as not on file.
 */
const MOCK_BATCHES: Record<
  string,
  { gtin: string; status: VerificationStatus }
> = {
  "49302": { gtin: "05000158103054", status: "safe" },
  "ABC-123": { gtin: "05000158103054", status: "safe" },
  LOT9: { gtin: "08901030865275", status: "safe" },
  "FAKE-999": { gtin: "", status: "unsafe" },
};

// Stand-in for the LLM prompt that turns label text into structured fields.
const BATCH_RE =
  /(?:b\.?\s*no\.?|batch\s*(?:no\.?|number)?|lot\s*(?:no\.?)?)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i;
const EXP_RE =
  /(?:exp(?:iry|\.)?|use\s*before|best\s*before)\s*(?:date)?\s*[:.\-]?\s*([0-9]{1,2}[\/.\-][0-9]{2,4}|[0-9]{1,2}[\/.\-][0-9]{1,2}[\/.\-][0-9]{2,4}|[A-Z]{3}\s*[0-9]{2,4})/i;
const MFD_RE =
  /(?:mfg|mfd|manufactur(?:ed|ing)|packed)\s*(?:date)?\s*[:.\-]?\s*([0-9]{1,2}[\/.\-][0-9]{2,4}|[0-9]{1,2}[\/.\-][0-9]{1,2}[\/.\-][0-9]{2,4}|[A-Z]{3}\s*[0-9]{2,4})/i;
const DOSE_RE = /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu)\b)/i;

/** Batch labels are not part of the code, so both entry paths strip them. */
const BATCH_LABEL_RE =
  /^(?:b\.?\s*no|batch(?:\s*(?:no|number))?|lot(?:\s*no)?)\s*(?:[.:\-]\s*|\s+)/i;

const firstMatch = (text: string, re: RegExp) =>
  text.match(re)?.[1]?.trim().replace(/\s+/g, " ") ?? "";

const guessName = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find(
      (line) =>
        line.length >= 3 &&
        line.length <= 40 &&
        /[a-z]{3}/i.test(line) &&
        !BATCH_RE.test(line) &&
        !EXP_RE.test(line) &&
        !MFD_RE.test(line),
    ) ?? "";

const normaliseBatch = (batch: string) =>
  batch.trim().replace(BATCH_LABEL_RE, "").trim().toUpperCase();

/** Mock DB lookup: the step every path ends in. */
function mockLookUp(
  parsed: MedicineFields,
  gtin: string,
  serial: string,
): MedicineResult {
  const batchNumber = normaliseBatch(parsed.batchNumber);

  if (!batchNumber) {
    const product = gtin ? MOCK_PRODUCTS[gtin] : undefined;
    return {
      fields: { ...parsed, ...(product ?? {}), batchNumber: "" },
      status: "unknown",
      title: "Not enough to verify",
      message: product
        ? `We identified this as ${product.name}, but no batch number was captured. Add the batch number printed on the pack.`
        : "No batch number was captured, so this pack could not be checked against the register.",
      gtin,
      serial,
    };
  }

  const record =
    MOCK_BATCHES[batchNumber] ??
    (batchNumber.startsWith("FAKE")
      ? { gtin: "", status: "unsafe" as const }
      : undefined);

  const resolvedGtin = record?.gtin || gtin;
  const product = MOCK_PRODUCTS[resolvedGtin];
  const fields: MedicineFields = {
    ...parsed,
    ...(product ?? {}),
    batchNumber,
  };

  if (!record) {
    return {
      fields,
      status: "unknown",
      title: "Not on file",
      message:
        "This batch number was not found in the manufacturer's register. Check the pack with your pharmacist before taking it.",
      gtin: resolvedGtin,
      serial,
    };
  }

  if (record.status === "unsafe") {
    return {
      fields,
      status: "unsafe",
      title: "Do not consume",
      message:
        "This batch has been flagged in the counterfeit register. Do not take this medicine - report it to your pharmacist.",
      gtin: resolvedGtin,
      serial,
    };
  }

  return {
    fields,
    status: "safe",
    title: "Safe for consumption",
    message:
      "This batch matches an authentic record in the manufacturer's register.",
    gtin: resolvedGtin,
    serial,
  };
}

/** Mock of POST /scans/text - LLM extraction followed by the DB lookup. */
async function mockVerifyText(
  rawText: string,
  _location: Coordinates | null,
): Promise<MedicineResult> {
  await mockDelay();

  const text = rawText.replace(/[ \t]+/g, " ");
  return mockLookUp(
    {
      name: guessName(text),
      salt: "",
      batchNumber: firstMatch(text, BATCH_RE),
      mfdDate: firstMatch(text, MFD_RE),
      expDate: firstMatch(text, EXP_RE),
      dose: firstMatch(text, DOSE_RE),
    },
    "",
    "",
  );
}

/** Mock of POST /scans/barcode - decode then straight to the DB, no LLM. */
async function mockVerifyBarcode(
  raw: string,
  symbology: string,
  _location: Coordinates | null,
): Promise<MedicineResult> {
  await mockDelay();

  const parsed = parseBarcode(raw, symbology);
  return mockLookUp(
    {
      ...EMPTY_FIELDS,
      batchNumber: parsed.batchNumber ?? "",
      expDate: parsed.expDate ?? "",
      mfdDate: parsed.mfdDate ?? "",
    },
    parsed.gtin ?? "",
    parsed.serial ?? "",
  );
}

/** Mock of POST /scans/manual - DB lookup only. */
async function mockVerifyManual(
  fields: MedicineFields,
  _location: Coordinates | null,
  gtin?: string,
): Promise<MedicineResult> {
  await mockDelay();
  return mockLookUp(fields, gtin ?? "", "");
}
