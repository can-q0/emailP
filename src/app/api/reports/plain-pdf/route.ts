import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, reportIdSchema, parseSearchParams } from "@/lib/validations";
import { z } from "zod";
import { readPdf } from "@/lib/pdf-storage";
import { enqueueMergePdfs } from "@/lib/queue";

const plainPdfSchema = z.object({
  patientId: z.string().min(1),
  emailIds: z.array(z.string()).min(1),
  title: z.string().optional(),
});

/**
 * POST — Create a plain PDF report: enqueues a job to fetch all PDF
 * attachments from Gmail, merge into one PDF, and store on disk.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, plainPdfSchema);
  if (!parsed.success) return parsed.response;
  const { patientId, emailIds, title } = parsed.data;

  const userId = session.user.id;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const emails = await prisma.email.findMany({
    where: { id: { in: emailIds }, userId },
    orderBy: { date: "asc" },
  });
  if (emails.length === 0) {
    return NextResponse.json({ error: "No emails found" }, { status: 404 });
  }

  // Create report in "processing" state
  const report = await prisma.report.create({
    data: {
      title: title || `Plain PDF - ${patient.name}`,
      patientId,
      userId,
      status: "processing",
      step: "merging_pdfs",
      reportType: "plain PDF",
      format: "detailed",
      summary: null,
      attentionPoints: null,
      reportEmails: {
        create: emails.map((e) => ({ emailId: e.id })),
      },
    },
  });

  await enqueueMergePdfs({
    reportId: report.id,
    emails: emails.map((e) => ({
      id: e.id,
      gmailMessageId: e.gmailMessageId,
      subject: e.subject,
      date: e.date?.toISOString() ?? null,
    })),
    userId,
  });

  return NextResponse.json({ reportId: report.id, status: "processing" });
}

/**
 * GET — Serve the merged PDF as a downloadable file.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, reportIdSchema);
  if (!parsed.success) return parsed.response;
  const { id } = parsed.data;

  const report = await prisma.report.findUnique({
    where: { id, userId: session.user.id },
    include: { patient: true },
  });

  if (!report || report.reportType !== "plain PDF" || !report.pdfPath) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  const pdfBuffer = await readPdf(report.pdfPath);
  const filename = `${report.patient.name.replace(/[^a-zA-Z0-9]/g, "_")}_merged.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
