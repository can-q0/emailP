import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSearchParams, parseBody, patientSearchSchema, patientUpdateSchema, reportIdSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, patientSearchSchema);
  if (!parsed.success) return parsed.response;
  const query = parsed.data.q || "";

  const patients = await prisma.patient.findMany({
    where: {
      userId: session.user.id,
      ...(query ? { name: { contains: query } } : {}),
    },
    include: {
      _count: { select: { emails: true, reports: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    patients.map((p) => ({
      id: p.id,
      name: p.name,
      governmentId: p.governmentId,
      email: p.email,
      emailCount: p._count.emails,
      reportCount: p._count.reports,
    }))
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
