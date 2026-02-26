import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendReportEmail } from "@/lib/resend";
import { parseBody, reportSendSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, reportSendSchema);
  if (!parsed.success) return parsed.response;
  const { reportId, recipientEmail } = parsed.data;

  const report = await prisma.report.findUnique({
    where: { id: reportId, userId: session.user.id },
    include: { patient: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.status !== "completed") {
    return NextResponse.json(
      { error: "Report is not yet completed" },
      { status: 400 }
    );
  }

  const attentionPoints = report.attentionPoints
    ? JSON.parse(report.attentionPoints)
    : [];

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
  const reportUrl = `${baseUrl}/report/${reportId}`;

  try {
    const result = await sendReportEmail({
      to: recipientEmail,
      patientName: report.patient.name,
      reportTitle: report.title,
      summary: report.summary || "No summary available.",
      attentionPoints,
      reportUrl,
    });

    return NextResponse.json({ success: true, emailId: result?.id });
  } catch (error) {
    console.error("Failed to send report email:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 }
    );
  }
}
