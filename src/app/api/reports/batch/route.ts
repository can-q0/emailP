import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, batchReportSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getOrCreateSettings } from "@/lib/settings";
import { processReport } from "@/lib/jobs/process-report";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`batch-report:${session.user.id}`, { limit: 3, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many batch requests. Please wait a minute." },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, batchReportSchema);
  if (!parsed.success) return parsed.response;
  const { patientIds, reportType, format } = parsed.data;

  const userId = session.user.id;

  // Verify all patients belong to user
  const patients = await prisma.patient.findMany({
    where: { id: { in: patientIds }, userId },
    include: {
      emails: {
        select: { id: true, subject: true, body: true, date: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (patients.length !== patientIds.length) {
    return NextResponse.json(
      { error: "One or more patients not found" },
      { status: 404 }
    );
  }

  const settings = await getOrCreateSettings(userId);
  const effectiveFormat = format || settings.reportDetailLevel || "detailed";
  const effectiveReportType = reportType || "detailed report";

  const reports: Array<{
    patientId: string;
    patientName: string;
    reportId: string;
    status: string;
  }> = [];

  for (const patient of patients) {
    const emails = patient.emails;

    const report = await prisma.report.create({
      data: {
        title: `Report for ${patient.name}`,
        patientId: patient.id,
        userId,
        status: "processing",
        step: "extracting_metrics",
        reportType: effectiveReportType,
        format: effectiveFormat,
        reportEmails: {
          create: emails.map((e) => ({ emailId: e.id })),
        },
      },
    });

    const payload = {
      reportId: report.id,
      patientName: patient.name,
      emails: emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        body: e.body,
        date: e.date?.toISOString() ?? null,
      })),
      userId,
      reportType: effectiveReportType,
      format: effectiveFormat,
      aiOptions: {
        model: settings.aiModel,
        language: settings.reportLanguage,
        customSystemPrompt: settings.customSystemPrompt,
      },
    };

    after(async () => {
      try {
        await processReport(payload);
      } catch (err) {
        console.error("[batch] processing failed:", err);
        await prisma.report.update({
          where: { id: report.id },
          data: { status: "failed", step: null },
        });
      }
    });

    reports.push({
      patientId: patient.id,
      patientName: patient.name,
      reportId: report.id,
      status: "processing",
    });
  }

  return NextResponse.json({ reports });
}
