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

  // Verify patient belongs to user
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId: session.user.id },
    select: { id: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Get all blood metrics for this patient, grouped by date
  const metrics = await prisma.bloodMetric.findMany({
    where: { patientId },
    select: { measuredAt: true, metricName: true },
    orderBy: { measuredAt: "asc" },
  });

  // Group by day
  const dateMap = new Map<string, { date: string; metricCount: number; metricNames: Set<string> }>();

  for (const m of metrics) {
    const dayKey = m.measuredAt.toISOString().split("T")[0];
    const existing = dateMap.get(dayKey);
    if (existing) {
      existing.metricCount++;
      existing.metricNames.add(m.metricName);
    } else {
      dateMap.set(dayKey, {
        date: m.measuredAt.toISOString(),
        metricCount: 1,
        metricNames: new Set([m.metricName]),
      });
    }
  }

  const testDates = Array.from(dateMap.values()).map((d) => ({
    date: d.date,
    metricCount: d.metricNames.size,
  }));

  return NextResponse.json(testDates);
}
