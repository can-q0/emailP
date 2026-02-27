import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json([]);
  }

  // Query distinct patient names extracted from email subjects (stored in extractedData JSON).
  // SQLite supports json_extract, so we pull patientName from the JSON column.
  const rows = await prisma.$queryRaw<
    { patientName: string; emailCount: number }[]
  >`
    SELECT
      json_extract(extractedData, '$.patientName') AS patientName,
      COUNT(*) AS emailCount
    FROM Email
    WHERE userId = ${session.user.id}
      AND extractedData IS NOT NULL
      AND json_extract(extractedData, '$.patientName') IS NOT NULL
      AND json_extract(extractedData, '$.patientName') LIKE ${"%" + q + "%"}
    GROUP BY patientName
    ORDER BY emailCount DESC
    LIMIT 10
  `;

  return NextResponse.json(
    rows.map((r) => ({
      name: r.patientName,
      emailCount: Number(r.emailCount),
    }))
  );
}
