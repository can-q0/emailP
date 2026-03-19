import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "pdfs");
const EMAIL_PDF_DIR = path.join(process.cwd(), "storage", "pdfs");
const EMAIL_EML_DIR = path.join(process.cwd(), "storage", "emails");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

// ── Email attachment PDF caching ─────────────────────────

export async function saveEmailPdf(
  userId: string,
  emailId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(EMAIL_PDF_DIR, userId, emailId);
  await ensureDir(dir);
  const safe = sanitizeFilename(filename);
  const filePath = path.join(dir, safe);
  await fs.writeFile(filePath, buffer);
  return path.relative(process.cwd(), filePath);
}

export async function readEmailPdf(relativePath: string): Promise<Buffer | null> {
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

// ── Email .eml storage ──────────────────────────────────

export async function saveEmailEml(
  userId: string,
  emailId: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(EMAIL_EML_DIR, userId);
  await ensureDir(dir);
  const filePath = path.join(dir, `${sanitizeFilename(emailId)}.eml`);
  await fs.writeFile(filePath, buffer);
  return path.relative(process.cwd(), filePath);
}

export async function readEmailEml(relativePath: string): Promise<Buffer | null> {
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

// ── Report PDF storage (existing) ────────────────────────

export async function savePdf(
  reportId: string,
  pdfBytes: Uint8Array
): Promise<string> {
  await ensureDir(UPLOAD_DIR);
  const hash = createHash("sha256")
    .update(Buffer.from(pdfBytes))
    .digest("hex")
    .slice(0, 12);
  const relativePath = `uploads/pdfs/${reportId}-${hash}.pdf`;
  const absolutePath = path.join(process.cwd(), relativePath);
  await fs.writeFile(absolutePath, Buffer.from(pdfBytes));
  return relativePath;
}

export async function readPdf(relativePath: string): Promise<Buffer> {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFile(absolutePath);
}

export async function deletePdf(relativePath: string): Promise<void> {
  const absolutePath = path.join(process.cwd(), relativePath);
  try {
    await fs.unlink(absolutePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
