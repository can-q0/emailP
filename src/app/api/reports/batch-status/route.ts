import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
  }

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0 || ids.length > 50) {
    return NextResponse.json({ error: "Invalid ids parameter" }, { status: 400 });
  }

  const reports = await prisma.report.findMany({
    where: {
      id: { in: ids },
      userId: session.user.id,
    },
    select: {
      id: true,
      status: true,
      step: true,
      title: true,
      patient: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(reports);
}
