import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getOrCreateSettings(session.user.id);
  return NextResponse.json({
    onboardingCompleted: settings.onboardingCompleted,
    completedTours: settings.completedTours,
    isDemoMode: settings.isDemoMode,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await getOrCreateSettings(session.user.id);

  const data: Record<string, unknown> = {};
  if (typeof body.onboardingCompleted === "boolean") data.onboardingCompleted = body.onboardingCompleted;
  if (typeof body.completedTours === "string") data.completedTours = body.completedTours;
  if (typeof body.isDemoMode === "boolean") data.isDemoMode = body.isDemoMode;

  const updated = await prisma.userSettings.update({
    where: { userId: session.user.id },
    data,
  });

  return NextResponse.json({
    onboardingCompleted: updated.onboardingCompleted,
    completedTours: updated.completedTours,
    isDemoMode: updated.isDemoMode,
  });
}
