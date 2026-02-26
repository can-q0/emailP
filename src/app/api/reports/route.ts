import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSearchParams, reportIdSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reportId = req.nextUrl.searchParams.get("id");

  if (reportId) {
    const report = await prisma.report.findUnique({
      where: { id: reportId, userId: session.user.id },
      include: {
        patient: true,
        bloodMetrics: { orderBy: { measuredAt: "asc" } },
        reportEmails: {
          include: {
            email: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...report,
      attentionPoints: report.attentionPoints
        ? JSON.parse(report.attentionPoints)
        : [],
      emails: report.reportEmails.map((re) => re.email),
    });
  }

  const reports = await prisma.report.findMany({
    where: { userId: session.user.id },
    include: {
      patient: { select: { id: true, name: true } },
      _count: { select: { bloodMetrics: true, reportEmails: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reports);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, reportIdSchema);
  if (!parsed.success) return parsed.response;
  const { id } = parsed.data;

  const report = await prisma.report.findUnique({
    where: { id, userId: session.user.id },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Delete blood metrics tied to this report (no cascade on that relation)
  await prisma.bloodMetric.deleteMany({ where: { reportId: id } });
  // Delete report (reportEmails cascade automatically)
  await prisma.report.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
