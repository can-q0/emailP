import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, disambiguateSchema } from "@/lib/validations";

// Extract 11-digit Turkish government IDs from text
function extractGovernmentIds(text: string): string[] {
  // Match standalone 11-digit numbers (TC Kimlik)
  const matches = text.match(/(?<!\d)\d{11}(?!\d)/g) || [];
  // Filter out obviously invalid ones (can't start with 0)
  return [...new Set(matches.filter((id) => !id.startsWith("0")))];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, disambiguateSchema);
  if (!parsed.success) return parsed.response;
  const { patientName, emailIds, governmentId, create } = parsed.data;

  const userId = session.user.id;

  // If "create" flag, upsert patient and return
  if (create) {
    const patient = await prisma.patient.upsert({
      where: {
        governmentId_userId: {
          governmentId: governmentId || `pending_${patientName.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_")}`,
          userId,
        },
      },
      update: { name: patientName },
      create: {
        name: patientName,
        governmentId: governmentId || `pending_${patientName.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_")}`,
        userId,
      },
    });
    return NextResponse.json({
      needsDisambiguation: false,
      candidates: [{ id: patient.id, name: patient.name, governmentId: patient.governmentId }],
    });
  }

  // Fetch synced emails to extract government IDs
  const emails = emailIds?.length
    ? await prisma.email.findMany({
        where: { id: { in: emailIds }, userId },
        select: { id: true, body: true, subject: true, date: true },
      })
    : [];

  // Group emails by government ID found in body
  const govIdMap = new Map<string, { emailIds: string[]; lastDate: Date | null }>();

  for (const email of emails) {
    const text = `${email.subject || ""} ${email.body || ""}`;
    const ids = extractGovernmentIds(text);

    for (const gid of ids) {
      const entry = govIdMap.get(gid);
      if (entry) {
        entry.emailIds.push(email.id);
        if (email.date && (!entry.lastDate || email.date > entry.lastDate)) {
          entry.lastDate = email.date;
        }
      } else {
        govIdMap.set(gid, {
          emailIds: [email.id],
          lastDate: email.date,
        });
      }
    }
  }

  // Check existing patients matching this name
  const existingPatients = await prisma.patient.findMany({
    where: { userId, name: { contains: patientName } },
    include: { _count: { select: { emails: true } } },
  });

  // Build candidate list: merge existing patients + newly discovered gov IDs
  const candidates: Array<{
    id: string | null;
    name: string;
    governmentId: string | null;
    emailCount: number;
    lastEmailDate?: string;
    source: "existing" | "extracted";
  }> = [];

  // Add existing patients
  for (const p of existingPatients) {
    candidates.push({
      id: p.id,
      name: p.name,
      governmentId: p.governmentId,
      emailCount: p._count.emails,
      source: "existing",
    });
  }

  // Add newly discovered gov IDs not already in existing patients
  const existingGovIds = new Set(existingPatients.map((p) => p.governmentId).filter(Boolean));

  for (const [gid, data] of govIdMap) {
    if (!existingGovIds.has(gid)) {
      candidates.push({
        id: null,
        name: patientName,
        governmentId: gid,
        emailCount: data.emailIds.length,
        lastEmailDate: data.lastDate?.toISOString(),
        source: "extracted",
      });
    }
  }

  // If no candidates at all, find or create a default patient
  if (candidates.length === 0) {
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
    candidates.push({
      id: patient.id,
      name: patient.name,
      governmentId: patient.governmentId,
      emailCount: 0,
      source: "existing",
    });
  }

  // If only 1 candidate but no DB record yet, create it
  if (candidates.length === 1 && !candidates[0].id) {
    const c = candidates[0];
    const patient = await prisma.patient.create({
      data: {
        name: c.name,
        governmentId: c.governmentId || `pending_${patientName.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_")}`,
        userId,
      },
    });
    candidates[0].id = patient.id;
  }

  return NextResponse.json({
    needsDisambiguation: candidates.length > 1,
    candidates,
  });
}
