import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processReport } from "@/lib/jobs/process-report";
import { getOrCreateSettings } from "@/lib/settings";
import {
  getGmailClient,
  searchGmailMessages,
  batchFetchMetadata,
  extractMessageMeta,
} from "@/lib/gmail";
import { parseLabSubject } from "@/lib/email-parser";

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

  // Re-link orphaned emails (patientId=null) by parsing subjects
  const orphanedEmails = await prisma.email.findMany({
    where: { userId, patientId: null, isLabReport: true },
    select: { id: true, subject: true },
  });

  if (orphanedEmails.length > 0) {
    const nameToEmailIds = new Map<string, string[]>();
    for (const email of orphanedEmails) {
      const parsed = email.subject ? parseLabSubject(email.subject) : null;
      if (parsed?.patientName) {
        const name = parsed.patientName;
        if (!nameToEmailIds.has(name)) nameToEmailIds.set(name, []);
        nameToEmailIds.get(name)!.push(email.id);
      }
    }

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

  // Lightweight sync: fetch only metadata (subjects/headers) for each patient
  let totalSynced = 0;
  try {
    const gmail = await getGmailClient(userId);

    for (const patient of patients) {
      try {
        const messageRefs = await searchGmailMessages(gmail, patient.name);
        if (messageRefs.length === 0) continue;

        const messageIds = messageRefs.map((m) => m.id!);
        const existing = await prisma.email.findMany({
          where: { gmailMessageId: { in: messageIds } },
          select: { id: true, gmailMessageId: true },
        });
        const existingSet = new Set(existing.map((e) => e.gmailMessageId));
        const newMessageIds = messageIds.filter((id) => !existingSet.has(id));

        if (newMessageIds.length === 0) continue;

        // Fetch ONLY metadata — no body, no PDF, no EML
        const metadataMessages = await batchFetchMetadata(gmail, newMessageIds);

        for (const message of metadataMessages) {
          const meta = extractMessageMeta(message);
          const subjectInfo = meta.subject ? parseLabSubject(meta.subject) : null;
          const isLabReport = !!subjectInfo;

          const extractedData = subjectInfo?.patientName
            ? JSON.stringify({
                isLabReport: true,
                patientName: subjectInfo.patientName,
                gender: subjectInfo.gender,
                birthYear: subjectInfo.birthYear,
                metadataSource: "subject",
              })
            : null;

          await prisma.email.create({
            data: {
              ...meta,
              date: subjectInfo?.date ?? meta.date ?? null,
              body: null,
              htmlBody: null,
              isLabReport,
              extractedData,
              pdfPath: null,
              pdfData: null,
              emlPath: null,
              emlData: null,
              userId,
              patientId: patient.id,
            },
          });
          totalSynced++;
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

    // Check which emails already have metrics
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
