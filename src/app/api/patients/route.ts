import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSearchParams, parseBody, patientSearchSchema, patientUpdateSchema, reportIdSchema } from "@/lib/validations";

const SORT_MAP: Record<string, { field: string; direction: "asc" | "desc" }> = {
  "name-asc": { field: "name", direction: "asc" },
  "name-desc": { field: "name", direction: "desc" },
  "emails": { field: "emails", direction: "desc" },
  "updated": { field: "updatedAt", direction: "desc" },
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, patientSearchSchema);
  if (!parsed.success) return parsed.response;
  const query = parsed.data.q || "";
  const sortKey = parsed.data.sort || "updated";
  const sortConfig = SORT_MAP[sortKey] || SORT_MAP["updated"];

  const orderBy =
    sortConfig.field === "emails"
      ? { emails: { _count: sortConfig.direction as "asc" | "desc" } }
      : { [sortConfig.field]: sortConfig.direction };

  const patients = await prisma.patient.findMany({
    where: {
      userId: session.user.id,
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    include: {
      _count: { select: { emails: true, reports: true, bloodMetrics: true } },
      emails: {
        where: { date: { not: null } },
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
      bloodMetrics: {
        orderBy: { measuredAt: "desc" },
        take: 30,
        select: { metricName: true, value: true, unit: true, referenceMin: true, referenceMax: true, isAbnormal: true, measuredAt: true },
      },
    },
    orderBy,
    take: 50,
  });

  return NextResponse.json(
    patients.map((p) => {
      // Build sparkline data: top 2 metrics by data-point count, last 6 values each
      const metricGroups = new Map<string, { values: number[]; unit: string; refMin: number | null; refMax: number | null; isAbnormal: boolean }>();
      for (const m of p.bloodMetrics) {
        const group = metricGroups.get(m.metricName);
        if (group) {
          if (group.values.length < 6) group.values.push(m.value);
        } else {
          metricGroups.set(m.metricName, {
            values: [m.value],
            unit: m.unit,
            refMin: m.referenceMin,
            refMax: m.referenceMax,
            isAbnormal: m.isAbnormal,
          });
        }
      }

      // Pick top 2 metrics with the most data points (min 2 needed for sparkline)
      const sparklines = [...metricGroups.entries()]
        .filter(([, g]) => g.values.length >= 2)
        .sort((a, b) => b[1].values.length - a[1].values.length)
        .slice(0, 2)
        .map(([name, g]) => ({
          name,
          values: g.values.reverse(), // chronological order
          unit: g.unit,
          refMin: g.refMin,
          refMax: g.refMax,
          isAbnormal: g.isAbnormal,
        }));

      // Abnormal metrics (top 3)
      const abnormalMetrics = p.bloodMetrics
        .filter((m) => m.isAbnormal)
        .slice(0, 3)
        .map((m) => ({
          name: m.metricName,
          value: m.value,
          unit: m.unit,
          refMin: m.referenceMin,
          refMax: m.referenceMax,
        }));

      return {
        id: p.id,
        name: p.name,
        governmentId: p.governmentId,
        email: p.email,
        birthYear: p.birthYear,
        gender: p.gender,
        emailCount: p._count.emails,
        reportCount: p._count.reports,
        metricCount: p._count.bloodMetrics,
        lastEmailDate: p.emails[0]?.date?.toISOString() || null,
        abnormalMetrics,
        sparklines,
      };
    })
  );
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paramsParsed = parseSearchParams(req, reportIdSchema);
  if (!paramsParsed.success) return paramsParsed.response;
  const { id } = paramsParsed.data;

  const bodyParsed = await parseBody(req, patientUpdateSchema);
  if (!bodyParsed.success) return bodyParsed.response;

  const patient = await prisma.patient.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const updated = await prisma.patient.update({
    where: { id },
    data: bodyParsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, reportIdSchema);
  if (!parsed.success) return parsed.response;
  const { id } = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Nullify emails' patientId so emails are preserved
  await prisma.email.updateMany({
    where: { patientId: id },
    data: { patientId: null },
  });

  // Delete patient (reports + blood metrics cascade via schema)
  await prisma.patient.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
