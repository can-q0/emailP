import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processReport } from "@/lib/jobs/process-report";
import { getOrCreateSettings } from "@/lib/settings";
import {
  getGmailClient,
  searchGmailMessages,
  batchFetchMessages,
  extractMessageMeta,
  fetchAttachment,
  fetchRawMessage,
} from "@/lib/gmail";
import {
  extractBody,
  findPdfParts,
  parseLabSubject,
  parseForwardingHeaders,
  parsePdfMetadata,
  decodeBase64UrlToBuffer,
} from "@/lib/email-parser";
import { extractPdfText } from "@/lib/pdf";
import { saveEmailPdf, saveEmailEml } from "@/lib/pdf-storage";
import { pLimit } from "@/lib/concurrency";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const { patientId } = body as { patientId?: string };

  // Clean up any stuck "processing" cache reports older than 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const stuckCacheReports = await prisma.report.findMany({
    where: { userId, reportType: "cache", status: "processing", createdAt: { lt: fiveMinAgo } },
    select: { id: true },
  });
  if (stuckCacheReports.length > 0) {
    const stuckIds = stuckCacheReports.map((r) => r.id);
    await prisma.reportEmail.deleteMany({ where: { reportId: { in: stuckIds } } });
    await prisma.report.deleteMany({ where: { id: { in: stuckIds } } });
  }

  // ── Re-link orphaned emails (patientId=null) by parsing subjects ──
  const orphanedEmails = await prisma.email.findMany({
    where: { userId, patientId: null, isLabReport: true },
    select: { id: true, subject: true },
  });

  if (orphanedEmails.length > 0) {
    // Extract unique patient names from email subjects
    const nameToEmailIds = new Map<string, string[]>();
    for (const email of orphanedEmails) {
      const parsed = email.subject ? parseLabSubject(email.subject) : null;
      if (parsed?.patientName) {
        const name = parsed.patientName;
        if (!nameToEmailIds.has(name)) nameToEmailIds.set(name, []);
        nameToEmailIds.get(name)!.push(email.id);
      }
    }

    // Create patients and link emails
    for (const [name, emailIds] of nameToEmailIds) {
      const govId = `pending_${name.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_")}`;
      const patient = await prisma.patient.upsert({
        where: { governmentId_userId: { governmentId: govId, userId } },
        update: {},
        create: { name, governmentId: govId, userId },
      });
      await prisma.email.updateMany({
        where: { id: { in: emailIds } },
        data: { patientId: patient.id },
      });
    }
  }

  // Find patients to cache
  const patients = patientId
    ? await prisma.patient.findMany({ where: { id: patientId, userId } })
    : await prisma.patient.findMany({ where: { userId } });

  if (patients.length === 0) {
    return NextResponse.json({ error: "No patients found", cached: 0, synced: 0 }, { status: 404 });
  }

  // ── Sync new emails from Gmail for each patient before caching ──
  let totalSynced = 0;
  try {
    const gmail = await getGmailClient(userId);
    const processLimit = pLimit(5);

    for (const patient of patients) {
      try {
        const messageRefs = await searchGmailMessages(gmail, patient.name);
        if (messageRefs.length === 0) continue;

        const messageIds = messageRefs.map((m) => m.id!);
        const existing = await prisma.email.findMany({
          where: { gmailMessageId: { in: messageIds } },
          select: { id: true, gmailMessageId: true, body: true, pdfPath: true },
        });
        const existingMap = new Map(existing.map((e) => [e.gmailMessageId, e]));
        const newMessageIds = messageIds.filter((id) => !existingMap.has(id));

        // Also re-extract emails missing PDF or with short body
        const needsReExtraction = existing.filter(
          (e) => !e.body || e.body.trim().length < 500 || !e.pdfPath
        );
        const reExtractIds = needsReExtraction.map((e) => e.gmailMessageId);
        const reExtractIdSet = new Set(reExtractIds);

        const idsToFetch = [...newMessageIds, ...reExtractIds];
        if (idsToFetch.length === 0) continue;

        const fullMessages = await batchFetchMessages(gmail, idsToFetch);

        const processMessage = async (message: (typeof fullMessages)[number]) => {
          const meta = extractMessageMeta(message);
          const { text, html } = extractBody(message);

          let pdfText = "";
          let savedPdfPath: string | null = null;
          const pdfParts = findPdfParts(message);
          for (const part of pdfParts) {
            try {
              let raw: string;
              if (part.data) {
                raw = part.data;
              } else if (part.attachmentId) {
                raw = await fetchAttachment(gmail, message.id!, part.attachmentId);
              } else {
                continue;
              }
              const buffer = decodeBase64UrlToBuffer(raw);
              pdfText += await extractPdfText(buffer) + "\n";
              if (!savedPdfPath) {
                try {
                  const filename = part.filename || `${message.id}.pdf`;
                  savedPdfPath = await saveEmailPdf(userId, message.id!, filename, buffer);
                } catch (cacheErr) {
                  console.error("[cache-sync] PDF cache error:", message.id, cacheErr);
                }
              }
            } catch (err) {
              console.error("[cache-sync] PDF parse error:", message.id, err);
            }
          }

          const subjectInfo = meta.subject ? parseLabSubject(meta.subject) : null;
          const forwardedInfo = text ? parseForwardingHeaders(text) : null;
          const forwardedSubjectInfo = forwardedInfo?.subject ? parseLabSubject(forwardedInfo.subject) : null;
          const pdfMeta = pdfText ? parsePdfMetadata(pdfText) : null;

          const bodyText = [pdfText, text].filter(Boolean).join("\n\n---\n\n") || "";
          const isLabReport = !!pdfText || !!subjectInfo || !!forwardedSubjectInfo || !!pdfMeta?.patientName;

          const resolvedName = subjectInfo?.patientName ?? forwardedSubjectInfo?.patientName ?? pdfMeta?.patientName ?? null;
          const resolvedGender = subjectInfo?.gender ?? forwardedSubjectInfo?.gender ?? pdfMeta?.gender ?? null;
          const resolvedBirthYear = subjectInfo?.birthYear
            ?? forwardedSubjectInfo?.birthYear
            ?? (pdfMeta?.birthDate ? pdfMeta.birthDate.getFullYear() : null);
          const resolvedGovernmentId = pdfMeta?.governmentId ?? null;

          const emailDate = subjectInfo?.date
            ?? forwardedInfo?.date
            ?? forwardedSubjectInfo?.date
            ?? pdfMeta?.date
            ?? meta.date
            ?? null;

          const metadataSource = subjectInfo ? "subject"
            : forwardedSubjectInfo ? "forwarded_subject"
            : pdfMeta?.patientName ? "pdf"
            : forwardedInfo ? "forwarded_headers"
            : null;

          const extractedData = resolvedName
            ? JSON.stringify({
                isLabReport: true,
                patientName: resolvedName,
                gender: resolvedGender,
                birthYear: resolvedBirthYear,
                governmentId: resolvedGovernmentId,
                metadataSource,
              })
            : null;

          let savedEmlPath: string | null = null;
          try {
            const rawBuffer = await fetchRawMessage(gmail, message.id!);
            savedEmlPath = await saveEmailEml(userId, message.id!, rawBuffer);
          } catch { /* ignore */ }

          return { message, meta, html, bodyText, isLabReport, extractedData, emailDate, savedPdfPath, savedEmlPath };
        };

        const processed = await Promise.allSettled(
          fullMessages.map((msg) => processLimit(() => processMessage(msg)))
        );

        for (const result of processed) {
          if (result.status !== "fulfilled") continue;
          const { message, meta, html, bodyText, isLabReport, extractedData, emailDate, savedPdfPath } = result.value;

          if (reExtractIdSet.has(message.id!)) {
            const existingEmail = existingMap.get(message.id!)!;
            await prisma.email.update({
              where: { id: existingEmail.id },
              data: {
                body: bodyText,
                htmlBody: html,
                isLabReport,
                extractedData,
                date: emailDate ?? undefined,
                patientId: patient.id,
                pdfPath: savedPdfPath ?? undefined,
              },
            });
          } else {
            await prisma.email.create({
              data: {
                ...meta,
                date: emailDate,
                body: bodyText,
                htmlBody: html,
                isLabReport,
                extractedData,
                pdfPath: savedPdfPath,
                userId,
                patientId: patient.id,
              },
            });
            totalSynced++;
          }
        }
      } catch (err) {
        console.error(`[cache-sync] Sync failed for patient ${patient.name}:`, err);
      }
    }
  } catch (err) {
    console.error("[cache-sync] Gmail client error:", err);
    // Continue with caching what's already in DB
  }

  const settings = await getOrCreateSettings(userId);
  const results: Array<{ patientId: string; patientName: string; reportId: string; emailCount: number }> = [];

  for (const patient of patients) {
    const emails = await prisma.email.findMany({
      where: { patientId: patient.id, isLabReport: true, userId },
      orderBy: { date: "asc" },
    });

    if (emails.length === 0) continue;

    const emailIds = emails.map((e) => e.id);

    // Check which emails already have metrics — either from completed reports
    // OR from currently-processing cache reports (to prevent duplicates)
    const alreadyHandled = await prisma.reportEmail.findMany({
      where: {
        emailId: { in: emailIds },
        report: { status: { in: ["completed", "processing"] } },
      },
      select: { emailId: true },
    });
    const handledSet = new Set(alreadyHandled.map((e) => e.emailId));
    const uncachedEmails = emails.filter((e) => !handledSet.has(e.id));

    if (uncachedEmails.length === 0) continue;

    const report = await prisma.report.create({
      data: {
        title: `Cache - ${patient.name}`,
        patientId: patient.id,
        userId,
        status: "processing",
        step: "extracting_metrics",
        reportType: "cache",
        format: "cache",
        reportEmails: {
          create: uncachedEmails.map((e) => ({ emailId: e.id })),
        },
      },
    });

    const payload = {
      reportId: report.id,
      patientName: patient.name,
      emails: uncachedEmails.map((e) => ({
        id: e.id,
        subject: e.subject,
        body: e.body,
        date: e.date?.toISOString() ?? null,
      })),
      userId,
      reportType: "cache",
      format: "cache",
      aiOptions: {
        model: settings.aiModel,
        language: settings.reportLanguage,
      },
    };

    after(async () => {
      try {
        await processReport(payload);
      } catch (err) {
        console.error("[cache] processing failed:", err);
        await prisma.report.update({
          where: { id: report.id },
          data: { status: "failed", step: null },
        });
      }
    });

    results.push({
      patientId: patient.id,
      patientName: patient.name,
      reportId: report.id,
      emailCount: uncachedEmails.length,
    });
  }

  if (results.length === 0) {
    return NextResponse.json({
      message: totalSynced > 0
        ? `Synced ${totalSynced} new email(s) from Gmail. All emails already cached.`
        : "All emails already cached",
      cached: 0,
      synced: totalSynced,
    });
  }

  return NextResponse.json({
    message: `${totalSynced > 0 ? `Synced ${totalSynced} new email(s). ` : ""}Caching ${results.reduce((s, r) => s + r.emailCount, 0)} emails for ${results.length} patient(s)`,
    cached: results.length,
    synced: totalSynced,
    results,
  });
}
