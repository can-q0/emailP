import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classifyEmail } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { patientName, emailIds } = await req.json();

  if (!patientName || !emailIds?.length) {
    return NextResponse.json(
      { error: "Patient name and email IDs required" },
      { status: 400 }
    );
  }

  // Fetch emails
  const emails = await prisma.email.findMany({
    where: { id: { in: emailIds }, userId: session.user.id },
    select: { id: true, subject: true, body: true, from: true, date: true },
  });

  // Extract government IDs from emails using AI
  const candidates: Map<
    string,
    { governmentId: string; name: string; emailIds: string[]; lastDate?: Date }
  > = new Map();

  for (const email of emails) {
    if (!email.body) continue;

    try {
      const classification = await classifyEmail(
        email.body,
        email.subject || ""
      );

      if (classification.governmentId) {
        const key = classification.governmentId;
        const existing = candidates.get(key);
        if (existing) {
          existing.emailIds.push(email.id);
          if (email.date && (!existing.lastDate || email.date > existing.lastDate)) {
            existing.lastDate = email.date;
          }
        } else {
          candidates.set(key, {
            governmentId: classification.governmentId,
            name: classification.patientName || patientName,
            emailIds: [email.id],
            lastDate: email.date ?? undefined,
          });
        }
      }
    } catch {
      // Skip emails that fail classification
    }
  }

  // Also check for existing patients with this name
  const existingPatients = await prisma.patient.findMany({
    where: {
      userId: session.user.id,
      name: { contains: patientName, mode: "insensitive" },
    },
    include: {
      _count: { select: { emails: true } },
      emails: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });

  const result = [
    ...existingPatients.map((p) => ({
      id: p.id,
      name: p.name,
      governmentId: p.governmentId,
      emailCount: p._count.emails,
      lastEmailDate: p.emails[0]?.date?.toISOString(),
      source: "existing" as const,
    })),
    ...[...candidates.values()]
      .filter(
        (c) =>
          !existingPatients.some(
            (p) => p.governmentId === c.governmentId
          )
      )
      .map((c) => ({
        id: null,
        name: c.name,
        governmentId: c.governmentId,
        emailCount: c.emailIds.length,
        lastEmailDate: c.lastDate?.toISOString(),
        source: "extracted" as const,
      })),
  ];

  return NextResponse.json({
    needsDisambiguation: result.length > 1,
    candidates: result,
  });
}
