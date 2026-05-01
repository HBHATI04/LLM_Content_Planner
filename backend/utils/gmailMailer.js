const { google } = require("googleapis");

/**
 * Sends an email using the Gmail REST API (HTTPS / port 443).
 * No SMTP ports used — works on Render and any host.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID      — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  — from Google Cloud Console
 *   GMAIL_REFRESH_TOKEN   — obtained via OAuth2 Playground (one-time setup)
 *   EMAIL_USER            — your Gmail address (e.g. you@gmail.com)
 */
const sendEmail = async ({ to, subject, html }) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground" // redirect URI used during token generation
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Build a raw RFC 2822 MIME message
  const fromHeader = `"LLM Content Planner" <${process.env.EMAIL_USER}>`;
  const mimeLines = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join("\r\n");

  // Gmail API requires base64url encoding
  const encodedMessage = Buffer.from(mimeLines)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
};

module.exports = { sendEmail };
