import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  classifyEmail,
  extractBloodMetrics,
  generateSummary,
  generateAttentionPoints,
} from "@/lib/openai";
import { normalizeMetricName, getMetricReference } from "@/lib/blood-metrics";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { patientId, emailIds, title } = await req.json();

  if (!patientId || !emailIds?.length) {
    return NextResponse.json(
      { error: "Patient ID and email IDs required" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Verify patient and emails belong to user
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

  // Create report
  const report = await prisma.report.create({
    data: {
      title: title || `Report for ${patient.name}`,
      patientId,
      userId,
      status: "processing",
      step: "classifying",
      reportEmails: {
        create: emails.map((e) => ({ emailId: e.id })),
      },
    },
  });

  // Process asynchronously
  processReport(report.id, patient.name, emails, userId).catch(console.error);

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
  userId: string
) {
  try {
    // Step 1: Classify emails
    await prisma.report.update({
      where: { id: reportId },
      data: { step: "classifying" },
    });

    const labEmails: typeof emails = [];
    for (const email of emails) {
      if (!email.body) continue;
      const classification = await classifyEmail(
        email.body,
        email.subject || ""
      );

      await prisma.email.update({
        where: { id: email.id },
        data: {
          isLabReport: classification.isLabReport,
          extractedData: JSON.parse(JSON.stringify(classification)),
        },
      });

      if (classification.isLabReport) {
        labEmails.push(email);
      }
    }

    // Step 2: Extract blood metrics
    await prisma.report.update({
      where: { id: reportId },
      data: { step: "extracting_metrics" },
    });

    const allMetrics: Array<{
      metricName: string;
      value: number;
      unit: string;
      referenceMin?: number;
      referenceMax?: number;
      isAbnormal: boolean;
      measuredAt: Date;
    }> = [];

    for (const email of labEmails) {
      if (!email.body) continue;
      const metrics = await extractBloodMetrics(email.body);

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
          patientId: (
            await prisma.report.findUnique({
              where: { id: reportId },
              select: { patientId: true },
            })
          )!.patientId,
          reportId,
        };

        await prisma.bloodMetric.create({ data: metricData });

        allMetrics.push({
          ...metricData,
          referenceMin: metricData.referenceMin ?? undefined,
          referenceMax: metricData.referenceMax ?? undefined,
        });
      }
    }

    // Step 3: Generate summary
    await prisma.report.update({
      where: { id: reportId },
      data: { step: "generating_summary" },
    });

    const emailSummaries = labEmails.map((e) => {
      const dateStr = e.date ? e.date.toISOString().split("T")[0] : "unknown date";
      return `Date: ${dateStr}\nSubject: ${e.subject}\n\n${e.body?.slice(0, 2000)}`;
    });

    const summary = await generateSummary(patientName, emailSummaries);

    await prisma.report.update({
      where: { id: reportId },
      data: { summary },
    });

    // Step 4: Generate attention points
    await prisma.report.update({
      where: { id: reportId },
      data: { step: "generating_attention_points" },
    });

    const attentionPoints = await generateAttentionPoints(
      patientName,
      allMetrics.map((m) => ({
        metricName: m.metricName,
        value: m.value,
        unit: m.unit,
        isAbnormal: m.isAbnormal,
        measuredAt: m.measuredAt.toISOString(),
      })),
      summary
    );

    await prisma.report.update({
      where: { id: reportId },
      data: {
        attentionPoints: JSON.parse(JSON.stringify(attentionPoints)),
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
