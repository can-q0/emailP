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
  // Strip Fwd:/Re: prefixes (supports multiple: "Fwd: Fwd: ...")
  const cleaned = subject.replace(/^(?:(?:Fwd|Re|İlt|Ynt):\s*)+/gi, "").trim();

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

// --- Turkish date parsing ---

const TURKISH_MONTHS: Record<string, number> = {
  oca: 0, şub: 1, mar: 2, nis: 3, may: 4, haz: 5,
  tem: 6, ağu: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
};

export function parseTurkishDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Try native Date parsing first (English formats, ISO, etc.)
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) return native;

  // Turkish month abbreviation: "15 Oca 2024 14:30" or "15 Ocak 2024"
  const turkishMatch = trimmed.match(
    /(\d{1,2})\s+([A-Za-zÇçĞğİıÖöŞşÜü]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/
  );
  if (turkishMatch) {
    const [, day, monthStr, year, hours, minutes] = turkishMatch;
    const monthKey = monthStr.toLowerCase().slice(0, 3);
    const monthIdx = TURKISH_MONTHS[monthKey];
    if (monthIdx !== undefined) {
      const d = new Date(parseInt(year), monthIdx, parseInt(day),
        hours ? parseInt(hours) : 0, minutes ? parseInt(minutes) : 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // DD.MM.YYYY or DD/MM/YYYY
  const dotSlash = trimmed.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dotSlash) {
    const [, day, month, year] = dotSlash;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

// --- Forwarding header parsing ---

export interface ForwardedMessageInfo {
  from: string | null;
  to: string | null;
  date: Date | null;
  subject: string | null;
}

const FORWARDING_DELIMITERS = [
  "---------- Forwarded message ---------",
  "---------- İletilen ileti ----------",
  "-------- Original Message --------",
];

const KEY_MAP: Record<string, keyof ForwardedMessageInfo> = {
  from: "from",
  kimden: "from",
  date: "date",
  tarih: "date",
  sent: "date",
  subject: "subject",
  konu: "subject",
  to: "to",
  kime: "to",
};

export function parseForwardingHeaders(bodyText: string): ForwardedMessageInfo | null {
  if (!bodyText) return null;

  // Find the last (innermost) forwarding block
  let lastIdx = -1;
  for (const delim of FORWARDING_DELIMITERS) {
    const idx = bodyText.lastIndexOf(delim);
    if (idx > lastIdx) lastIdx = idx;
  }

  if (lastIdx === -1) return null;

  // Take text after the delimiter line
  const afterDelim = bodyText.slice(lastIdx);
  const lines = afterDelim.split("\n").slice(1); // skip delimiter line itself

  const info: ForwardedMessageInfo = { from: null, to: null, date: null, subject: null };
  let foundAny = false;

  for (const line of lines) {
    // Stop at empty line or next delimiter (end of header block)
    const trimmed = line.trim();
    if (!trimmed) {
      if (foundAny) break;
      continue;
    }

    // Parse "Key: Value" or "Key : Value"
    const kvMatch = trimmed.match(/^([A-Za-zÇçĞğİıÖöŞşÜü]+)\s*:\s*(.+)/);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase();
      const value = kvMatch[2].trim();
      const mapped = KEY_MAP[key];
      if (mapped) {
        foundAny = true;
        if (mapped === "date") {
          info.date = parseTurkishDate(value);
        } else {
          info[mapped] = value;
        }
      }
    }
  }

  return foundAny ? info : null;
}

// --- PDF metadata extraction ---

export interface PdfLabMetadata {
  patientName: string | null;
  governmentId: string | null;
  date: Date | null;
  birthDate: Date | null;
  gender: string | null;
}

export function parsePdfMetadata(pdfText: string): PdfLabMetadata {
  const result: PdfLabMetadata = {
    patientName: null,
    governmentId: null,
    date: null,
    birthDate: null,
    gender: null,
  };

  if (!pdfText) return result;

  // Patient name: "Hasta Adı:" or "Hasta Adı Soyadı:"
  const nameMatch = pdfText.match(/Hasta\s+Ad[ıi]\s*(?:Soyad[ıi]\s*)?:\s*(.+)/i);
  if (nameMatch) {
    result.patientName = nameMatch[1].trim().split(/\s{2,}|\t|\n/)[0].trim();
  }

  // TC Kimlik No: 11-digit number near TC/Kimlik keywords
  const tcMatch = pdfText.match(/(?:TC|T\.C\.|Kimlik)\s*(?:No|Numaras[ıi])?\s*:?\s*(\d{11})/i);
  if (tcMatch) {
    result.governmentId = tcMatch[1];
  }

  // Report/sample date: DD.MM.YYYY
  const dateMatch = pdfText.match(
    /(?:Rapor|Numune|İstek|Onay)\s*Tarih[iı]\s*:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/i
  );
  if (dateMatch) {
    result.date = parseTurkishDate(dateMatch[1]);
  }
  // Fallback: generic "Tarih:" if no specific date found
  if (!result.date) {
    const genericDate = pdfText.match(/Tarih\s*:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/i);
    if (genericDate) {
      result.date = parseTurkishDate(genericDate[1]);
    }
  }

  // Birth date
  const birthMatch = pdfText.match(/Do[ğg]um\s*Tarih[iı]\s*:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/i);
  if (birthMatch) {
    result.birthDate = parseTurkishDate(birthMatch[1]);
  }

  // Gender
  const genderMatch = pdfText.match(/Cinsiyet\s*:\s*(\S+)/i);
  if (genderMatch) {
    const val = genderMatch[1].trim().toUpperCase();
    if (val === "ERKEK" || val === "E") result.gender = "Male";
    else if (val === "KADIN" || val === "K" || val === "KADIN") result.gender = "Female";
  }

  return result;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function decodeBase64UrlToBuffer(data: string): Buffer {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}
