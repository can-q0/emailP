import { gmail_v1 } from "googleapis";
import { convert } from "html-to-text";

export function extractBody(message: gmail_v1.Schema$Message): {
  text: string;
  html: string;
} {
  let text = "";
  let html = "";

  function walkParts(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;

    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text += decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html += decodeBase64Url(part.body.data);
      }

      if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  // Single-part message
  const payload = message.payload;
  if (payload?.body?.data) {
    if (payload.mimeType === "text/html") {
      html = decodeBase64Url(payload.body.data);
    } else {
      text = decodeBase64Url(payload.body.data);
    }
  }

  // Multi-part message
  walkParts(payload?.parts);

  // Convert HTML to text if no plain text found
  if (!text && html) {
    text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a", options: { ignoreHref: true } },
      ],
    });
  }

  return { text, html };
}

/**
 * Find PDF attachment parts in a Gmail message.
 * Returns array of { filename, attachmentId, data } objects.
 * `data` is set for inline attachments; `attachmentId` for large ones needing a separate fetch.
 */
export function findPdfParts(
  message: gmail_v1.Schema$Message
): Array<{
  filename: string;
  attachmentId: string | null;
  data: string | null; // base64url-encoded
}> {
  const results: Array<{
    filename: string;
    attachmentId: string | null;
    data: string | null;
  }> = [];

  function walk(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (
        part.mimeType === "application/pdf" &&
        part.filename
      ) {
        results.push({
          filename: part.filename,
          attachmentId: part.body?.attachmentId ?? null,
          data: part.body?.data ?? null,
        });
      }
      if (part.parts) walk(part.parts);
    }
  }

  walk(message.payload?.parts);
  return results;
}

/**
 * Parse a lab email subject line.
 * Format: "Fwd: ENİS ARPACI 2024 04 LB E 1963"
 *         "Fwd: NAME NAME YYYY MM CODE GENDER BIRTHYEAR"
 *
 * Returns extracted patient name and test date, or null if not matching.
 */
export function parseLabSubject(subject: string): {
  patientName: string;
  date: Date | null;
  birthYear: number | null;
  gender: string | null;
} | null {
  // Strip Fwd:/Re: prefixes
  const cleaned = subject.replace(/^(?:Fwd|Re|İlt|Ynt):\s*/gi, "").trim();

  // Pattern: NAME(s) YYYY MM [CODE] [GENDER] [BIRTHYEAR]
  // The name is everything before the first 4-digit year
  const match = cleaned.match(
    /^(.+?)\s+(\d{4})\s+(\d{2})(?:\s+\w+)?(?:\s+([EK]))?(?:\s+(\d{4}))?$/i
  );

  if (!match) return null;

  const [, rawName, year, month, gender, birthYear] = match;
  const patientName = rawName.trim();

  // Build date from year + month (day=1)
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);

  return {
    patientName,
    date: isNaN(date.getTime()) ? null : date,
    birthYear: birthYear ? parseInt(birthYear) : null,
    gender: gender ? (gender.toUpperCase() === "E" ? "Male" : "Female") : null,
  };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function decodeBase64UrlToBuffer(data: string): Buffer {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}
