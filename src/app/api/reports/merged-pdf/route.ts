import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument } from "pdf-lib";

/**
 * GET /api/reports/merged-pdf?id=reportId
 * Merges all cached email PDFs from a report into one downloadable PDF.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportId = req.nextUrl.searchParams.get("id");
    if (!reportId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId, userId: session.user.id },
      include: {
        patient: { select: { name: true } },
        reportEmails: {
          include: {
            email: { select: { id: true, pdfData: true, pdfPath: true, subject: true, date: true } },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Collect emails with PDF data, sorted by date
    const emailsWithPdf = report.reportEmails
      .map((re) => re.email)
      .filter((e) => e.pdfData)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    if (emailsWithPdf.length === 0) {
      return NextResponse.json({ error: "No PDFs found for this report" }, { status: 404 });
    }

    const mergedPdf = await PDFDocument.create();

    for (const email of emailsWithPdf) {
      try {
        const buffer = Buffer.from(email.pdfData!);
        const sourcePdf = await PDFDocument.load(buffer);
        const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        for (const page of pages) mergedPdf.addPage(page);
      } catch (err) {
        console.error(`[merged-pdf] Failed to load PDF for email ${email.id}:`, err);
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json({ error: "No valid PDFs to merge" }, { status: 404 });
    }

    const pdfBytes = await mergedPdf.save();
    const safeName = report.patient.name.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${safeName}_lab_results.pdf`;

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[merged-pdf] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to merge PDFs" },
      { status: 500 }
    );
  }
}
