import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enqueueGenerateReport } from "@/lib/queue";
import { getOrCreateSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const { patientId } = body as { patientId?: string };

  // Find patients to cache
  const patients = patientId
    ? await prisma.patient.findMany({ where: { id: patientId, userId } })
    : await prisma.patient.findMany({ where: { userId } });

  if (patients.length === 0) {
    return NextResponse.json({ error: "No patients found" }, { status: 404 });
  }

  const settings = await getOrCreateSettings(userId);
  const results: Array<{ patientId: string; patientName: string; reportId: string; emailCount: number }> = [];

  for (const patient of patients) {
    // Find lab emails that don't already have cached metrics
    const emails = await prisma.email.findMany({
      where: { patientId: patient.id, isLabReport: true, userId },
      orderBy: { date: "asc" },
    });

    if (emails.length === 0) continue;

    // Check which emails already have metrics from completed reports
    const emailIds = emails.map((e) => e.id);
    const cachedEmails = await prisma.reportEmail.findMany({
      where: {
        emailId: { in: emailIds },
        report: { status: "completed" },
      },
      select: { emailId: true },
    });
    const cachedSet = new Set(cachedEmails.map((e) => e.emailId));
    const uncachedEmails = emails.filter((e) => !cachedSet.has(e.id));

    if (uncachedEmails.length === 0) continue;

    // Create a cache report (hidden from normal listings)
    const report = await prisma.report.create({
      data: {
        title: `Cache - ${patient.name}`,
        patientId: patient.id,
        userId,
        status: "processing",
        step: "extracting_metrics",
        reportType: "cache",
        format: "cache",
        reportEmails: {
          create: uncachedEmails.map((e) => ({ emailId: e.id })),
        },
      },
    });

    // Enqueue the job — processReport will skip summary for reportType "cache"
    await enqueueGenerateReport({
      reportId: report.id,
      patientName: patient.name,
      emails: uncachedEmails.map((e) => ({
        id: e.id,
        subject: e.subject,
        body: e.body,
        date: e.date?.toISOString() ?? null,
      })),
      userId,
      reportType: "cache",
      format: "cache",
      aiOptions: {
        model: settings.aiModel,
        language: settings.reportLanguage,
      },
    });

    results.push({
      patientId: patient.id,
      patientName: patient.name,
      reportId: report.id,
      emailCount: uncachedEmails.length,
    });
  }

  if (results.length === 0) {
    return NextResponse.json({ message: "All emails already cached", cached: 0 });
  }

  return NextResponse.json({
    message: `Caching ${results.reduce((s, r) => s + r.emailCount, 0)} emails for ${results.length} patient(s)`,
    cached: results.length,
    results,
  });
}
