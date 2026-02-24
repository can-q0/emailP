import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGmailClient, searchGmailMessages } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const gmail = await getGmailClient(session.user.id);
    const messages = await searchGmailMessages(gmail, query);

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
      })),
      total: messages.length,
    });
  } catch (error) {
    console.error("Gmail search error:", error);
    return NextResponse.json(
      { error: "Failed to search Gmail" },
      { status: 500 }
    );
  }
}
