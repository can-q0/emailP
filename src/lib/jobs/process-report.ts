import { prisma } from "@/lib/prisma";
import {
  extractBloodMetricsBatch,
  generateSummaryAndAttentionPoints,
} from "@/lib/openai";
import { normalizeMetricName, getMetricReference, getAdjustedRange } from "@/lib/blood-metrics";
import { bloodMetricReferences } from "@/config/blood-metrics";
import { sendReportEmail } from "@/lib/resend";
import type { GenerateReportPayload } from "@/lib/queue";
import type { TrendAlert, TrendReading } from "@/types";

// ── Trend Detection (server-only — uses prisma) ──────────

async function detectTrends(
  patientId: string,
  currentMetrics: Array<{
    metricName: string;
    value: number;
    unit: string;
    isAbnormal: boolean;
    measuredAt: Date;
  }>
): Promise<TrendAlert[]> {
  const allRecords = await prisma.bloodMetric.findMany({
    where: { patientId },
    orderBy: { measuredAt: "asc" },
  });

  const grouped = new Map<string, Array<{
    value: number;
    unit: string;
    measuredAt: Date;
    isAbnormal: boolean;
  }>>();

  for (const r of allRecords) {
    const key = normalizeMetricName(r.metricName);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({
      value: r.value,
      unit: r.unit,
      measuredAt: r.measuredAt,
      isAbnormal: r.isAbnormal,
    });
  }

  for (const m of currentMetrics) {
    const key = normalizeMetricName(m.metricName);
    if (!grouped.has(key)) grouped.set(key, []);
    const arr = grouped.get(key)!;
    const exists = arr.some(
      (r) => r.measuredAt.getTime() === m.measuredAt.getTime() && r.value === m.value
    );
    if (!exists) {
      arr.push({
        value: m.value,
        unit: m.unit,
        measuredAt: m.measuredAt,
        isAbnormal: m.isAbnormal,
      });
    }
  }

  const alerts: TrendAlert[] = [];

  for (const [metricKey, readings] of grouped) {
    if (readings.length < 2) continue;
    readings.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());

    const ref = bloodMetricReferences[metricKey];
    if (!ref) continue;

    const midpoint = (ref.min + ref.max) / 2;
    const toReadings = (items: typeof readings): TrendReading[] =>
      items.map((r) => ({
        value: r.value,
        unit: r.unit,
        measuredAt: r.measuredAt.toISOString(),
        isAbnormal: r.isAbnormal,
      }));

    // 1. Consecutive worsening: 3+ readings moving away from midpoint
    if (readings.length >= 3) {
      let streak = 1;
      for (let i = 1; i < readings.length; i++) {
        const prevDist = Math.abs(readings[i - 1].value - midpoint);
        const currDist = Math.abs(readings[i].value - midpoint);
        if (currDist > prevDist) {
          streak++;
        } else {
          streak = 1;
        }
      }
      if (streak >= 3) {
        const severity = streak >= 5 ? "high" : streak >= 4 ? "medium" : "low";
        alerts.push({
          metricName: metricKey,
          displayName: ref.name,
          direction: "worsening",
          severity,
          type: "consecutive_worsening",
          description: `${ref.name} has been moving away from normal range for ${streak} consecutive measurements.`,
          readings: toReadings(readings.slice(-streak)),
        });
      }
    }

    // 2. Rapid change: >20% change between last two readings in abnormal direction
    if (readings.length >= 2) {
      const prev = readings[readings.length - 2];
      const curr = readings[readings.length - 1];
      if (prev.value !== 0) {
        const pctChange = ((curr.value - prev.value) / Math.abs(prev.value)) * 100;
        const absPct = Math.abs(pctChange);
        const movingAway =
          Math.abs(curr.value - midpoint) > Math.abs(prev.value - midpoint);

        if (absPct > 20 && movingAway) {
          const severity = absPct > 50 ? "high" : absPct > 35 ? "medium" : "low";
          alerts.push({
            metricName: metricKey,
            displayName: ref.name,
            direction: "worsening",
            severity,
            type: "rapid_change",
            description: `${ref.name} changed by ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}% between the last two readings.`,
            readings: toReadings([prev, curr]),
            percentChange: pctChange,
          });
        }
      }
    }

    // 3. Persistent abnormal: last 3+ readings all outside reference range
    if (readings.length >= 3) {
      let abnormalStreak = 0;
      for (let i = readings.length - 1; i >= 0; i--) {
        if (readings[i].value < ref.min || readings[i].value > ref.max) {
          abnormalStreak++;
        } else {
          break;
        }
      }
      if (abnormalStreak >= 3) {
        const severity = abnormalStreak >= 5 ? "high" : abnormalStreak >= 4 ? "medium" : "low";
        alerts.push({
          metricName: metricKey,
          displayName: ref.name,
          direction: "worsening",
          severity,
          type: "persistent_abnormal",
          description: `${ref.name} has been outside the normal range for the last ${abnormalStreak} measurements.`,
          readings: toReadings(readings.slice(-abnormalStreak)),
        });
      }
    }
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return alerts;
}

export async function processReport(payload: GenerateReportPayload) {
  const { reportId, patientName, emails, reportType, format, aiOptions } =
    payload;

  // Parse ISO date strings back to Date objects
  const parsedEmails = emails.map((e) => ({
    ...e,
    date: e.date ? new Date(e.date) : null,
  }));

  try {
    const labEmails = parsedEmails.filter((e) => e.body);

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
      select: { patientId: true, comparisonDateA: true, comparisonDateB: true },
    });

    // Look up patient age/gender for adjusted reference ranges
    const patient = await prisma.patient.findUnique({
      where: { id: reportRecord!.patientId },
      select: { birthYear: true, gender: true },
    });
    const patientAge = patient?.birthYear
      ? new Date().getFullYear() - patient.birthYear
      : null;
    const patientGender = patient?.gender ?? null;

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
    const uncachedEmails = labEmails.filter(
      (e) => !cachedEmailIds.has(e.id) && e.body
    );
    const cachedEmails = labEmails.filter((e) => cachedEmailIds.has(e.id));

    // Extract metrics only for emails not seen before
    const metricsMap =
      uncachedEmails.length > 0
        ? await extractBloodMetricsBatch(
            uncachedEmails.map((e) => ({ id: e.id, body: e.body! }))
          )
        : new Map<
            string,
            Array<{
              metricName: string;
              value: number;
              unit: string;
              referenceMin?: number;
              referenceMax?: number;
              isAbnormal: boolean;
            }>
          >();

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
        // Use lab-extracted ranges if available, otherwise use age/gender adjusted config ranges
        const adjustedRange = getAdjustedRange(normalized, patientAge, patientGender);
        const refMin = metric.referenceMin ?? adjustedRange?.min ?? ref?.min ?? null;
        const refMax = metric.referenceMax ?? adjustedRange?.max ?? ref?.max ?? null;
        // Recalculate isAbnormal with our range (lab-extracted ranges still take priority via refMin/refMax)
        const isAbnormal = refMin != null && refMax != null
          ? (metric.value < refMin || metric.value > refMax)
          : metric.isAbnormal;

        const metricData = {
          metricName: normalized,
          value: metric.value,
          unit: metric.unit || ref?.unit || "",
          referenceMin: refMin,
          referenceMax: refMax,
          isAbnormal,
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

    // If no metrics were found across all emails, mark as no_results
    if (allMetrics.length === 0) {
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

    // Cache-only mode: skip summary generation, just store metrics
    if (reportType === "cache") {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          summary: `Cached ${allMetrics.length} metrics from ${labEmails.length} emails`,
          status: "completed",
          step: null,
        },
      });
      return;
    }

    // Detect trends across all patient history
    const trendAlerts = await detectTrends(reportRecord!.patientId, allMetrics);

    // For comparison reports with specific dates, filter metrics to those two dates
    let metricsForSummary = allMetrics;
    if (reportType === "comparison" && reportRecord?.comparisonDateA && reportRecord?.comparisonDateB) {
      const dayA = reportRecord.comparisonDateA.toISOString().split("T")[0];
      const dayB = reportRecord.comparisonDateB.toISOString().split("T")[0];
      metricsForSummary = allMetrics.filter((m) => {
        const day = m.measuredAt.toISOString().split("T")[0];
        return day === dayA || day === dayB;
      });
      // Fall back to all metrics if filtering produces nothing
      if (metricsForSummary.length === 0) metricsForSummary = allMetrics;
    }

    // Step 2: Generate summary AND attention points in ONE call
    await prisma.report.update({
      where: { id: reportId },
      data: { step: "generating_summary" },
    });

    const emailSummaries = labEmails.map((e) => {
      const dateStr = e.date ? e.date.toISOString().split("T")[0] : "unknown date";
      return `Date: ${dateStr}\nSubject: ${e.subject}\n\n${e.body?.slice(0, 2000)}`;
    });

    const { summary, attentionPoints } =
      await generateSummaryAndAttentionPoints(
        patientName,
        emailSummaries,
        metricsForSummary.map((m) => ({
          metricName: m.metricName,
          value: m.value,
          unit: m.unit,
          isAbnormal: m.isAbnormal,
          measuredAt: m.measuredAt.toISOString(),
        })),
        reportType,
        format,
        { ...aiOptions, trendAlerts }
      );

    await prisma.report.update({
      where: { id: reportId },
      data: {
        summary,
        attentionPoints: JSON.stringify(attentionPoints),
        trendAlerts: trendAlerts.length > 0 ? JSON.stringify(trendAlerts) : null,
        status: "completed",
        step: null,
      },
    });

    // Feature 8: Email notification on report completion
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: payload.userId },
      });
      if (settings?.emailNotifications !== false) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { email: true },
        });
        if (user?.email) {
          const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
          await sendReportEmail({
            to: user.email,
            patientName,
            reportTitle: `Report for ${patientName}`,
            summary: summary || "",
            attentionPoints: attentionPoints.map((a: { severity: string; title: string; description: string }) => ({
              severity: a.severity,
              title: a.title,
              description: a.description,
            })),
            reportUrl: `${baseUrl}/report/${reportId}`,
          });
        }
      }
    } catch (notifError) {
      // Fire-and-forget — don't fail the report for notification errors
      console.error("Notification email error:", notifError);
    }
  } catch (error) {
    console.error("Report processing error:", error);
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "failed",
        step: error instanceof Error ? error.message : "Unknown error",
      },
    });
    // Re-throw so pg-boss can retry
    throw error;
  }
}
