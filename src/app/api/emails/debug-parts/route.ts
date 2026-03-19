import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getGmailClient, fetchGmailMessage } from "@/lib/gmail";
import { findPdfParts } from "@/lib/email-parser";
import { gmail_v1 } from "googleapis";

/**
 * GET /api/emails/debug-parts?emailId=xxx
 * Fetches the raw Gmail message and returns its MIME part structure.
 * For debugging PDF detection issues.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const emailId = req.nextUrl.searchParams.get("emailId");
    if (!emailId) {
      return NextResponse.json({ error: "emailId required" }, { status: 400 });
    }

    const email = await prisma.email.findFirst({
      where: { id: emailId, userId: session.user.id },
      select: { gmailMessageId: true, subject: true, body: true, pdfPath: true },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    let gmailStructure: object | null = null;
    let pdfPartsFound: number | null = null;
    let gmailError: string | null = null;

    try {
      const gmail = await getGmailClient(session.user.id);
      const message = await fetchGmailMessage(gmail, email.gmailMessageId);

      // Check what findPdfParts returns
      const pdfs = findPdfParts(message);
      pdfPartsFound = pdfs.length;

      // Recursively extract part structure
      function describePart(part: gmail_v1.Schema$MessagePart): object {
        return {
          mimeType: part.mimeType,
          filename: part.filename || null,
          hasData: !!part.body?.data,
          dataSize: part.body?.size || 0,
          attachmentId: part.body?.attachmentId || null,
          headers: (part.headers || [])
            .filter((h) => ["content-type", "content-disposition"].includes((h.name || "").toLowerCase()))
            .map((h) => `${h.name}: ${h.value}`),
          parts: part.parts?.map((p) => describePart(p)) || [],
        };
      }

      gmailStructure = message.payload ? describePart(message.payload) : null;
    } catch (err) {
      gmailError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      emailId,
      subject: email.subject,
      gmailMessageId: email.gmailMessageId,
      dbBodyLength: email.body?.length || 0,
      dbPdfPath: email.pdfPath,
      pdfPartsFound,
      gmailError,
      payload: gmailStructure,
    });
  } catch (err) {
    console.error("[debug-parts] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
