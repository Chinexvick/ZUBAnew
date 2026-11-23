// Email through the ZUBA SMTP account (STARTTLS on 587). All text is escaped.
import nodemailer from 'nodemailer';

let transport;
let sender = null; // tests replace this
export function useMailer(fn) {
  sender = fn;
}

function mailer() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
  return transport;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function wrap(title, inner) {
  return `<!doctype html><html><body style="margin:0;background:#EFF4EC;padding:24px 0;font-family:Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center">
<table role="presentation" width="440" style="max-width:440px;background:#ffffff;border-radius:18px;padding:28px">
<tr><td style="font:800 18px Arial;color:#1E5631">AfriT Hub</td></tr>
<tr><td style="padding-top:14px;font:800 20px Arial;color:#142017">${esc(title)}</td></tr>
<tr><td style="padding-top:10px;font:14px/1.6 Arial;color:#3c463d">${inner}</td></tr>
<tr><td style="padding-top:22px;font:12px/1.5 Arial;color:#6E786F">If this wasn't you, change your password straight away. AfriT Hub will never ask for your password, recovery phrase or private key.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(to, subject, title, innerHtml, text) {
  const msg = { from: `AfriT Hub <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, to, subject, html: wrap(title, innerHtml), text };
  if (sender) return sender(msg);
  return mailer().sendMail(msg);
}

export function sendCode(to, code, purpose) {
  const title = purpose === 'reset' ? 'Reset your password' : 'Verify your email';
  const line = purpose === 'reset' ? 'Use this code to reset your AfriT Hub password. It expires in 10 minutes.' : 'Welcome to AfriT Hub! Use this code to verify your email. It expires in 10 minutes.';
  const box = `<div style="margin:18px 0;font:800 32px Arial;letter-spacing:10px;color:#1E5631">${esc(code)}</div>`;
  return sendMail(to, `${code} is your AfriT Hub code`, title, `${esc(line)}${box}`, `${line}\n\n${code}`);
}

export function sendNotice(to, title, text) {
  return sendMail(to, title, title, esc(text), text);
}
