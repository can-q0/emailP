import { prisma } from "@/lib/prisma";
import { getGmailClient, fetchGmailMessage, fetchAttachment, GmailTokenError } from "@/lib/gmail";
import { findPdfParts, decodeBase64UrlToBuffer } from "@/lib/email-parser";
import { PDFDocument } from "pdf-lib";
import { pLimit } from "@/lib/concurrency";
import type { MergePdfsPayload } from "@/lib/queue";

interface PdfResult {
  index: number;
  emailId: string;
  subject: string | null;
  buffer: Buffer;
  filename: string;
  source: "cache" | "gmail";
}

export async function mergePdfs(payload: MergePdfsPayload) {
  const { reportId, emails, userId } = payload;

  try {
    console.log(`[merge-pdfs] Starting merge for report ${reportId}: ${emails.length} emails`);

    // Look up cached pdfData for these emails
    const emailRecords = await prisma.email.findMany({
      where: { id: { in: emails.map((e) => e.id) } },
      select: { id: true, pdfData: true },
    });
    const pdfDataMap = new Map(emailRecords.map((e) => [e.id, e.pdfData]));

    // Separate cached vs needs-fetch
    const cached: PdfResult[] = [];
    const needsFetch: typeof emails = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const data = pdfDataMap.get(email.id);
      if (data) {
        const buf = Buffer.from(data);
        if (buf.length > 0) {
          cached.push({ index: i, emailId: email.id, subject: email.subject, buffer: buf, filename: "", source: "cache" });
          continue;
        }
      }
      needsFetch.push(email);
    }

    console.log(`[merge-pdfs] ${cached.length} from DB cache, ${needsFetch.length} to fetch from Gmail`);

    // Fetch PDFs from Gmail in parallel (concurrency 10)
    let gmailAuthFailed = false;
    const fetched: PdfResult[] = [];

    if (needsFetch.length > 0) {
      let gmail: Awaited<ReturnType<typeof getGmailClient>>;
      try {
        gmail = await getGmailClient(userId);
      } catch (err) {
        if (err instanceof GmailTokenError || (err instanceof Error && err.name === "GmailTokenError")) {
          console.error("[merge-pdfs] Gmail token expired");
          gmailAuthFailed = true;
        } else {
          throw err;
        }
      }

      if (!gmailAuthFailed) {
        const limit = pLimit(10);
        let done = 0;

        const fetchOne = async (email: (typeof needsFetch)[number]) => {
          const message = await fetchGmailMessage(gmail!, email.gmailMessageId);
          const pdfParts = findPdfParts(message);

          for (const part of pdfParts) {
            let raw: string;
            if (part.data) {
              raw = part.data;
            } else if (part.attachmentId) {
              raw = await fetchAttachment(gmail!, email.gmailMessageId, part.attachmentId);
            } else {
              continue;
            }

            const buffer = decodeBase64UrlToBuffer(raw);
            const originalIndex = emails.indexOf(email);
            fetched.push({
              index: originalIndex,
              emailId: email.id,
              subject: email.subject,
              buffer,
              filename: part.filename || `${email.gmailMessageId}.pdf`,
              source: "gmail",
            });
            break; // first PDF per email
          }

          done++;
          if (done % 10 === 0 || done === needsFetch.length) {
            await prisma.report.update({
              where: { id: reportId },
              data: { step: `downloading:${done}/${needsFetch.length}` },
            });
          }
        };

        const results = await Promise.allSettled(
          needsFetch.map((email) => limit(() => fetchOne(email)))
        );

        for (const r of results) {
          if (r.status === "rejected") {
            console.error("[merge-pdfs] fetch failed:", r.reason);
          }
        }
      }
    }

    // Combine and sort by original email order
    const allPdfs = [...cached, ...fetched].sort((a, b) => a.index - b.index);

    if (allPdfs.length === 0) {
      const errorStep = gmailAuthFailed ? "gmail_token_expired" : null;
      const errorStatus = gmailAuthFailed ? "failed" : "no_results";
      console.warn(`[merge-pdfs] Report ${reportId}: No PDFs found`);
      await prisma.report.update({
        where: { id: reportId },
        data: { status: errorStatus, step: errorStep },
      });
      return;
    }

    // Merge all PDFs sequentially (pdf-lib requirement)
    await prisma.report.update({
      where: { id: reportId },
      data: { step: `merging:${allPdfs.length}` },
    });

    const mergedPdf = await PDFDocument.create();
    let pdfCount = 0;

    for (const pdf of allPdfs) {
      try {
        const sourcePdf = await PDFDocument.load(pdf.buffer);
        const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        for (const page of pages) mergedPdf.addPage(page);
        pdfCount++;
      } catch (err) {
        console.error(`[merge-pdfs] Failed to load PDF for ${pdf.emailId}:`, err);
      }
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

    // Cache fetched PDFs to DB in background (don't block response)
    const toCache = allPdfs.filter((p) => p.source === "gmail");
    if (toCache.length > 0) {
      Promise.allSettled(
        toCache.map((p) =>
          prisma.email.update({
            where: { id: p.emailId },
            data: {
              pdfData: new Uint8Array(p.buffer),
              pdfPath: p.filename,
            },
          })
        )
      ).catch(() => {});
    }
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
