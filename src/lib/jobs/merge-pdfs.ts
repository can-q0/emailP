import { prisma } from "@/lib/prisma";
import {
  getGmailClient,
  searchGmailMessages,
  fetchGmailMessage,
  fetchAttachment,
  GmailTokenError,
} from "@/lib/gmail";
import { findPdfParts, decodeBase64UrlToBuffer } from "@/lib/email-parser";
import { PDFDocument } from "pdf-lib";
import { pLimit } from "@/lib/concurrency";
import type { MergePdfsPayload } from "@/lib/queue";

interface PdfResult {
  index: number;
  gmailMessageId: string;
  buffer: Buffer;
  filename: string;
}

export async function mergePdfs(payload: MergePdfsPayload) {
  const { reportId, userId, gmailQuery } = payload;

  try {
    let gmail: Awaited<ReturnType<typeof getGmailClient>>;
    try {
      gmail = await getGmailClient(userId);
    } catch (err) {
      if (err instanceof GmailTokenError || (err instanceof Error && err.name === "GmailTokenError")) {
        console.error("[merge-pdfs] Gmail token expired");
        await prisma.report.update({
          where: { id: reportId },
          data: { status: "failed", step: "gmail_token_expired" },
        });
        return;
      }
      throw err;
    }

    // Discover ALL matching messages directly from Gmail
    let gmailMessageIds: string[];

    if (gmailQuery) {
      // Search Gmail directly — find ALL matching messages (no pre-sync needed)
      await prisma.report.update({
        where: { id: reportId },
        data: { step: "searching" },
      });
      const messageRefs = await searchGmailMessages(gmail, gmailQuery);
      gmailMessageIds = messageRefs.map((m) => m.id!);
      console.log(`[merge-pdfs] Gmail search "${gmailQuery}" found ${gmailMessageIds.length} messages`);
    } else {
      // Fallback: use pre-synced email IDs from payload
      gmailMessageIds = payload.emails.map((e) => e.gmailMessageId);
    }

    if (gmailMessageIds.length === 0) {
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "no_results", step: null },
      });
      return;
    }

    // Check DB cache for already-downloaded PDFs (by gmailMessageId)
    const cachedEmails = await prisma.email.findMany({
      where: { gmailMessageId: { in: gmailMessageIds }, pdfData: { not: null } },
      select: { gmailMessageId: true, pdfData: true },
    });
    const cachedMap = new Map(cachedEmails.map((e) => [e.gmailMessageId, e.pdfData]));

    // Separate cached vs needs-fetch
    const cached: PdfResult[] = [];
    const needsFetchIds: string[] = [];

    for (let i = 0; i < gmailMessageIds.length; i++) {
      const gmailId = gmailMessageIds[i];
      const data = cachedMap.get(gmailId);
      if (data) {
        const buf = Buffer.from(data);
        if (buf.length > 0) {
          cached.push({ index: i, gmailMessageId: gmailId, buffer: buf, filename: "" });
          continue;
        }
      }
      needsFetchIds.push(gmailId);
    }

    console.log(`[merge-pdfs] ${cached.length} from DB cache, ${needsFetchIds.length} to fetch from Gmail`);

    // Download PDFs from Gmail in parallel (concurrency 10)
    const fetched: PdfResult[] = [];
    if (needsFetchIds.length > 0) {
      const limit = pLimit(10);
      let done = 0;

      const fetchOne = async (gmailId: string) => {
        const message = await fetchGmailMessage(gmail, gmailId);
        const pdfParts = findPdfParts(message);

        for (const part of pdfParts) {
          let raw: string;
          if (part.data) {
            raw = part.data;
          } else if (part.attachmentId) {
            raw = await fetchAttachment(gmail, gmailId, part.attachmentId);
          } else {
            continue;
          }

          const buffer = decodeBase64UrlToBuffer(raw);
          const originalIndex = gmailMessageIds.indexOf(gmailId);
          fetched.push({
            index: originalIndex,
            gmailMessageId: gmailId,
            buffer,
            filename: part.filename || `${gmailId}.pdf`,
          });
          break; // first PDF per email
        }

        done++;
        if (done % 10 === 0 || done === needsFetchIds.length) {
          await prisma.report.update({
            where: { id: reportId },
            data: { step: `downloading:${done}/${needsFetchIds.length}` },
          });
        }
      };

      const results = await Promise.allSettled(
        needsFetchIds.map((id) => limit(() => fetchOne(id)))
      );

      for (const r of results) {
        if (r.status === "rejected") {
          console.error("[merge-pdfs] fetch failed:", r.reason);
        }
      }
    }

    // Combine and sort by original Gmail order
    const allPdfs = [...cached, ...fetched].sort((a, b) => a.index - b.index);

    if (allPdfs.length === 0) {
      console.warn(`[merge-pdfs] Report ${reportId}: No PDFs found`);
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "no_results", step: null },
      });
      return;
    }

    // Merge all PDFs
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
        console.error(`[merge-pdfs] Failed to load PDF for ${pdf.gmailMessageId}:`, err);
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

    // Cache fetched PDFs to DB in background
    if (fetched.length > 0) {
      Promise.allSettled(
        fetched.map((p) =>
          prisma.email.updateMany({
            where: { gmailMessageId: p.gmailMessageId },
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
