import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readEmailPdf } from "@/lib/pdf-storage";

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
    select: { pdfPath: true },
  });

  if (!email?.pdfPath) {
    return NextResponse.json({ error: "No PDF attachment" }, { status: 404 });
  }

  const buffer = await readEmailPdf(email.pdfPath);
  if (!buffer) {
    return NextResponse.json({ error: "PDF file not found" }, { status: 404 });
  }

  const filename = email.pdfPath.split("/").pop() || "attachment.pdf";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
