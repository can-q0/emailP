import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { parseBody, userSettingsUpdateSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getOrCreateSettings(session.user.id);
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, userSettingsUpdateSchema);
  if (!parsed.success) return parsed.response;

  // Ensure settings row exists
  await getOrCreateSettings(session.user.id);

  const updated = await prisma.userSettings.update({
    where: { userId: session.user.id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
