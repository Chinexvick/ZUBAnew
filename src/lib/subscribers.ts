// Dev Notes subscribers, one private blob per address: subscribers/<base64url(email)>.json
import { sign, safeEqual } from "./auth";
import { blobEnabled, createJson, listPaths, readJson, removeBlob, writeJson } from "./blob";
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

/* Returns true when the address is new. Atomic, so parallel requests can't send two welcomes. */
export async function addSubscriber(email: string, source: string) {
  return createJson(keyFor(email), { email, createdAt: new Date().toISOString(), source } satisfies Subscriber);
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

/* Broadcast progress per dev note: `cursor` is the last address emailed (the list is sorted),
   `at` is set once every subscriber has it. A cut-off send resumes from the cursor. */
export type Broadcast = { at?: string; cursor?: string };

export async function broadcasts() {
  return (await readJson<Record<string, Broadcast>>(NOTIFIED)) ?? {};
}

export async function saveBroadcast(slug: string, b: Broadcast) {
  const map = await broadcasts();
  map[slug] = b;
  await writeJson(NOTIFIED, map);
}

/* Throttle for emails anyone can trigger (admin sign-in links): one per key per window. */
export async function allowOnce(key: string, seconds: number) {
  const path = `meta/throttle-${Buffer.from(key).toString("base64url")}.json`;
  const last = await readJson<{ at: number }>(path);
  if (last && Date.now() - last.at < seconds * 1000) return false;
  await writeJson(path, { at: Date.now() });
  return true;
}
