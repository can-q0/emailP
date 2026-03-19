import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getGmailClient,
  fetchGmailMessage,
  fetchAttachment,
} from "@/lib/gmail";
import { findPdfParts, decodeBase64UrlToBuffer } from "@/lib/email-parser";
import { saveEmailPdf } from "@/lib/pdf-storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId } = await params;

  const email = await prisma.email.findFirst({
    where: { id: emailId, userId: session.user.id },
    select: {
      id: true,
      gmailMessageId: true,
      subject: true,
      from: true,
      date: true,
      body: true,
      snippet: true,
      pdfPath: true,
      pdfData: true,
      patient: { select: { name: true } },
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If no cached PDF, try fetching from Gmail on-demand
  let hasPdf = !!email.pdfData;
  let pdfPath = email.pdfPath;
  if (!hasPdf && email.gmailMessageId) {
    try {
      const gmail = await getGmailClient(session.user.id);
      const message = await fetchGmailMessage(gmail, email.gmailMessageId);
      const pdfParts = findPdfParts(message);

      for (const part of pdfParts) {
        let raw: string;
        if (part.data) {
          raw = part.data;
        } else if (part.attachmentId) {
          raw = await fetchAttachment(gmail, email.gmailMessageId, part.attachmentId);
        } else {
          continue;
        }
        const buffer = decodeBase64UrlToBuffer(raw);
        const filename = part.filename || `${email.gmailMessageId}.pdf`;
        pdfPath = await saveEmailPdf(session.user.id, email.gmailMessageId, filename, buffer);
        hasPdf = true;
        break;
      }
    } catch (err) {
      console.error("On-demand PDF fetch failed for email", emailId, err);
    }
  }

  return NextResponse.json({
    id: email.id,
    subject: email.subject,
    from: email.from,
    date: email.date?.toISOString(),
    body: email.body,
    snippet: email.snippet,
    pdfPath: hasPdf ? pdfPath : null,
    patientName: email.patient?.name,
  });
}
