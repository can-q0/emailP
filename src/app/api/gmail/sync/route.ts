import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getGmailClient,
  searchGmailMessages,
  batchFetchMetadata,
  extractMessageMeta,
  GmailTokenError,
} from "@/lib/gmail";
import { parseLabSubject } from "@/lib/email-parser";
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
  const { query, patientName, maxResults } = parsed.data;

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

    // Paginated search — capped by maxResults (default 200 for fast search)
    const messageRefs = await searchGmailMessages(gmail, query, maxResults ?? 200);

    await prisma.emailSyncLog.update({
      where: { id: syncLog.id },
      data: { emailsFound: messageRefs.length },
    });

    if (messageRefs.length === 0) {
      await prisma.emailSyncLog.update({
        where: { id: syncLog.id },
        data: { status: "completed", emailsSynced: 0 },
      });
      return NextResponse.json({ synced: 0, total: 0, emails: [] });
    }

    // Check which messages are already in DB
    const messageIds = messageRefs.map((m) => m.id!);
    const existing = await prisma.email.findMany({
      where: { gmailMessageId: { in: messageIds } },
      select: { id: true, gmailMessageId: true },
    });
    const existingSet = new Set(existing.map((e) => e.gmailMessageId));
    const newMessageIds = messageIds.filter((id) => !existingSet.has(id));

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

    // Fetch ONLY metadata (subject/from/to/date) for new messages — no body, no PDF, no EML
    let newlySynced = 0;
    if (newMessageIds.length > 0) {
      const metadataMessages = await batchFetchMetadata(gmail, newMessageIds);

      for (const message of metadataMessages) {
        const meta = extractMessageMeta(message);

        // Parse subject for patient info
        const subjectInfo = meta.subject ? parseLabSubject(meta.subject) : null;
        const isLabReport = !!subjectInfo;

        const resolvedName = subjectInfo?.patientName ?? null;
        const resolvedGender = subjectInfo?.gender ?? null;
        const resolvedBirthYear = subjectInfo?.birthYear ?? null;

        const emailDate = subjectInfo?.date ?? meta.date ?? null;

        const extractedData = resolvedName
          ? JSON.stringify({
              isLabReport: true,
              patientName: resolvedName,
              gender: resolvedGender,
              birthYear: resolvedBirthYear,
              metadataSource: "subject",
            })
          : null;

        await prisma.email.create({
          data: {
            ...meta,
            date: emailDate,
            body: null,
            htmlBody: null,
            isLabReport,
            extractedData,
            pdfPath: null,
            pdfData: null,
            emlPath: null,
            emlData: null,
            userId,
            patientId: patientId ?? null,
          },
        });
        newlySynced++;
      }
    }

    // Link existing emails to patient if needed
    if (patientId && existing.length > 0) {
      await prisma.email.updateMany({
        where: {
          id: { in: existing.map((e) => e.id) },
          patientId: null,
        },
        data: { patientId },
      });
    }

    // Update patient name/birthYear/gender from subject metadata
    if (patientId) {
      const allEmails = await prisma.email.findMany({
        where: { gmailMessageId: { in: messageIds } },
        select: { extractedData: true },
      });

      // Find best name (longest)
      let bestName: string | undefined;
      let birthYear: number | undefined;
      let gender: string | undefined;

      for (const e of allEmails) {
        if (!e.extractedData) continue;
        try {
          const data = typeof e.extractedData === "string"
            ? JSON.parse(e.extractedData)
            : e.extractedData;
          if (data.patientName && (!bestName || data.patientName.length > bestName.length)) {
            bestName = data.patientName;
          }
          if (data.birthYear && !birthYear) birthYear = data.birthYear;
          if (data.gender && !gender) gender = data.gender;
        } catch { /* ignore */ }
      }

      const currentPatient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { name: true, birthYear: true, gender: true },
      });

      if (currentPatient) {
        const updates: { name?: string; birthYear?: number; gender?: string } = {};
        if (bestName && bestName.trim().split(/\s+/).length >= 2 && bestName.length > currentPatient.name.length) {
          updates.name = bestName;
        }
        if (birthYear && !currentPatient.birthYear) updates.birthYear = birthYear;
        if (gender && !currentPatient.gender) updates.gender = gender;

        if (Object.keys(updates).length > 0) {
          await prisma.patient.update({
            where: { id: patientId },
            data: updates,
          });
        }
      }
    }

    await prisma.emailSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "completed",
        emailsSynced: newlySynced,
      },
    });

    // Return all matched emails (existing + newly synced)
    const allEmails = await prisma.email.findMany({
      where: { gmailMessageId: { in: messageIds } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({
      synced: newlySynced,
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
