import { google, gmail_v1 } from "googleapis";
import { prisma } from "@/lib/prisma";

export class GmailTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailTokenError";
  }
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
);

export async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new GmailTokenError("No Google account linked. Please reconnect your Google account.");
  }

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  // Check if token is expired and refresh
  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : null,
          refresh_token: credentials.refresh_token ?? account.refresh_token,
        },
      });
    } catch (error) {
      // Clear stale tokens so the user can re-authenticate
      await prisma.account.update({
        where: { id: account.id },
        data: { access_token: null, expires_at: null },
      });
      throw new GmailTokenError(
        `Gmail token refresh failed — please reconnect your Google account.`
      );
    }
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function searchGmailMessages(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults = 50
): Promise<gmail_v1.Schema$Message[]> {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  return res.data.messages || [];
}

export async function fetchGmailMessage(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<gmail_v1.Schema$Message> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  return res.data;
}

export async function batchFetchMessages(
  gmail: gmail_v1.Gmail,
  messageIds: string[],
  concurrency = 10
): Promise<gmail_v1.Schema$Message[]> {
  const results: gmail_v1.Schema$Message[] = [];

  for (let i = 0; i < messageIds.length; i += concurrency) {
    const batch = messageIds.slice(i, i + concurrency);
    const promises = batch.map((id) => fetchGmailMessage(gmail, id));
    const batchResults = await Promise.allSettled(promises);

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | undefined {
  return headers?.find(
    (h) => h.name?.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR")
  )?.value ?? undefined;
}

export async function fetchAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string
): Promise<string> {
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  return res.data.data || "";
}

export function extractMessageMeta(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers;
  return {
    gmailMessageId: message.id!,
    threadId: message.threadId ?? null,
    subject: getHeader(headers, "Subject") ?? null,
    from: getHeader(headers, "From") ?? null,
    to: getHeader(headers, "To") ?? null,
    date: getHeader(headers, "Date")
      ? new Date(getHeader(headers, "Date")!)
      : null,
    snippet: message.snippet ?? null,
    labels: JSON.stringify(message.labelIds ?? []),
  };
}
