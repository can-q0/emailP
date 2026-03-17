import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSearchParams, progressiveSearchSchema } from "@/lib/validations";
import { normalizeMetricName } from "@/lib/blood-metrics";
import { trStripDiacritics } from "@/lib/turkish";

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
  // Stripped version for diacritics-insensitive matching (e.g. "Arpaci" matches "Arpacı")
  const namePrefixStripped = trStripDiacritics(namePrefix);

  // ── 1. Find patients — three strategies run in parallel ──
  //
  // Strategy A: Patient.name startsWith the typed prefix (Prisma insensitive)
  // Strategy B: Email.subject contains the typed name
  // Strategy C: Fetch all user's patients and filter with diacritics-stripped matching
  //   This catches cases where "Arpaci" should match "Arpacı"

  const patientFilter: Record<string, unknown> = { userId };
  if (gender) patientFilter.gender = gender;
  if (birthYear) patientFilter.birthYear = birthYear;

  const patientSelect = {
    id: true, name: true, governmentId: true, gender: true, birthYear: true,
    _count: { select: { emails: true, bloodMetrics: true } },
  } as const;

  const [patientsByName, emailsBySubject, allPatients] = await Promise.all([
    // Strategy A: patient name prefix (Prisma case-insensitive)
    prisma.patient.findMany({
      where: { ...patientFilter, name: { startsWith: namePrefix, mode: "insensitive" } },
      select: patientSelect,
    }),
    // Strategy B: email subject contains name
    prisma.email.findMany({
      where: {
        userId,
        subject: { contains: namePrefix, mode: "insensitive" },
        patientId: { not: null },
      },
      select: { patientId: true },
      distinct: ["patientId"],
    }),
    // Strategy C: all patients for diacritics-stripped matching
    prisma.patient.findMany({
      where: patientFilter,
      select: patientSelect,
    }),
  ]);

  // Merge results from all strategies
  const patientMap = new Map<string, typeof patientsByName[0]>();

  // Add Strategy A results
  for (const p of patientsByName) {
    patientMap.set(p.id, p);
  }

  // Add Strategy C results (diacritics-stripped fuzzy match)
  for (const p of allPatients) {
    if (!patientMap.has(p.id) && trStripDiacritics(p.name).startsWith(namePrefixStripped)) {
      patientMap.set(p.id, p);
    }
  }

  // Add Strategy B results (email subject matches → resolve patient)
  const extraIds = emailsBySubject
    .map((e) => e.patientId)
    .filter((id): id is string => id !== null && !patientMap.has(id));

  if (extraIds.length > 0) {
    const extraPatients = await prisma.patient.findMany({
      where: { id: { in: extraIds }, ...patientFilter },
      select: patientSelect,
    });
    for (const p of extraPatients) {
      patientMap.set(p.id, p);
    }
  }

  // Also check email subjects with stripped diacritics
  if (patientMap.size === 0) {
    // Fallback: search emails with stripped query
    const emailsFallback = await prisma.email.findMany({
      where: { userId, patientId: { not: null } },
      select: { patientId: true, subject: true },
      distinct: ["patientId"],
    });
    const fallbackIds = emailsFallback
      .filter((e) => e.subject && trStripDiacritics(e.subject).includes(namePrefixStripped))
      .map((e) => e.patientId)
      .filter((id): id is string => id !== null);

    if (fallbackIds.length > 0) {
      const fallbackPatients = await prisma.patient.findMany({
        where: { id: { in: [...new Set(fallbackIds)] }, ...patientFilter },
        select: patientSelect,
      });
      for (const p of fallbackPatients) {
        patientMap.set(p.id, p);
      }
    }
  }

  const patients = [...patientMap.values()];
  const patientIds = patients.map((p) => p.id);

  if (patientIds.length === 0) {
    return NextResponse.json(EMPTY);
  }

  // ── 2. Find matching emails ────────────────────────────

  const emailWhere: Record<string, unknown> = {
    patientId: { in: patientIds },
    isLabReport: true,
  };

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

  const emails = await prisma.email.findMany({
    where: emailWhere,
    select: {
      id: true, subject: true, from: true, date: true,
      snippet: true, pdfPath: true, patientId: true,
      patient: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 50,
  });

  // ── 3. Find matching blood metrics ─────────────────────

  const metricWhere: Record<string, unknown> = {
    patientId: { in: patientIds },
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
    metricWhere.metricName = normalizeMetricName(metricName);
  }

  if (metricName && operator && metricValue !== undefined) {
    const opMap: Record<string, string> = { lt: "lt", gt: "gt", lte: "lte", gte: "gte", eq: "equals" };
    const prismaOp = opMap[operator];
    if (prismaOp) {
      metricWhere.value = { [prismaOp]: metricValue };
    }
  }

  const metrics = await prisma.bloodMetric.findMany({
    where: metricWhere,
    select: {
      id: true, metricName: true, value: true, unit: true,
      referenceMin: true, referenceMax: true, isAbnormal: true, measuredAt: true,
    },
    orderBy: { measuredAt: "asc" },
    take: 200,
  });

  // ── 4. Build stats ─────────────────────────────────────

  const abnormalCount = metrics.filter((m) => m.isAbnormal).length;
  const dates = emails.map((e) => e.date).filter((d): d is Date => d !== null);
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
    emails: emails.map((e) => ({
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
      totalEmails: emails.length,
      totalMetrics: metrics.length,
      abnormalCount,
      uniquePatients: patientIds.length,
      dateRange,
    },
  });
}
