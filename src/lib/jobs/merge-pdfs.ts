import { prisma } from "@/lib/prisma";
import { getGmailClient, fetchGmailMessage, fetchAttachment } from "@/lib/gmail";
import { findPdfParts, decodeBase64UrlToBuffer } from "@/lib/email-parser";
import { PDFDocument } from "pdf-lib";
import { savePdf, readEmailPdf } from "@/lib/pdf-storage";
import type { MergePdfsPayload } from "@/lib/queue";

export async function mergePdfs(payload: MergePdfsPayload) {
  const { reportId, emails, userId } = payload;

  try {
    // Look up cached pdfPaths for these emails
    const emailRecords = await prisma.email.findMany({
      where: { id: { in: emails.map((e) => e.id) } },
      select: { id: true, pdfPath: true },
    });
    const pdfPathMap = new Map(emailRecords.map((e) => [e.id, e.pdfPath]));

    let gmail: Awaited<ReturnType<typeof getGmailClient>> | null = null;
    const mergedPdf = await PDFDocument.create();
    let pdfCount = 0;

    for (const email of emails) {
      try {
        // Try cached PDF first
        const cachedPath = pdfPathMap.get(email.id);
        if (cachedPath) {
          const cachedBuffer = await readEmailPdf(cachedPath);
          if (cachedBuffer) {
            try {
              const sourcePdf = await PDFDocument.load(cachedBuffer);
              const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
              for (const page of pages) mergedPdf.addPage(page);
              pdfCount++;
              continue; // Skip Gmail fetch
            } catch (err) {
              console.error(`Cached PDF load failed for email ${email.id}, falling back to Gmail:`, err);
            }
          }
        }

        // Fallback: fetch from Gmail
        if (!gmail) gmail = await getGmailClient(userId);
        const message = await fetchGmailMessage(gmail, email.gmailMessageId);
        const pdfParts = findPdfParts(message);

        for (const part of pdfParts) {
          let raw: string;
          if (part.data) {
            raw = part.data;
          } else if (part.attachmentId) {
            raw = await fetchAttachment(
              gmail,
              email.gmailMessageId,
              part.attachmentId
            );
          } else {
            continue;
          }

          const buffer = decodeBase64UrlToBuffer(raw);
          try {
            const sourcePdf = await PDFDocument.load(buffer);
            const pages = await mergedPdf.copyPages(
              sourcePdf,
              sourcePdf.getPageIndices()
            );
            for (const page of pages) {
              mergedPdf.addPage(page);
            }
            pdfCount++;
          } catch (err) {
            console.error(`Failed to load PDF from email ${email.id}:`, err);
          }
        }
      } catch (err) {
        console.error(`Failed to fetch message ${email.gmailMessageId}:`, err);
      }
    }

    if (pdfCount === 0) {
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "no_results", step: null },
      });
      return;
    }

    const pdfBytes = await mergedPdf.save();
    const pdfPath = await savePdf(reportId, pdfBytes);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        pdfPath,
        status: "completed",
        step: null,
      },
    });
  } catch (error) {
    console.error("PDF merge error:", error);
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "failed",
        step: error instanceof Error ? error.message : "Unknown error",
      },
    });
    // Re-throw so pg-boss can retry
    throw error;
  }
}
