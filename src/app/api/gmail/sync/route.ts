import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getGmailClient,
  searchGmailMessages,
  batchFetchMessages,
  extractMessageMeta,
  fetchAttachment,
  fetchRawMessage,
  GmailTokenError,
} from "@/lib/gmail";
import {
  extractBody,
  findPdfParts,
  parseLabSubject,
  parseForwardingHeaders,
  parsePdfMetadata,
  decodeBase64UrlToBuffer,
} from "@/lib/email-parser";
import { prisma } from "@/lib/prisma";
import { parseBody, gmailSyncSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { extractPdfText } from "@/lib/pdf";
import { saveEmailPdf, saveEmailEml } from "@/lib/pdf-storage";
import { pLimit } from "@/lib/concurrency";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`gmail-sync:${session.user.id}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many sync requests. Please wait a minute." },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, gmailSyncSchema);
  if (!parsed.success) return parsed.response;
  const { query, patientName } = parsed.data;

  const userId = session.user.id;

  // Create sync log
  const syncLog = await prisma.emailSyncLog.create({
    data: {
      userId,
      query,
      status: "syncing",
    },
  });

  try {
    const gmail = await getGmailClient(userId);
    const messageRefs = await searchGmailMessages(gmail, query);

    await prisma.emailSyncLog.update({
      where: { id: syncLog.id },
      data: { emailsFound: messageRefs.length },
    });

    if (messageRefs.length === 0) {
      await prisma.emailSyncLog.update({
        where: { id: syncLog.id },
        data: { status: "completed", emailsSynced: 0 },
      });
      return NextResponse.json({ synced: 0, emails: [] });
    }

    // Check which messages are already synced
    const messageIds = messageRefs.map((m) => m.id!);
    const existing = await prisma.email.findMany({
      where: { gmailMessageId: { in: messageIds } },
      select: { id: true, gmailMessageId: true, body: true, pdfPath: true },
    });
    const existingMap = new Map(existing.map((e) => [e.gmailMessageId, e]));
    const newMessageIds = messageIds.filter((id) => !existingMap.has(id));

    // Find existing emails that need re-extraction (empty/short body OR missing PDF)
    const needsReExtraction = existing.filter(
      (e) => !e.body || e.body.trim().length < 500 || !e.pdfPath
    );
    const reExtractIds = needsReExtraction.map((e) => e.gmailMessageId);

    // Fetch new messages + messages needing re-extraction
    const idsToFetch = [...newMessageIds, ...reExtractIds];
    const fullMessages = await batchFetchMessages(gmail, idsToFetch);

    // Find or create patient if name provided
    let patientId: string | undefined;
    if (patientName) {
      const patient = await prisma.patient.upsert({
        where: {
          governmentId_userId: {
            governmentId: `pending_${patientName.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_")}`,
            userId,
          },
        },
        update: {},
        create: {
          name: patientName,
          governmentId: `pending_${patientName.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_")}`,
          userId,
        },
      });
      patientId = patient.id;
    }

    // Process all fetched messages — extract PDF text and parse subject (parallel)
    const emails = [];
    const reExtractIdSet = new Set(reExtractIds);
    const processLimit = pLimit(5);

    const processMessage = async (message: (typeof fullMessages)[number]) => {
      const meta = extractMessageMeta(message);
      const { text, html } = extractBody(message);

      // Extract PDF text from attachment and cache PDFs
      let pdfText = "";
      let savedPdfPath: string | null = null;
      const pdfParts = findPdfParts(message);

      // Debug: log all attachment parts if no PDFs found
      if (pdfParts.length === 0 && message.payload?.parts) {
        const attachments = message.payload.parts
          .filter((p) => p.filename || p.body?.attachmentId)
          .map((p) => ({ mime: p.mimeType, filename: p.filename, hasAttachmentId: !!p.body?.attachmentId }));
        if (attachments.length > 0) {
          console.log(`[sync] Message ${message.id} has attachments but no PDF detected:`, JSON.stringify(attachments));
        }
      }
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

          // Cache the first PDF to disk
          if (!savedPdfPath) {
            try {
              const filename = part.filename || `${message.id}.pdf`;
              savedPdfPath = await saveEmailPdf(userId, message.id!, filename, buffer);
            } catch (cacheErr) {
              console.error("PDF cache error for message", message.id, cacheErr);
            }
          }
        } catch (err) {
          console.error("PDF parse error for message", message.id, err);
        }
      }

      // --- Cascading metadata extraction ---
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

      // Save full email as .eml (raw RFC 2822 with attachments)
      let savedEmlPath: string | null = null;
      try {
        const rawBuffer = await fetchRawMessage(gmail, message.id!);
        savedEmlPath = await saveEmailEml(userId, message.id!, rawBuffer);
      } catch (emlErr) {
        console.error("EML save error for message", message.id, emlErr);
      }

      return { message, meta, html, bodyText, isLabReport, extractedData, emailDate, savedPdfPath, savedEmlPath };
    };

    // Process all messages in parallel (concurrency=5)
    const processed = await Promise.allSettled(
      fullMessages.map((msg) => processLimit(() => processMessage(msg)))
    );

    // Batch DB writes
    for (const result of processed) {
      if (result.status !== "fulfilled") {
        console.error("Message processing failed:", result.reason);
        continue;
      }
      const { message, meta, html, bodyText, isLabReport, extractedData, emailDate, savedPdfPath, savedEmlPath } = result.value;

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
            patientId: patientId ?? undefined,
            pdfPath: savedPdfPath ?? undefined,
            emlPath: savedEmlPath ?? undefined,
          },
        });
        const updated = await prisma.email.findUnique({ where: { id: existingEmail.id } });
        if (updated) emails.push(updated);
      } else {
        const email = await prisma.email.create({
          data: {
            ...meta,
            date: emailDate,
            body: bodyText,
            htmlBody: html,
            isLabReport,
            extractedData,
            pdfPath: savedPdfPath,
            emlPath: savedEmlPath,
            userId,
            patientId: patientId ?? null,
          },
        });
        emails.push(email);
      }
    }

    // Update patient name with the most complete name found in email metadata
    if (patientId) {
      const bestName = processed
        .filter((r) => r.status === "fulfilled" && r.value.extractedData)
        .map((r) => {
          try {
            const data = JSON.parse((r as PromiseFulfilledResult<typeof processed[0] extends PromiseSettledResult<infer T> ? T : never>).value.extractedData!);
            return data.patientName as string | undefined;
          } catch { return undefined; }
        })
        .filter((n): n is string => !!n)
        .sort((a, b) => b.length - a.length)[0]; // longest = most complete name

      if (bestName && bestName.trim().split(/\s+/).length >= 2) {
        const currentPatient = await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true } });
        if (currentPatient && bestName.length > currentPatient.name.length) {
          await prisma.patient.update({
            where: { id: patientId },
            data: { name: bestName },
          });
        }
      }
    }

    // Return existing emails that didn't need re-extraction
    const existingIds = new Set(existing.map((e) => e.gmailMessageId));
    const unchangedExisting = existing.filter(
      (e) => !reExtractIdSet.has(e.gmailMessageId) && existingIds.has(e.gmailMessageId)
    );
    const unchangedEmails = unchangedExisting.length > 0
      ? await prisma.email.findMany({
          where: { id: { in: unchangedExisting.map((e) => e.id) } },
        })
      : [];

    // Update patient link for existing emails if needed
    if (patientId && unchangedEmails.length > 0) {
      await prisma.email.updateMany({
        where: {
          id: { in: unchangedEmails.map((e) => e.id) },
          patientId: null,
        },
        data: { patientId },
      });
    }

    // Update patient birthYear/gender from extracted email metadata if currently null
    if (patientId) {
      const currentPatient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { birthYear: true, gender: true },
      });
      if (currentPatient && (!currentPatient.birthYear || !currentPatient.gender)) {
        const allSyncedEmails = [...emails, ...unchangedEmails];
        for (const e of allSyncedEmails) {
          if (e.extractedData) {
            try {
              const parsed = typeof e.extractedData === "string"
                ? JSON.parse(e.extractedData)
                : e.extractedData;
              const updates: { birthYear?: number; gender?: string } = {};
              if (!currentPatient.birthYear && parsed.birthYear) {
                updates.birthYear = parsed.birthYear;
              }
              if (!currentPatient.gender && parsed.gender) {
                updates.gender = parsed.gender;
              }
              if (Object.keys(updates).length > 0) {
                await prisma.patient.update({
                  where: { id: patientId },
                  data: updates,
                });
                break; // Only need the first valid data
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    }

    await prisma.emailSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "completed",
        emailsSynced: emails.length,
      },
    });

    const allEmails = [...emails, ...unchangedEmails];
    return NextResponse.json({
      synced: emails.length,
      total: allEmails.length,
      emails: allEmails,
    });
  } catch (error) {
    console.error("Gmail sync error:", error);
    await prisma.emailSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    if (error instanceof GmailTokenError || (error instanceof Error && error.name === "GmailTokenError")) {
      return NextResponse.json(
        { error: "gmail_token_expired", message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
