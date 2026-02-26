import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, patientMergeSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, patientMergeSchema);
  if (!parsed.success) return parsed.response;
  const { sourcePatientId, targetPatientId } = parsed.data;

  if (sourcePatientId === targetPatientId) {
    return NextResponse.json(
      { error: "Source and target patients must be different" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  const [source, target] = await Promise.all([
    prisma.patient.findFirst({ where: { id: sourcePatientId, userId } }),
    prisma.patient.findFirst({ where: { id: targetPatientId, userId } }),
  ]);

  if (!source || !target) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Move all emails from source to target
  await prisma.email.updateMany({
    where: { patientId: sourcePatientId },
    data: { patientId: targetPatientId },
  });

  // Move all blood metrics from source to target
  await prisma.bloodMetric.updateMany({
    where: { patientId: sourcePatientId },
    data: { patientId: targetPatientId },
  });

  // Move all reports from source to target
  await prisma.report.updateMany({
    where: { patientId: sourcePatientId },
    data: { patientId: targetPatientId },
  });

  // Delete source patient
  await prisma.patient.delete({ where: { id: sourcePatientId } });

  return NextResponse.json({ success: true, targetPatientId });
}
