import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, generateReportSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getOrCreateSettings } from "@/lib/settings";
import { processReport } from "@/lib/jobs/process-report";
import { extractPdfText } from "@/lib/pdf";
import { getGmailClient, fetchGmailMessage, fetchAttachment } from "@/lib/gmail";
import { findPdfParts, decodeBase64UrlToBuffer } from "@/lib/email-parser";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`generate-report:${session.user.id}`, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute before generating another report." },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, generateReportSchema);
  if (!parsed.success) return parsed.response;
  const { patientId, emailIds, title, reportType, format, comparisonDateA, comparisonDateB } = parsed.data;

  const userId = session.user.id;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const emails = await prisma.email.findMany({
    where: { id: { in: emailIds }, userId },
    orderBy: { date: "asc" },
  });

  const settings = await getOrCreateSettings(userId);

  const effectiveFormat = format || settings.reportDetailLevel || "detailed";

  // Enrich email bodies: try DB cache first, then fetch PDF from Gmail on demand
  let gmail: Awaited<ReturnType<typeof getGmailClient>> | null = null;

  const enrichedEmails = await Promise.all(
    emails.map(async (e) => {
      let body = e.body;

      // If body is sufficient, use it as-is
      if (body && body.trim().length >= 500) {
        return { id: e.id, subject: e.subject, body, date: e.date?.toISOString() ?? null };
      }

      // Try cached pdfData from DB
      if (e.pdfData) {
        try {
          const buffer = Buffer.from(e.pdfData);
          if (buffer.length > 0) {
            const pdfText = await extractPdfText(buffer);
            if (pdfText && pdfText.trim().length > 50) {
              body = [pdfText, body].filter(Boolean).join("\n\n---\n\n");
              console.log(`[generate-report] Enriched ${e.id.slice(0, 12)} from DB PDF cache`);
              await prisma.email.update({ where: { id: e.id }, data: { body } });
              return { id: e.id, subject: e.subject, body, date: e.date?.toISOString() ?? null };
            }
          }
        } catch (err) {
          console.error(`[generate-report] DB PDF enrichment failed for ${e.id}:`, err);
        }
      }

      // Fallback: fetch PDF from Gmail on demand
      try {
        if (!gmail) gmail = await getGmailClient(userId);
        const message = await fetchGmailMessage(gmail, e.gmailMessageId);
        const pdfParts = findPdfParts(message);

        for (const part of pdfParts) {
          let raw: string;
          if (part.data) {
            raw = part.data;
          } else if (part.attachmentId) {
            raw = await fetchAttachment(gmail, e.gmailMessageId, part.attachmentId);
          } else {
            continue;
          }

          const buffer = decodeBase64UrlToBuffer(raw);
          const pdfText = await extractPdfText(buffer);
          if (pdfText && pdfText.trim().length > 50) {
            body = [pdfText, body].filter(Boolean).join("\n\n---\n\n");
            console.log(`[generate-report] Enriched ${e.id.slice(0, 12)} from Gmail PDF (${pdfText.length} chars)`);

            // Cache PDF + body back to DB
            await prisma.email.update({
              where: { id: e.id },
              data: {
                body,
                pdfData: new Uint8Array(buffer),
                pdfPath: part.filename || `${e.gmailMessageId}.pdf`,
              },
            });
            break; // Use first PDF
          }
        }
      } catch (err) {
        console.error(`[generate-report] Gmail PDF fetch failed for ${e.id}:`, err);
      }

      return { id: e.id, subject: e.subject, body, date: e.date?.toISOString() ?? null };
    })
  );

  console.log(`[generate-report] ${enrichedEmails.length} emails, bodies: ${enrichedEmails.map((e) => e.body?.length || 0).join(', ')}`);

  const report = await prisma.report.create({
    data: {
      title: title || `Report for ${patient.name}`,
      patientId,
      userId,
      status: "processing",
      step: "extracting_metrics",
      reportType: reportType || "detailed report",
      format: effectiveFormat,
      comparisonDateA: comparisonDateA ? new Date(comparisonDateA) : null,
      comparisonDateB: comparisonDateB ? new Date(comparisonDateB) : null,
      reportEmails: {
        create: emails.map((e) => ({ emailId: e.id })),
      },
    },
  });

  const payload = {
    reportId: report.id,
    patientName: patient.name,
    emails: enrichedEmails,
    userId,
    reportType: reportType || "detailed report",
    format: effectiveFormat,
    aiOptions: {
      model: settings.aiModel,
      language: settings.reportLanguage,
      customSystemPrompt: settings.customSystemPrompt,
    },
  };

  after(async () => {
    try {
      await processReport(payload);
    } catch (err) {
      console.error("[generate-report] processing failed:", err);
      await prisma.report.update({
        where: { id: report.id },
        data: { status: "failed", step: null },
      });
    }
  });

  return NextResponse.json({ reportId: report.id, status: "processing" });
}
