import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getGmailClient,
  searchGmailMessages,
  batchFetchMessages,
  extractMessageMeta,
  fetchAttachment,
} from "@/lib/gmail";
import { extractBody, findPdfParts, parseLabSubject, decodeBase64UrlToBuffer } from "@/lib/email-parser";
import { prisma } from "@/lib/prisma";
import { parseBody, gmailSyncSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { extractPdfText } from "@/lib/pdf";

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
      select: { id: true, gmailMessageId: true, body: true },
    });
    const existingMap = new Map(existing.map((e) => [e.gmailMessageId, e]));
    const newMessageIds = messageIds.filter((id) => !existingMap.has(id));

    // Find existing emails that need PDF re-extraction (empty/short body)
    const needsReExtraction = existing.filter(
      (e) => !e.body || e.body.trim().length < 100
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
            governmentId: `pending_${patientName.toLowerCase().replace(/\s+/g, "_")}`,
            userId,
          },
        },
        update: {},
        create: {
          name: patientName,
          governmentId: `pending_${patientName.toLowerCase().replace(/\s+/g, "_")}`,
          userId,
        },
      });
      patientId = patient.id;
    }

    // Process all fetched messages — extract PDF text and parse subject
    const emails = [];
    const reExtractIdSet = new Set(reExtractIds);

    for (const message of fullMessages) {
      const meta = extractMessageMeta(message);
      const { text, html } = extractBody(message);

      // Extract PDF text from attachment
      let pdfText = "";
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
        } catch (err) {
          console.error("PDF parse error for message", message.id, err);
        }
      }

      // Parse subject for patient info and date
      const subjectInfo = meta.subject ? parseLabSubject(meta.subject) : null;
      const bodyText = pdfText || text;
      const isLabReport = !!pdfText || !!subjectInfo;
      const emailDate = meta.date ?? subjectInfo?.date ?? null;

      const extractedData = subjectInfo
        ? JSON.stringify({
            isLabReport: true,
            patientName: subjectInfo.patientName,
            gender: subjectInfo.gender,
            birthYear: subjectInfo.birthYear,
          })
        : null;

      // Is this a re-extraction of an existing email?
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
          },
        });
        const updated = await prisma.email.findUnique({ where: { id: existingEmail.id } });
        if (updated) emails.push(updated);
      } else {
        // New email — create
        const email = await prisma.email.create({
          data: {
            ...meta,
            date: emailDate,
            body: bodyText,
            htmlBody: html,
            isLabReport,
            extractedData,
            userId,
            patientId: patientId ?? null,
          },
        });
        emails.push(email);
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
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
