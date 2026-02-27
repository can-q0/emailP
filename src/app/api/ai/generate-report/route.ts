import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  extractBloodMetricsBatch,
  generateSummaryAndAttentionPoints,
} from "@/lib/openai";
import { normalizeMetricName, getMetricReference } from "@/lib/blood-metrics";
import { parseBody, generateReportSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getOrCreateSettings } from "@/lib/settings";

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
  const { patientId, emailIds, title, reportType, format } = parsed.data;

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
      reportEmails: {
        create: emails.map((e) => ({ emailId: e.id })),
      },
    },
  });

  processReport(
    report.id,
    patient.name,
    emails,
    userId,
    reportType || "detailed report",
    effectiveFormat,
    {
      model: settings.aiModel,
      language: settings.reportLanguage,
      customSystemPrompt: settings.customSystemPrompt,
    }
  ).catch(console.error);

  return NextResponse.json({ reportId: report.id, status: "processing" });
}

async function processReport(
  reportId: string,
  patientName: string,
  emails: Array<{
    id: string;
    subject: string | null;
    body: string | null;
    date: Date | null;
  }>,
  userId: string,
  reportType: string,
  format: string,
  aiOptions?: {
    model?: string;
    language?: string;
    customSystemPrompt?: string | null;
  }
) {
  try {
    // Classification is done at sync time (subject parsing + PDF extraction).
    // All synced emails with body text (from PDF) are lab reports.
    const labEmails = emails.filter((e) => e.body);

    if (labEmails.length === 0) {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          summary: null,
          attentionPoints: null,
          status: "no_results",
          step: null,
        },
      });
      return;
    }

    // Step 1: Extract blood metrics from all emails
    await prisma.report.update({
      where: { id: reportId },
      data: { step: "extracting_metrics" },
    });

    const reportRecord = await prisma.report.findUnique({
      where: { id: reportId },
      select: { patientId: true },
    });

    // Check which emails already have cached metrics from prior reports
    const labEmailIds = labEmails.map((e) => e.id);
    const priorReportEmails = await prisma.reportEmail.findMany({
      where: {
        emailId: { in: labEmailIds },
        report: { status: "completed", id: { not: reportId } },
      },
      select: { emailId: true, reportId: true },
    });

    // Build a map: emailId -> reportId that has metrics for it
    const cachedReportByEmail = new Map<string, string>();
    for (const re of priorReportEmails) {
      if (!cachedReportByEmail.has(re.emailId)) {
        cachedReportByEmail.set(re.emailId, re.reportId);
      }
    }

    const cachedEmailIds = new Set(cachedReportByEmail.keys());
    const uncachedEmails = labEmails.filter((e) => !cachedEmailIds.has(e.id) && e.body);
    const cachedEmails = labEmails.filter((e) => cachedEmailIds.has(e.id));

    // Extract metrics only for emails not seen before
    const metricsMap = uncachedEmails.length > 0
      ? await extractBloodMetricsBatch(
          uncachedEmails.map((e) => ({ id: e.id, body: e.body! })),
          aiOptions?.model
        )
      : new Map<string, Array<{ metricName: string; value: number; unit: string; referenceMin?: number; referenceMax?: number; isAbnormal: boolean }>>();

    const allMetrics: Array<{
      metricName: string;
      value: number;
      unit: string;
      referenceMin?: number;
      referenceMax?: number;
      isAbnormal: boolean;
      measuredAt: Date;
    }> = [];

    const dbMetrics: Array<{
      metricName: string;
      value: number;
      unit: string;
      referenceMin: number | null;
      referenceMax: number | null;
      isAbnormal: boolean;
      measuredAt: Date;
      patientId: string;
      reportId: string;
    }> = [];

    // Reuse cached metrics from prior reports
    if (cachedEmails.length > 0) {
      const cachedReportIds = [...new Set(cachedReportByEmail.values())];
      const existingMetrics = await prisma.bloodMetric.findMany({
        where: {
          reportId: { in: cachedReportIds },
          patientId: reportRecord!.patientId,
        },
      });

      // Group by measuredAt to match back to emails
      for (const m of existingMetrics) {
        dbMetrics.push({
          metricName: m.metricName,
          value: m.value,
          unit: m.unit,
          referenceMin: m.referenceMin,
          referenceMax: m.referenceMax,
          isAbnormal: m.isAbnormal,
          measuredAt: m.measuredAt,
          patientId: reportRecord!.patientId,
          reportId,
        });
        allMetrics.push({
          metricName: m.metricName,
          value: m.value,
          unit: m.unit,
          referenceMin: m.referenceMin ?? undefined,
          referenceMax: m.referenceMax ?? undefined,
          isAbnormal: m.isAbnormal,
          measuredAt: m.measuredAt,
        });
      }
    }

    // Process newly extracted metrics
    for (const email of uncachedEmails) {
      const metrics = metricsMap.get(email.id) || [];
      for (const metric of metrics) {
        const normalized = normalizeMetricName(metric.metricName);
        const ref = getMetricReference(metric.metricName);

        const metricData = {
          metricName: normalized,
          value: metric.value,
          unit: metric.unit || ref?.unit || "",
          referenceMin: metric.referenceMin ?? ref?.min ?? null,
          referenceMax: metric.referenceMax ?? ref?.max ?? null,
          isAbnormal: metric.isAbnormal,
          measuredAt: email.date || new Date(),
          patientId: reportRecord!.patientId,
          reportId,
        };

        dbMetrics.push(metricData);
        allMetrics.push({
          ...metricData,
          referenceMin: metricData.referenceMin ?? undefined,
          referenceMax: metricData.referenceMax ?? undefined,
        });
      }
    }

    if (dbMetrics.length > 0) {
      await prisma.bloodMetric.createMany({ data: dbMetrics });
    }

    // Step 2: Generate summary AND attention points in ONE call
    await prisma.report.update({
      where: { id: reportId },
      data: { step: "generating_summary" },
    });

    const emailSummaries = labEmails.map((e) => {
      const dateStr = e.date
        ? e.date.toISOString().split("T")[0]
        : "unknown date";
      return `Date: ${dateStr}\nSubject: ${e.subject}\n\n${e.body?.slice(0, 2000)}`;
    });

    const { summary, attentionPoints } =
      await generateSummaryAndAttentionPoints(
        patientName,
        emailSummaries,
        allMetrics.map((m) => ({
          metricName: m.metricName,
          value: m.value,
          unit: m.unit,
          isAbnormal: m.isAbnormal,
          measuredAt: m.measuredAt.toISOString(),
        })),
        reportType,
        format,
        aiOptions
      );

    await prisma.report.update({
      where: { id: reportId },
      data: {
        summary,
        attentionPoints: JSON.stringify(attentionPoints),
        status: "completed",
        step: null,
      },
    });
  } catch (error) {
    console.error("Report processing error:", error);
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "failed",
        step: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
