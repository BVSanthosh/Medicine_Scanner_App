// services/ocrParser.ts

export interface MedicineParseResult {
  name: string;
  batchNumber: string;
  mfdDate: string;
  expDate: string;
  dose: string;
  rawText: string;
}

export function parseIndianMedicineLabel(rawText: string): MedicineParseResult {
  // Clean up newlines and extra spaces into a single clean string
  const cleanedText = rawText.replace(/\s+/g, " ").trim();

  // 1. Medicine Name: Looks for common pharmaceutical keywords
  const nameMatch = cleanedText.match(
    /([A-Z\s]{4,}(?:TABLETS|CAPSULES|SYRUP|INJECTION|IP|USP|BP))/i,
  );
  const medicineName = nameMatch ? nameMatch[1].trim() : "";

  // 2. Batch Number: Handles B.No, B No, Batch No, Lot (with optional colons/dashes)
  const batchRegex =
    /(?:b\.?\s*no\.?|batch\s*(?:no)?\.?|lot\.?)\s*[:\-]?\s*([a-z0-9_-]+)/i;

  // 3. Manufacturing Date: Handles MFD, Mfg Date, Manufactured
  const mfdRegex =
    /(?:mfg\.?|mfg\.?\s*date|manufactured|mfd\.?)\s*[:\-]?\s*([0-9]{2}[\/\.-][0-9]{4}|[0-9]{4})/i;

  // 4. Expiry Date: Handles EXP, Exp Date, Expiry
  const expRegex =
    /(?:exp\.?|exp\.?\s*date|expiry)\s*[:\-]?\s*([0-9]{2}[\/\.-][0-9]{4}|[0-9]{4})/i;

  // 5. Dose / Strength: Handles mg, ml, g, mcg
  const doseRegex = /\b([0-9]+\s?(?:mg|ml|g|mcg))\b/i;

  return {
    name: medicineName,
    batchNumber: cleanedText.match(batchRegex)?.[1] || "",
    mfdDate: cleanedText.match(mfdRegex)?.[1] || "",
    expDate: cleanedText.match(expRegex)?.[1] || "",
    dose: cleanedText.match(doseRegex)?.[1] || "",
    rawText: cleanedText,
  };
}
