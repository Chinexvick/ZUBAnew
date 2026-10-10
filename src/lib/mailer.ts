import nodemailer, { type Transporter } from "nodemailer";

export function mailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function siteUrl() {
  return (process.env.SITE_URL || "https://www.zubatoken.com").replace(/\/+$/, "");
}

let transport: Transporter | null = null;

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 587 upgrades with STARTTLS
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true,
      maxConnections: 2,
      connectionTimeout: 15_000,
    });
  }
  return transport;
}

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
};

export async function sendMail(m: Mail) {
  if (!mailEnabled()) throw new Error("Email is not set up (SMTP_HOST, SMTP_USER, SMTP_PASS).");
  const from = process.env.MAIL_FROM || `ZUBA <${process.env.SMTP_USER}>`;
  await getTransport().sendMail({
    from,
    replyTo: process.env.SMTP_USER,
    to: m.to,
    subject: m.subject,
    html: m.html,
    text: m.text,
    headers: m.unsubscribeUrl
      ? { "List-Unsubscribe": `<${m.unsubscribeUrl.replace("/unsubscribe?", "/api/unsubscribe?")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  });
}
