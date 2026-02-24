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

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}
