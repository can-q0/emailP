import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q") || "";

  const patients = await prisma.patient.findMany({
    where: {
      userId: session.user.id,
      name: { contains: query, mode: "insensitive" },
    },
    include: {
      _count: { select: { emails: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    patients.map((p) => ({
      id: p.id,
      name: p.name,
      governmentId: p.governmentId,
      email: p.email,
      emailCount: p._count.emails,
    }))
  );
}
