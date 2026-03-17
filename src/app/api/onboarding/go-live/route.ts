import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/settings";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Clean up demo data: delete patients with demo government IDs
  const demoGovIds = ["12345678901", "98765432109", "55566677788"];

  const demoPatients = await prisma.patient.findMany({
    where: { userId, governmentId: { in: demoGovIds } },
    select: { id: true },
  });

  if (demoPatients.length > 0) {
    const patientIds = demoPatients.map((p) => p.id);

    // Delete in correct order to respect FK constraints
    await prisma.reportEmail.deleteMany({
      where: { report: { patientId: { in: patientIds } } },
    });
    await prisma.bloodMetric.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await prisma.report.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await prisma.email.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    await prisma.patient.deleteMany({
      where: { id: { in: patientIds } },
    });
  }

  // Update settings: disable demo mode
  await getOrCreateSettings(userId);
  await prisma.userSettings.update({
    where: { userId },
    data: { isDemoMode: false },
  });

  return NextResponse.json({ message: "Demo data cleaned, live mode activated" });
}
