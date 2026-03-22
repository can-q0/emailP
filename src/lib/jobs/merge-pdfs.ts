import { prisma } from "@/lib/prisma";
import { getGmailClient, fetchGmailMessage, fetchAttachment, GmailTokenError } from "@/lib/gmail";
import { findPdfParts, decodeBase64UrlToBuffer } from "@/lib/email-parser";
import { PDFDocument } from "pdf-lib";
import type { MergePdfsPayload } from "@/lib/queue";

export async function mergePdfs(payload: MergePdfsPayload) {
  const { reportId, emails, userId } = payload;

  try {
    // Look up cached pdfData for these emails
    const emailRecords = await prisma.email.findMany({
      where: { id: { in: emails.map((e) => e.id) } },
      select: { id: true, pdfData: true },
    });
    const pdfDataMap = new Map(emailRecords.map((e) => [e.id, e.pdfData]));

    let gmail: Awaited<ReturnType<typeof getGmailClient>> | null = null;
    let gmailAuthFailed = false;
    const mergedPdf = await PDFDocument.create();
    let pdfCount = 0;

    console.log(`[merge-pdfs] Starting merge for report ${reportId}: ${emails.length} emails`);

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        // Try cached PDF from DB first
        const cachedData = pdfDataMap.get(email.id);
        if (cachedData) {
          const cachedBuffer = Buffer.from(cachedData);
          if (cachedBuffer.length > 0) {
            try {
              const sourcePdf = await PDFDocument.load(cachedBuffer);
              const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
              for (const page of pages) mergedPdf.addPage(page);
              pdfCount++;
              console.log(`[merge-pdfs] [${i + 1}/${emails.length}] ${email.subject} — from DB cache`);
              continue;
            } catch (err) {
              console.error(`[merge-pdfs] Cached PDF load failed for ${email.id}, falling back to Gmail:`, err);
            }
          }
        }

        // Skip Gmail fetch if auth already failed
        if (gmailAuthFailed) continue;

        // Fetch from Gmail
        if (!gmail) {
          try {
            gmail = await getGmailClient(userId);
          } catch (err) {
            if (err instanceof GmailTokenError || (err instanceof Error && err.name === "GmailTokenError")) {
              console.error("[merge-pdfs] Gmail token expired, cannot fetch PDFs from Gmail");
              gmailAuthFailed = true;
              continue;
            }
            throw err;
          }
        }

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

            // Cache the PDF back to DB for future use
            await prisma.email.update({
              where: { id: email.id },
              data: {
                pdfData: new Uint8Array(buffer),
                pdfPath: part.filename || `${email.gmailMessageId}.pdf`,
              },
            });

            console.log(`[merge-pdfs] [${i + 1}/${emails.length}] ${email.subject} — fetched from Gmail, cached to DB`);
          } catch (err) {
            console.error(`[merge-pdfs] Failed to load PDF from email ${email.id}:`, err);
          }
        }

        if (pdfParts.length === 0) {
          console.log(`[merge-pdfs] [${i + 1}/${emails.length}] ${email.subject} — no PDF attachment`);
        }
      } catch (err) {
        console.error(`[merge-pdfs] Failed to fetch message ${email.gmailMessageId}:`, err);
      }

      // Update progress step
      if (i % 10 === 0 || i === emails.length - 1) {
        await prisma.report.update({
          where: { id: reportId },
          data: { step: `merging_pdfs:${i + 1}/${emails.length}` },
        });
      }
    }

    if (pdfCount === 0) {
      const errorStep = gmailAuthFailed ? "gmail_token_expired" : null;
      const errorStatus = gmailAuthFailed ? "failed" : "no_results";

      console.warn(`[merge-pdfs] Report ${reportId}: No PDFs found. gmailAuthFailed=${gmailAuthFailed}`);
      await prisma.report.update({
        where: { id: reportId },
        data: { status: errorStatus, step: errorStep },
      });
      return;
    }

    const pdfBytes = await mergedPdf.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    console.log(`[merge-pdfs] Report ${reportId}: merged ${pdfCount} PDFs, ${pdfBuffer.length} bytes`);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        pdfData: new Uint8Array(pdfBuffer),
        pdfPath: `merged_${reportId}.pdf`,
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
    throw error;
  }
}
