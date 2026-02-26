import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getGmailClient,
  searchGmailMessages,
  batchFetchMessages,
  extractMessageMeta,
} from "@/lib/gmail";
import { extractBody } from "@/lib/email-parser";
import { prisma } from "@/lib/prisma";
import { parseBody, gmailSyncSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

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

    // Filter out already-synced messages
    const messageIds = messageRefs.map((m) => m.id!);
    const existing = await prisma.email.findMany({
      where: { gmailMessageId: { in: messageIds } },
      select: { gmailMessageId: true },
    });
    const existingIds = new Set(existing.map((e) => e.gmailMessageId));
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id));

    // Fetch full messages
    const fullMessages = await batchFetchMessages(gmail, newMessageIds);

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

    // Store emails
    const emails = [];
    for (const message of fullMessages) {
      const meta = extractMessageMeta(message);
      const { text, html } = extractBody(message);

      const email = await prisma.email.create({
        data: {
          ...meta,
          body: text,
          htmlBody: html,
          userId,
          patientId: patientId ?? null,
        },
      });
      emails.push(email);
    }

    // Also return existing emails for the patient
    const existingEmails = existingIds.size > 0
      ? await prisma.email.findMany({
          where: { gmailMessageId: { in: [...existingIds] } },
        })
      : [];

    // Update patient link for existing emails if needed
    if (patientId && existingEmails.length > 0) {
      await prisma.email.updateMany({
        where: {
          id: { in: existingEmails.map((e) => e.id) },
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

    return NextResponse.json({
      synced: emails.length,
      total: emails.length + existingEmails.length,
      emails: [...emails, ...existingEmails],
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
