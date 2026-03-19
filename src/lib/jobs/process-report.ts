import { prisma } from "@/lib/prisma";
import {
  extractBloodMetricsBatch,
  generateSummaryAndAttentionPoints,
} from "@/lib/openai";
import { normalizeMetricName, getMetricReference, getAdjustedRange } from "@/lib/blood-metrics";
import { bloodMetricReferences } from "@/config/blood-metrics";
import { detectClinicalCorrelations } from "@/lib/clinical-correlations";
import { sendReportEmail } from "@/lib/resend";
import { readEmailPdf } from "@/lib/pdf-storage";
import { extractPdfText } from "@/lib/pdf";
import type { GenerateReportPayload } from "@/lib/queue";
import type { TrendAlert, TrendReading } from "@/types";

// ── Linear regression helper ────────────────────────────

function linearRegression(points: { x: number; y: number }[]): { slope: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // R² (coefficient of determination)
  const yMean = sumY / n;
  let ssRes = 0, ssTot = 0;
  const intercept = (sumY - slope * sumX) / n;
  for (const { x, y } of points) {
    const predicted = intercept + slope * x;
    ssRes += (y - predicted) ** 2;
    ssTot += (y - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, r2 };
}

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
    referenceMin: number | null;
    referenceMax: number | null;
  }>>();

  for (const r of allRecords) {
    const key = normalizeMetricName(r.metricName);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({
      value: r.value,
      unit: r.unit,
      measuredAt: r.measuredAt,
      isAbnormal: r.isAbnormal,
      referenceMin: r.referenceMin,
      referenceMax: r.referenceMax,
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
        referenceMin: null,
        referenceMax: null,
      });
    }
  }

  const alerts: TrendAlert[] = [];

  for (const [metricKey, readings] of grouped) {
    if (readings.length < 2) continue;
    readings.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());

    const configRef = bloodMetricReferences[metricKey];
    if (!configRef) continue;

    // Use lab-extracted reference ranges if available, fall back to config
    const latestWithRef = [...readings].reverse().find((r) => r.referenceMin != null && r.referenceMax != null);
    const ref = {
      ...configRef,
      min: latestWithRef?.referenceMin ?? configRef.min,
      max: latestWithRef?.referenceMax ?? configRef.max,
    };

    const midpoint = (ref.min + ref.max) / 2;
    const toReadings = (items: typeof readings): TrendReading[] =>
      items.map((r) => ({
        value: r.value,
        unit: r.unit,
        measuredAt: r.measuredAt.toISOString(),
        isAbnormal: r.isAbnormal,
      }));

    const isOutOfRange = (v: number) => v < ref.min || v > ref.max;
    const latestReading = readings[readings.length - 1];

    // 1. Consecutive worsening: 3+ readings moving further from range, latest must be abnormal
    if (readings.length >= 3 && isOutOfRange(latestReading.value)) {
      let streak = 1;
      for (let i = 1; i < readings.length; i++) {
        const prevDist = Math.abs(readings[i - 1].value - midpoint);
        const currDist = Math.abs(readings[i].value - midpoint);
        if (currDist > prevDist && isOutOfRange(readings[i].value)) {
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
          description: `${ref.name} has been moving further from normal range for ${streak} consecutive measurements.`,
          readings: toReadings(readings.slice(-streak)),
        });
      }
    }

    // 2. Rapid change: >20% change AND latest reading is outside reference range
    if (readings.length >= 2) {
      const prev = readings[readings.length - 2];
      const curr = readings[readings.length - 1];
      if (prev.value !== 0 && isOutOfRange(curr.value)) {
        const pctChange = ((curr.value - prev.value) / Math.abs(prev.value)) * 100;
        const absPct = Math.abs(pctChange);

        if (absPct > 20) {
          const severity = absPct > 50 ? "high" : absPct > 35 ? "medium" : "low";
          alerts.push({
            metricName: metricKey,
            displayName: ref.name,
            direction: "worsening",
            severity,
            type: "rapid_change",
            description: `${ref.name} changed by ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}% between the last two readings and is outside the normal range.`,
            readings: toReadings([prev, curr]),
            percentChange: pctChange,
          });
        }
      }
    }

    // 3. Persistent abnormal: last 2+ readings all outside reference range
    if (readings.length >= 2) {
      let abnormalStreak = 0;
      for (let i = readings.length - 1; i >= 0; i--) {
        if (isOutOfRange(readings[i].value)) {
          abnormalStreak++;
        } else {
          break;
        }
      }
      if (abnormalStreak >= 2) {
        const severity = abnormalStreak >= 4 ? "high" : abnormalStreak >= 3 ? "medium" : "low";
        alerts.push({
          metricName: metricKey,
          displayName: ref.name,
          direction: "worsening",
          severity,
          type: "persistent_abnormal",
          description: `${ref.name} has been outside the normal range (${ref.min}–${ref.max} ${readings[0].unit}) for the last ${abnormalStreak} measurements.`,
          readings: toReadings(readings.slice(-abnormalStreak)),
        });
      }
    }

    // 4. Linear trend: statistically significant directional trend over 3+ readings
    if (readings.length >= 3) {
      const firstTime = readings[0].measuredAt.getTime();
      const points = readings.map((r) => ({
        x: (r.measuredAt.getTime() - firstTime) / (1000 * 60 * 60 * 24), // days
        y: r.value,
      }));

      const { slope, r2 } = linearRegression(points);

      // Only flag if R² > 0.7, slope is meaningful, AND latest value is outside reference range
      const range = ref.max - ref.min;
      const normalizedSlope = Math.abs(slope) / (range || 1);
      const slopePerMonth = normalizedSlope * 30;
      const latestVal = readings[readings.length - 1].value;

      if (r2 > 0.7 && slopePerMonth > 0.1 && isOutOfRange(latestVal)) {
        const movingAway = Math.abs(latestVal - midpoint) >
                           Math.abs(readings[0].value - midpoint);
        const direction = movingAway ? "worsening" : "improving";
        const severity = slopePerMonth > 0.3 ? "high" : slopePerMonth > 0.2 ? "medium" : "low";

        alerts.push({
          metricName: metricKey,
          displayName: ref.name,
          direction,
          severity,
          type: "linear_trend",
          description: `${ref.name} shows a ${direction} trend outside normal range (${ref.min}–${ref.max} ${readings[0].unit}).`,
          readings: toReadings(readings),
          slope: slope * 30,
        });
      }
    }

    // 5. Accelerating change: rate of change itself is increasing (second derivative)
    if (readings.length >= 4) {
      // Calculate rates of change between consecutive pairs
      const rates: { x: number; y: number }[] = [];
      const firstTime = readings[0].measuredAt.getTime();
      for (let i = 1; i < readings.length; i++) {
        const dt = (readings[i].measuredAt.getTime() - readings[i - 1].measuredAt.getTime()) / (1000 * 60 * 60 * 24);
        if (dt === 0) continue;
        const rate = (readings[i].value - readings[i - 1].value) / dt;
        const midTime = (readings[i].measuredAt.getTime() + readings[i - 1].measuredAt.getTime()) / 2;
        rates.push({ x: (midTime - firstTime) / (1000 * 60 * 60 * 24), y: rate });
      }

      if (rates.length >= 3) {
        const { slope: acceleration, r2 } = linearRegression(rates);

        // Flag if rate of change is itself changing significantly and moving away from normal
        const range = ref.max - ref.min;
        const normalizedAccel = Math.abs(acceleration) / (range || 1);

        if (r2 > 0.6 && normalizedAccel > 0.005 && isOutOfRange(readings[readings.length - 1].value)) {
          const lastRate = rates[rates.length - 1].y;
          const movingAway = (lastRate > 0 && readings[readings.length - 1].value > midpoint) ||
                             (lastRate < 0 && readings[readings.length - 1].value < midpoint);

          if (movingAway) {
            alerts.push({
              metricName: metricKey,
              displayName: ref.name,
              direction: "worsening",
              severity: normalizedAccel > 0.01 ? "high" : "medium",
              type: "accelerating_change",
              description: `${ref.name} is accelerating away from the normal range (${ref.min}–${ref.max} ${readings[0].unit}).`,
              readings: toReadings(readings),
            });
          }
        }
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
    console.log(`[process-report] Starting report ${reportId} with ${parsedEmails.length} emails`);

    // Enrich emails that have a cached PDF but short/missing body text
    const emailRecords = await prisma.email.findMany({
      where: { id: { in: parsedEmails.map((e) => e.id) } },
      select: { id: true, pdfPath: true },
    });
    const pdfPathById = new Map(emailRecords.map((r) => [r.id, r.pdfPath]));
    console.log(`[process-report] Found ${emailRecords.filter((r) => r.pdfPath).length}/${emailRecords.length} emails with cached PDFs`);

    for (const email of parsedEmails) {
      const bodyLen = email.body?.trim().length || 0;
      const pdfPath = pdfPathById.get(email.id);
      console.log(`[process-report] Email ${email.id.slice(0, 12)}: bodyLen=${bodyLen}, pdfPath=${pdfPath ? 'yes' : 'no'}`);

      if (bodyLen > 500) continue;
      if (!pdfPath) continue;

      try {
        const buffer = await readEmailPdf(pdfPath);
        console.log(`[process-report] PDF read: ${buffer ? buffer.length + ' bytes' : 'null'}`);
        if (buffer) {
          const pdfText = await extractPdfText(buffer);
          console.log(`[process-report] PDF text extracted: ${pdfText.length} chars`);
          if (pdfText && pdfText.trim().length > 50) {
            email.body = [pdfText, email.body].filter(Boolean).join("\n\n---\n\n");
            console.log(`[process-report] Enriched email ${email.id.slice(0, 12)} with ${pdfText.length} chars of PDF text`);
          }
        }
      } catch (err) {
        console.error(`[process-report] PDF enrichment failed for ${email.id}:`, err);
      }
    }

    const labEmails = parsedEmails.filter((e) => e.body && e.body.trim().length > 50);
    console.log(`[process-report] labEmails after enrichment: ${labEmails.length} (bodies: ${labEmails.map((e) => e.body?.length || 0).join(', ')})`);

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
    // Only consider reports that actually extracted metrics (not plain PDF merges)
    const labEmailIds = labEmails.map((e) => e.id);
    const priorReportEmails = await prisma.reportEmail.findMany({
      where: {
        emailId: { in: labEmailIds },
        report: {
          status: "completed",
          id: { not: reportId },
          reportType: { notIn: ["plain PDF", "cache"] },
        },
      },
      select: { emailId: true, reportId: true },
    });

    // Only consider a report as cache source if it actually has blood metrics
    const reportIdsWithMetrics = new Set<string>();
    if (priorReportEmails.length > 0) {
      const uniqueReportIds = [...new Set(priorReportEmails.map((r) => r.reportId))];
      const metricCounts = await prisma.bloodMetric.groupBy({
        by: ["reportId"],
        where: { reportId: { in: uniqueReportIds } },
        _count: true,
      });
      for (const mc of metricCounts) {
        if (mc._count > 0) reportIdsWithMetrics.add(mc.reportId!);
      }
    }

    // Build a map: emailId -> reportId that has metrics for it
    const cachedReportByEmail = new Map<string, string>();
    for (const re of priorReportEmails) {
      if (!cachedReportByEmail.has(re.emailId) && reportIdsWithMetrics.has(re.reportId)) {
        cachedReportByEmail.set(re.emailId, re.reportId);
      }
    }

    const cachedEmailIds = new Set(cachedReportByEmail.keys());
    const uncachedEmails = labEmails.filter(
      (e) => !cachedEmailIds.has(e.id) && e.body
    );
    const cachedEmails = labEmails.filter((e) => cachedEmailIds.has(e.id));
    console.log(`[process-report] ${cachedEmails.length} cached, ${uncachedEmails.length} uncached emails for metric extraction`);

    // Extract metrics only for emails not seen before
    const t1 = Date.now();
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
              confidence: "high" | "medium" | "low";
            }>
          >();

    const allMetrics: Array<{
      metricName: string;
      value: number;
      unit: string;
      referenceMin?: number;
      referenceMax?: number;
      isAbnormal: boolean;
      confidence: "high" | "medium" | "low";
      measuredAt: Date;
    }> = [];

    const dbMetrics: Array<{
      metricName: string;
      value: number;
      unit: string;
      referenceMin: number | null;
      referenceMax: number | null;
      isAbnormal: boolean;
      confidence: string;
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
          confidence: m.confidence || "high",
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
          confidence: (m.confidence as "high" | "medium" | "low") || "high",
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
          confidence: metric.confidence || "high",
          measuredAt: email.date || new Date(),
          patientId: reportRecord!.patientId,
          reportId,
        };

        dbMetrics.push(metricData);
        allMetrics.push({
          ...metricData,
          confidence: metricData.confidence as "high" | "medium" | "low",
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

    console.log(`[process-report] Step 1 (metric extraction + DB write): ${((Date.now() - t1) / 1000).toFixed(1)}s — ${allMetrics.length} metrics`);

    // Detect trends across all patient history
    const t2 = Date.now();
    const trendAlerts = await detectTrends(reportRecord!.patientId, allMetrics);

    // Detect deterministic clinical correlations (latest values only)
    const latestByMetric = new Map<string, typeof allMetrics[0]>();
    for (const m of allMetrics) {
      const existing = latestByMetric.get(m.metricName);
      if (!existing || m.measuredAt > existing.measuredAt) {
        latestByMetric.set(m.metricName, m);
      }
    }
    const clinicalCorrelations = detectClinicalCorrelations(
      [...latestByMetric.values()],
      patientAge,
      patientGender
    );
    if (clinicalCorrelations.length > 0) {
      console.log(`[processReport] ${clinicalCorrelations.length} clinical correlations detected:`,
        clinicalCorrelations.map((c) => c.pattern));
    }

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

    // Save partial results — charts, scorecard, trends are viewable immediately
    await prisma.report.update({
      where: { id: reportId },
      data: {
        trendAlerts: trendAlerts.length > 0 ? JSON.stringify(trendAlerts) : null,
        clinicalCorrelations: clinicalCorrelations.length > 0 ? JSON.stringify(clinicalCorrelations) : null,
        step: "generating_summary",
        status: "partial",
      },
    });
    console.log(`[process-report] Partial results saved — charts/trends viewable now`);

    // Only send dates + subjects, not full email bodies — the metrics are already extracted
    const emailSummaries = labEmails.map((e) => {
      const dateStr = e.date ? e.date.toISOString().split("T")[0] : "unknown date";
      return `Date: ${dateStr}\nSubject: ${e.subject}`;
    });

    console.log(`[process-report] Trends + correlations: ${((Date.now() - t2) / 1000).toFixed(1)}s`);

    const t3 = Date.now();
    const { summary, attentionPoints } =
      await generateSummaryAndAttentionPoints(
        patientName,
        emailSummaries,
        metricsForSummary.map((m) => ({
          metricName: m.metricName,
          value: m.value,
          unit: m.unit,
          isAbnormal: m.isAbnormal,
          measuredAt: m.measuredAt.toISOString().split("T")[0],
        })),
        reportType,
        format,
        { ...aiOptions, trendAlerts, clinicalCorrelations, verify: false }
      );

    console.log(`[process-report] Step 2 (summary generation): ${((Date.now() - t3) / 1000).toFixed(1)}s`);
    console.log(`[process-report] Total: ${((Date.now() - t1) / 1000).toFixed(1)}s`);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        summary,
        attentionPoints: JSON.stringify(attentionPoints),
        trendAlerts: trendAlerts.length > 0 ? JSON.stringify(trendAlerts) : null,
        clinicalCorrelations: clinicalCorrelations.length > 0 ? JSON.stringify(clinicalCorrelations) : null,
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
