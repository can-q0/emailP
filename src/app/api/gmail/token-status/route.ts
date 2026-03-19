import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "google" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });

  if (!account) {
    return NextResponse.json({ expired: true, reason: "no_account" });
  }

  if (!account.access_token && !account.refresh_token) {
    return NextResponse.json({ expired: true, reason: "no_credentials" });
  }

  if (!account.access_token) {
    return NextResponse.json({ expired: true, reason: "token_cleared" });
  }

  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    // Token expired but refresh_token might still work — report as warning
    return NextResponse.json({
      expired: !account.refresh_token,
      warning: true,
      reason: "access_token_expired",
    });
  }

  return NextResponse.json({ expired: false });
}
