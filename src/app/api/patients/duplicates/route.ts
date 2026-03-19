import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Levenshtein distance between two strings
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

// Normalize Turkish characters for comparison
function normalize(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ı/g, "i")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patients = await prisma.patient.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      governmentId: true,
      _count: { select: { emails: true, reports: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const duplicates: Array<{
    patientA: { id: string; name: string; governmentId: string | null; emailCount: number };
    patientB: { id: string; name: string; governmentId: string | null; emailCount: number };
    similarity: number;
    reason: string;
  }> = [];

  for (let i = 0; i < patients.length; i++) {
    for (let j = i + 1; j < patients.length; j++) {
      const a = patients[i];
      const b = patients[j];

      // Check same government ID (exact match, ignoring pending_)
      const aGov = a.governmentId?.startsWith("pending_") ? null : a.governmentId;
      const bGov = b.governmentId?.startsWith("pending_") ? null : b.governmentId;

      if (aGov && bGov && aGov === bGov) {
        duplicates.push({
          patientA: { id: a.id, name: a.name, governmentId: a.governmentId, emailCount: a._count.emails },
          patientB: { id: b.id, name: b.name, governmentId: b.governmentId, emailCount: b._count.emails },
          similarity: 1.0,
          reason: "Same government ID",
        });
        continue;
      }

      // Check name similarity
      const sim = similarity(a.name, b.name);
      if (sim >= 0.75) {
        duplicates.push({
          patientA: { id: a.id, name: a.name, governmentId: a.governmentId, emailCount: a._count.emails },
          patientB: { id: b.id, name: b.name, governmentId: b.governmentId, emailCount: b._count.emails },
          similarity: Math.round(sim * 100) / 100,
          reason: sim >= 0.9 ? "Very similar names" : "Similar names",
        });
      }
    }
  }

  // Sort by similarity descending
  duplicates.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json(duplicates.slice(0, 10));
}
