import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSearchParams, reportIdSchema } from "@/lib/validations";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, reportIdSchema);
  if (!parsed.success) return parsed.response;
  const { id } = parsed.data;

  const report = await prisma.report.findUnique({
    where: { id, userId: session.user.id },
    include: {
      patient: true,
      bloodMetrics: { orderBy: { measuredAt: "asc" } },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Blood Metrics
  const metricsSheet = workbook.addWorksheet("Blood Metrics");

  // Patient info header
  metricsSheet.addRow(["Patient", report.patient.name]);
  if (report.patient.governmentId) {
    metricsSheet.addRow(["Government ID", report.patient.governmentId]);
  }
  metricsSheet.addRow(["Report", report.title]);
  metricsSheet.addRow(["Generated", new Date(report.createdAt).toLocaleDateString()]);
  metricsSheet.addRow([]);

  // Table headers
  const headerRow = metricsSheet.addRow([
    "Metric",
    "Value",
    "Unit",
    "Ref Min",
    "Ref Max",
    "Status",
    "Date",
  ]);
  headerRow.font = { bold: true };

  for (const metric of report.bloodMetrics) {
    metricsSheet.addRow([
      metric.metricName,
      metric.value,
      metric.unit,
      metric.referenceMin ?? "",
      metric.referenceMax ?? "",
      metric.isAbnormal ? "Abnormal" : "Normal",
      metric.measuredAt ? new Date(metric.measuredAt).toLocaleDateString() : "",
    ]);
  }

  // Auto-width columns
  metricsSheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });

  // Sheet 2: Attention Points (if present)
  const attentionPoints = report.attentionPoints
    ? JSON.parse(report.attentionPoints as string)
    : [];

  if (attentionPoints.length > 0) {
    const attentionSheet = workbook.addWorksheet("Attention Points");
    const apHeader = attentionSheet.addRow([
      "Severity",
      "Title",
      "Description",
      "Recommendations",
    ]);
    apHeader.font = { bold: true };

    for (const point of attentionPoints) {
      attentionSheet.addRow([
        point.severity,
        point.title,
        point.description,
        Array.isArray(point.recommendations)
          ? point.recommendations.join("; ")
          : "",
      ]);
    }

    attentionSheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? "").length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 60);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${report.patient.name.replace(/[^a-zA-Z0-9]/g, "_")}_report.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
