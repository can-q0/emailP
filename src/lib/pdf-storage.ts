import { prisma } from "@/lib/prisma";

// ── Email attachment PDF storage (in DB) ─────────────────

export async function saveEmailPdf(
  userId: string,
  gmailMessageId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  // Store PDF binary in the Email record's pdfData column
  const email = await prisma.email.findFirst({
    where: { gmailMessageId, userId },
    select: { id: true },
  });
  if (email) {
    await prisma.email.update({
      where: { id: email.id },
      data: { pdfData: new Uint8Array(buffer), pdfPath: filename },
    });
  }
  return filename;
}

export async function readEmailPdf(emailId: string): Promise<Buffer | null> {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: { pdfData: true },
  });
  if (!email?.pdfData) return null;
  return Buffer.from(email.pdfData);
}

// ── Email .eml storage (in DB) ───────────────────────────

export async function saveEmailEml(
  userId: string,
  gmailMessageId: string,
  buffer: Buffer
): Promise<string> {
  const email = await prisma.email.findFirst({
    where: { gmailMessageId, userId },
    select: { id: true },
  });
  if (email) {
    await prisma.email.update({
      where: { id: email.id },
      data: { emlData: new Uint8Array(buffer), emlPath: `${gmailMessageId}.eml` },
    });
  }
  return `${gmailMessageId}.eml`;
}

export async function readEmailEml(emailId: string): Promise<Buffer | null> {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: { emlData: true },
  });
  if (!email?.emlData) return null;
  return Buffer.from(email.emlData);
}

// ── Report PDF storage (in DB) ───────────────────────────

export async function savePdf(
  reportId: string,
  pdfBytes: Uint8Array
): Promise<string> {
  await prisma.report.update({
    where: { id: reportId },
    data: { pdfData: new Uint8Array(pdfBytes), pdfPath: `${reportId}.pdf` },
  });
  return `${reportId}.pdf`;
}

export async function readPdf(reportId: string): Promise<Buffer> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { pdfData: true },
  });
  if (!report?.pdfData) throw new Error("PDF not found");
  return Buffer.from(report.pdfData);
}

export async function deletePdf(reportId: string): Promise<void> {
  await prisma.report.update({
    where: { id: reportId },
    data: { pdfData: null, pdfPath: null },
  });
}
