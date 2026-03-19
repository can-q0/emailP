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
    select: { pdfPath: true, pdfData: true },
  });

  if (!email?.pdfData) {
    return NextResponse.json({ error: "No PDF attachment" }, { status: 404 });
  }

  const filename = email.pdfPath || "attachment.pdf";

  return new NextResponse(new Uint8Array(email.pdfData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
