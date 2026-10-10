// Dev Notes subscribers, one private blob per address: subscribers/<base64url(email)>.json
import { sign, safeEqual } from "./auth";
import { blobEnabled, listPaths, readJson, removeBlob, writeJson } from "./blob";
import { siteUrl } from "./mailer";

const PREFIX = "subscribers/";
const NOTIFIED = "meta/notified.json";

export type Subscriber = { email: string; createdAt: string; source: string };

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i;

export function normalizeEmail(raw: unknown) {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

const keyFor = (email: string) => `${PREFIX}${Buffer.from(email).toString("base64url")}.json`;
const emailFromKey = (key: string) => Buffer.from(key.slice(PREFIX.length).replace(/\.json$/, ""), "base64url").toString("utf8");

export function subscribersEnabled() {
  return blobEnabled();
}

/* Returns true when the address is new. */
export async function addSubscriber(email: string, source: string) {
  const key = keyFor(email);
  if (await readJson<Subscriber>(key)) return false;
  await writeJson(key, { email, createdAt: new Date().toISOString(), source } satisfies Subscriber);
  return true;
}

export async function removeSubscriber(email: string) {
  await removeBlob(keyFor(email)).catch(() => undefined);
}

export async function listSubscribers() {
  return (await listPaths(PREFIX)).map(emailFromKey).filter((e) => EMAIL_RE.test(e)).sort();
}

export async function getSubscriber(email: string) {
  return readJson<Subscriber>(keyFor(email));
}

/* Unsubscribe links carry the address and an HMAC so nobody can unsubscribe someone else. */
export function unsubscribeUrl(email: string) {
  const e = Buffer.from(email).toString("base64url");
  return `${siteUrl()}/unsubscribe?e=${e}&s=${sign(e, "unsub").slice(0, 32)}`;
}

export function verifyUnsubscribe(e: string, s: string) {
  if (!e || !s || !safeEqual(s, sign(e, "unsub").slice(0, 32))) return null;
  return normalizeEmail(Buffer.from(e, "base64url").toString("utf8"));
}

/* Which dev notes have already gone out, so a note is never emailed twice by accident. */
export async function notifiedSlugs() {
  return (await readJson<Record<string, string>>(NOTIFIED)) ?? {};
}

export async function markNotified(slug: string) {
  const map = await notifiedSlugs();
  map[slug] = new Date().toISOString();
  await writeJson(NOTIFIED, map);
}
