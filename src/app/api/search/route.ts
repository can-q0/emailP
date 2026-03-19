import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSearchParams, progressiveSearchSchema } from "@/lib/validations";
import { normalizeMetricName } from "@/lib/blood-metrics";
import { bloodMetricReferences } from "@/config/blood-metrics";
import { trStripDiacritics } from "@/lib/turkish";

/** Build search variants for a metric key so we match AI-generated DB names. */
function metricNameVariants(key: string): string[] {
  const variants = new Set<string>([key]);
  const ref = bloodMetricReferences[key];
  if (ref) {
    variants.add(ref.name.toLowerCase());           // "Red Blood Cells"
    variants.add(ref.trName.toLowerCase());          // "Eritrosit"
    variants.add(ref.name.toLowerCase().replace(/s$/, "")); // "Red Blood Cell" (stem)
  }
  return [...variants];
}

const EMPTY = {
  patients: [],
  emails: [],
  metrics: [],
  stats: { totalEmails: 0, totalMetrics: 0, abnormalCount: 0, uniquePatients: 0 },
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, progressiveSearchSchema);
  if (!parsed.success) return parsed.response;
  const { firstName, lastName, year, month, labCode, gender, birthYear, metricName, operator, metricValue } = parsed.data;

  if (!firstName) {
    return NextResponse.json(EMPTY);
  }

  const userId = session.user.id;
  const namePrefix = lastName ? `${firstName} ${lastName}` : firstName;
  const namePrefixStripped = trStripDiacritics(namePrefix);

  // ── 1. Search emails by subject first ───────────────────
  //
  // Primary: find emails whose subject contains the query.
  // This is the source of truth — patients are derived from matching emails.

  const emailWhere: Record<string, unknown> = { userId };

  // Date filters
  if (year) {
    if (month) {
      emailWhere.date = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      };
    } else {
      emailWhere.date = {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      };
    }
  }

  if (labCode) {
    emailWhere.OR = [
      { from: { contains: labCode, mode: "insensitive" } },
      { subject: { contains: labCode, mode: "insensitive" } },
    ];
  }

  // Two parallel strategies for subject matching:
  // A) Prisma case-insensitive ILIKE
  // B) Diacritics-stripped fallback (for Turkish chars)
  const [emailsByIlike, allUserEmails] = await Promise.all([
    prisma.email.findMany({
      where: {
        ...emailWhere,
        subject: { contains: namePrefix, mode: "insensitive" },
      },
      select: {
        id: true, subject: true, from: true, date: true,
        snippet: true, pdfPath: true, patientId: true,
        patient: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    // Fetch all user emails for diacritics fallback (only subjects needed)
    prisma.email.findMany({
      where: emailWhere,
      select: {
        id: true, subject: true, from: true, date: true,
        snippet: true, pdfPath: true, patientId: true,
        patient: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 200,
    }),
  ]);

  // Merge: ILIKE results + diacritics-stripped matches
  const emailMap = new Map<string, typeof emailsByIlike[0]>();
  for (const e of emailsByIlike) {
    emailMap.set(e.id, e);
  }
  for (const e of allUserEmails) {
    if (!emailMap.has(e.id) && e.subject && trStripDiacritics(e.subject).includes(namePrefixStripped)) {
      emailMap.set(e.id, e);
    }
  }

  const emails = [...emailMap.values()]
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, 50);

  if (emails.length === 0) {
    return NextResponse.json(EMPTY);
  }

  // ── 2. Derive patients from matching emails ─────────────

  const patientIds = [...new Set(
    emails.map((e) => e.patientId).filter((id): id is string => id !== null)
  )];

  const patientSelect = {
    id: true, name: true, governmentId: true, gender: true, birthYear: true,
    _count: { select: { emails: true, bloodMetrics: true } },
  } as const;

  let patients: Array<{
    id: string; name: string; governmentId: string | null;
    gender: string | null; birthYear: number | null;
    _count: { emails: number; bloodMetrics: number };
  }> = [];

  if (patientIds.length > 0) {
    const patientFilter: Record<string, unknown> = {
      id: { in: patientIds },
      userId,
    };
    if (gender) patientFilter.gender = gender;
    if (birthYear) patientFilter.birthYear = birthYear;

    patients = await prisma.patient.findMany({
      where: patientFilter,
      select: patientSelect,
    });
  }

  // ── 3. Find matching blood metrics ──────────────────────

  const metricPatientIds = patients.map((p) => p.id);
  const hasMetricFilter = !!(metricName && operator && metricValue !== undefined);

  let metrics: Array<{
    id: string; metricName: string; value: number; unit: string;
    referenceMin: number | null; referenceMax: number | null;
    isAbnormal: boolean; measuredAt: Date;
    reportId: string | null;
  }> = [];

  if (metricPatientIds.length > 0) {
    const metricWhere: Record<string, unknown> = {
      patientId: { in: metricPatientIds },
    };

    if (year) {
      if (month) {
        metricWhere.measuredAt = {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        };
      } else {
        metricWhere.measuredAt = {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        };
      }
    }

    if (metricName) {
      const normalized = normalizeMetricName(metricName);
      const variants = metricNameVariants(normalized);
      // Match any variant via case-insensitive contains
      metricWhere.OR = variants.map((v) => ({
        metricName: { contains: v, mode: "insensitive" },
      }));
    }

    if (hasMetricFilter) {
      const opMap: Record<string, string> = { lt: "lt", gt: "gt", lte: "lte", gte: "gte", eq: "equals" };
      const prismaOp = opMap[operator!];
      if (prismaOp) {
        metricWhere.value = { [prismaOp]: metricValue };
      }
    }

    metrics = await prisma.bloodMetric.findMany({
      where: metricWhere,
      select: {
        id: true, metricName: true, value: true, unit: true,
        referenceMin: true, referenceMax: true, isAbnormal: true, measuredAt: true,
        reportId: true,
      },
      orderBy: { measuredAt: "asc" },
      take: 200,
    });
  }

  // ── 3b. Filter emails by metric matches ─────────────────
  //
  // When a metric filter is active (e.g. "kan şekeri > 100"),
  // match metrics to emails by date (metric.measuredAt ≈ email.date).

  let filteredEmails = emails;

  if (hasMetricFilter && metrics.length > 0) {
    // Build set of metric dates (as date strings for comparison)
    const metricDates = new Set(
      metrics.map((m) => m.measuredAt.toISOString().slice(0, 10))
    );
    filteredEmails = emails.filter((e) =>
      e.date && metricDates.has(e.date.toISOString().slice(0, 10))
    );
  } else if (hasMetricFilter && metrics.length === 0 && metricPatientIds.length > 0) {
    // Metric filter active but no matching metrics found — show no emails
    filteredEmails = [];
  }

  // ── 4. Build stats ──────────────────────────────────────

  const abnormalCount = metrics.filter((m) => m.isAbnormal).length;
  const dates = filteredEmails.map((e) => e.date).filter((d): d is Date => d !== null);
  const dateRange = dates.length > 0
    ? {
        from: new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString(),
        to: new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString(),
      }
    : undefined;

  return NextResponse.json({
    patients: patients.map((p) => ({
      id: p.id,
      name: p.name,
      governmentId: p.governmentId,
      gender: p.gender,
      birthYear: p.birthYear,
      emailCount: p._count.emails,
      metricCount: p._count.bloodMetrics,
    })),
    emails: filteredEmails.map((e) => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      date: e.date?.toISOString(),
      snippet: e.snippet,
      pdfPath: e.pdfPath,
      patientName: e.patient?.name,
    })),
    metrics: metrics.map((m) => ({
      id: m.id,
      metricName: m.metricName,
      value: m.value,
      unit: m.unit,
      referenceMin: m.referenceMin,
      referenceMax: m.referenceMax,
      isAbnormal: m.isAbnormal,
      measuredAt: m.measuredAt.toISOString(),
    })),
    stats: {
      totalEmails: filteredEmails.length,
      totalMetrics: metrics.length,
      abnormalCount,
      uniquePatients: patients.length,
      dateRange,
    },
  });
}
