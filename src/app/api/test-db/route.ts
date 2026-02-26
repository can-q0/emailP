import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ ok: true, userCount: count });
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    return NextResponse.json(
      { ok: false, error: err.message, code: err.code },
      { status: 500 }
    );
  }
}
