import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { patientId } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId: session.user.id },
    include: {
      _count: { select: { emails: true, reports: true, bloodMetrics: true } },
      emails: {
        orderBy: { date: "desc" },
        select: {
          id: true,
          gmailMessageId: true,
          subject: true,
          from: true,
          date: true,
          snippet: true,
          isLabReport: true,
        },
      },
      reports: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          reportType: true,
          format: true,
          createdAt: true,
        },
      },
      bloodMetrics: {
        orderBy: { measuredAt: "desc" },
        select: {
          id: true,
          metricName: true,
          value: true,
          unit: true,
          referenceMin: true,
          referenceMax: true,
          isAbnormal: true,
          measuredAt: true,
        },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Build latest metrics: one per metric name (the most recent measurement)
  const latestByMetric = new Map<
    string,
    {
      metricName: string;
      value: number;
      unit: string;
      referenceMin: number | null;
      referenceMax: number | null;
      isAbnormal: boolean;
      measuredAt: string;
      previousValue: number | null;
    }
  >();

  for (const m of patient.bloodMetrics) {
    if (!latestByMetric.has(m.metricName)) {
      latestByMetric.set(m.metricName, {
        metricName: m.metricName,
        value: m.value,
        unit: m.unit,
        referenceMin: m.referenceMin,
        referenceMax: m.referenceMax,
        isAbnormal: m.isAbnormal,
        measuredAt: m.measuredAt.toISOString(),
        previousValue: null,
      });
    } else {
      // Second occurrence = previous value (since ordered desc)
      const existing = latestByMetric.get(m.metricName)!;
      if (existing.previousValue === null) {
        existing.previousValue = m.value;
      }
    }
  }

  return NextResponse.json({
    id: patient.id,
    name: patient.name,
    governmentId: patient.governmentId,
    email: patient.email,
    birthYear: patient.birthYear,
    gender: patient.gender,
    emailCount: patient._count.emails,
    reportCount: patient._count.reports,
    metricCount: patient._count.bloodMetrics,
    emails: patient.emails.map((e) => ({
      id: e.id,
      gmailMessageId: e.gmailMessageId,
      subject: e.subject,
      from: e.from,
      date: e.date?.toISOString() || null,
      snippet: e.snippet,
      isLabReport: e.isLabReport,
    })),
    reports: patient.reports.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      reportType: r.reportType,
      format: r.format,
      createdAt: r.createdAt.toISOString(),
    })),
    latestMetrics: Array.from(latestByMetric.values()).sort((a, b) => {
      // Abnormal first, then alphabetical
      if (a.isAbnormal !== b.isAbnormal) return a.isAbnormal ? -1 : 1;
      return a.metricName.localeCompare(b.metricName);
    }),
    allMetrics: patient.bloodMetrics.map((m) => ({
      id: m.id,
      metricName: m.metricName,
      value: m.value,
      unit: m.unit,
      referenceMin: m.referenceMin,
      referenceMax: m.referenceMax,
      isAbnormal: m.isAbnormal,
      measuredAt: m.measuredAt.toISOString(),
    })),
  });
}
