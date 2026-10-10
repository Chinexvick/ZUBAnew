import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "zuba_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours
const LINK_TTL = 60 * 15; // sign-in links last 15 minutes

function secret() {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";
}

/* HMAC used for sessions, sign-in links and unsubscribe links. Each use passes its own purpose. */
export function sign(value: string, purpose = "session") {
  return createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function adminEmails() {
  return (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function emailLoginEnabled() {
  return Boolean(process.env.ADMIN_SECRET && adminEmails().length && process.env.SMTP_HOST);
}

export function passwordLoginEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function adminConfigured() {
  return emailLoginEnabled() || passwordLoginEnabled();
}

export function checkPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(sign(pw, "pw"), sign(expected, "pw"));
}

export function createSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return { value: `${exp}.${sign(exp)}`, maxAge: MAX_AGE };
}

export const sessionCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/* Sign-in link token: base64url(email).exp.sig */
export function createLoginToken(email: string) {
  const exp = String(Math.floor(Date.now() / 1000) + LINK_TTL);
  const e = Buffer.from(email.toLowerCase()).toString("base64url");
  return `${e}.${exp}.${sign(`${e}.${exp}`, "login")}`;
}

export function verifyLoginToken(token: string) {
  const [e, exp, sig] = token.split(".");
  if (!e || !exp || !sig || !safeEqual(sig, sign(`${e}.${exp}`, "login"))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const email = Buffer.from(e, "base64url").toString("utf8");
  return adminEmails().includes(email) ? email : null;
}

export async function isAdmin() {
  if (!adminConfigured()) return false;
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}
