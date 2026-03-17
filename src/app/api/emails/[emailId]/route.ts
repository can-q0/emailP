import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId } = await params;

  const email = await prisma.email.findFirst({
    where: { id: emailId, userId: session.user.id },
    select: {
      id: true,
      subject: true,
      from: true,
      date: true,
      body: true,
      snippet: true,
      pdfPath: true,
      patient: { select: { name: true } },
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: email.id,
    subject: email.subject,
    from: email.from,
    date: email.date?.toISOString(),
    body: email.body,
    snippet: email.snippet,
    pdfPath: email.pdfPath,
    patientName: email.patient?.name,
  });
}
