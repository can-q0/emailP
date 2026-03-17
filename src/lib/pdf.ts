import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const OCR_TEXT_THRESHOLD = 50;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  const pdfText = pages.join("\n").trim();

  // If pdfjs extracted enough text, return it directly
  if (pdfText.length >= OCR_TEXT_THRESHOLD) {
    return pdfText;
  }

  // Fallback: OCR for scanned/image PDFs
  try {
    const ocrText = await ocrPdfBuffer(buffer);
    return ocrText.length > pdfText.length ? ocrText : pdfText;
  } catch (err) {
    console.error("OCR fallback failed:", err);
    return pdfText;
  }
}

async function ocrPdfBuffer(buffer: Buffer): Promise<string> {
  // Dynamic imports to avoid loading heavy deps when not needed
  const { pdf: convert } = await import("pdf-to-img");
  const Tesseract = await import("tesseract.js");

  const worker = await Tesseract.createWorker("eng+tur");
  const pages: string[] = [];

  try {
    const pdfImages = await convert(buffer, { scale: 2.0 });
    for await (const image of pdfImages) {
      const { data } = await worker.recognize(image);
      if (data.text.trim()) {
        pages.push(data.text.trim());
      }
    }
  } finally {
    await worker.terminate();
  }

  return pages.join("\n");
}
