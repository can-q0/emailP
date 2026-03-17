import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, generateReportSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getOrCreateSettings } from "@/lib/settings";
import { enqueueGenerateReport } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`generate-report:${session.user.id}`, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute before generating another report." },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, generateReportSchema);
  if (!parsed.success) return parsed.response;
  const { patientId, emailIds, title, reportType, format, comparisonDateA, comparisonDateB } = parsed.data;

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

  const settings = await getOrCreateSettings(userId);

  const effectiveFormat = format || settings.reportDetailLevel || "detailed";

  const report = await prisma.report.create({
    data: {
      title: title || `Report for ${patient.name}`,
      patientId,
      userId,
      status: "processing",
      step: "extracting_metrics",
      reportType: reportType || "detailed report",
      format: effectiveFormat,
      comparisonDateA: comparisonDateA ? new Date(comparisonDateA) : null,
      comparisonDateB: comparisonDateB ? new Date(comparisonDateB) : null,
      reportEmails: {
        create: emails.map((e) => ({ emailId: e.id })),
      },
    },
  });

  await enqueueGenerateReport({
    reportId: report.id,
    patientName: patient.name,
    emails: emails.map((e) => ({
      id: e.id,
      subject: e.subject,
      body: e.body,
      date: e.date?.toISOString() ?? null,
    })),
    userId,
    reportType: reportType || "detailed report",
    format: effectiveFormat,
    aiOptions: {
      model: settings.aiModel,
      language: settings.reportLanguage,
      customSystemPrompt: settings.customSystemPrompt,
    },
  });

  return NextResponse.json({ reportId: report.id, status: "processing" });
}
