import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGmailClient, searchGmailMessages, GmailTokenError } from "@/lib/gmail";
import { parseSearchParams, gmailSearchSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSearchParams(req, gmailSearchSchema);
  if (!parsed.success) return parsed.response;
  const { q: query } = parsed.data;

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
    if (error instanceof GmailTokenError) {
      return NextResponse.json(
        { error: "gmail_token_expired", message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to search Gmail" },
      { status: 500 }
    );
  }
}
