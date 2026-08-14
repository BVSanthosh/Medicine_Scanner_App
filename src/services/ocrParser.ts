// services/ocrParser.ts

export function parseIndianMedicineLabel(rawText: string) {
  const cleanedText = rawText.replace(/\s+/g, " ");

  console.log(cleanedText);

  const batchRegex = /(?:b\.?no\.?|batch\s?(?:no)?\.?)\s*([a-z0-9_-]+)/i;
  const mfdRegex = /(?:mfg\.?|mfd\.?|mfg\s*date)\s*([0-9]{2}[\/\.-][0-9]{4})/i;
  const expRegex = /(?:exp\.?|expiry\s*date)\s*([0-9]{2}[\/\.-][0-9]{4})/i;
  const doseRegex = /\b([0-9]+\s?(?:mg|ml|g))\b/i;

  return {
    batchNumber: cleanedText.match(batchRegex)?.[1] || "",
    mfdDate: cleanedText.match(mfdRegex)?.[1] || "",
    expDate: cleanedText.match(expRegex)?.[1] || "",
    dose: cleanedText.match(doseRegex)?.[1] || "",
    rawText: cleanedText,
  };
}
