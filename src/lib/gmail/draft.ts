/**
 * Gmail draft delivery — create a draft email (with optional attachment) in
 * the configured owner's Gmail mailbox. Used as an optional pipeline step so
 * generated drafts land in the inbox ready to review and send.
 *
 * Env vars (all required to enable; if any unset, createGmailDraft is a no-op):
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN  — obtained once via OAuth playground or a CLI dance.
 *   GMAIL_FROM           — sender address. Must match the authorized account.
 *
 * One-time setup:
 *   1. Create an OAuth 2.0 client (type "Web application") in Google Cloud Console.
 *   2. Add https://developers.google.com/oauthplayground as an authorized redirect.
 *   3. Open OAuth Playground → settings → use your own client ID/secret.
 *   4. Authorize https://www.googleapis.com/auth/gmail.compose
 *   5. Exchange auth code for tokens; copy the refresh_token.
 */

import { google, gmail_v1 } from "googleapis";

interface CreateGmailDraftInput {
  to: string;
  subject: string;
  bodyText: string;
  attachment?: {
    filename: string;
    contentType: string;
    data: Buffer;
  };
}

interface CreateGmailDraftResult {
  ok: boolean;
  draftId?: string;
  reason?: string;
}

let cachedClient: gmail_v1.Gmail | null = null;

function getGmailClient(): gmail_v1.Gmail | null {
  if (cachedClient) return cachedClient;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  cachedClient = google.gmail({ version: "v1", auth: oauth2 });
  return cachedClient;
}

function encodeHeader(value: string): string {
  // RFC 2047 encode any non-ASCII subject content. Ascii-only stays bare.
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function buildMimeMessage(input: CreateGmailDraftInput, from: string): string {
  const { to, subject, bodyText, attachment } = input;

  if (!attachment) {
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      bodyText,
    ].join("\r\n");
  }

  const boundary = `=_demodraft_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const attachmentB64 = attachment.data
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyText,
    "",
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    attachmentB64,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createGmailDraft(
  input: CreateGmailDraftInput
): Promise<CreateGmailDraftResult> {
  const gmail = getGmailClient();
  const from = process.env.GMAIL_FROM;

  if (!gmail || !from) {
    return { ok: false, reason: "Gmail not configured" };
  }

  try {
    const raw = toBase64Url(buildMimeMessage(input, from));
    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw } },
    });
    return { ok: true, draftId: response.data.id ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, reason: message };
  }
}

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GMAIL_FROM
  );
}
