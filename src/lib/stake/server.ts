// The website side of ZUBA Staking. This code can READ the staking database and ADD requests to it.
// It cannot change a balance: its database login has no such permission. The worker does the work.
import { createHash, constants, publicEncrypt, randomBytes } from "crypto";
import { Pool } from "pg";

const env = (k: string) => process.env[k] || "";
export const stakeEnabled = () => env("STAKE_ENABLED") === "1" && Boolean(env("STAKE_DATABASE_URL"));

let pool: Pool | undefined;
export function db() {
  if (!pool) {
    pool = new Pool({ connectionString: env("STAKE_DATABASE_URL"), max: 3, idleTimeoutMillis: 20_000 });
    pool.on("error", () => {});
  }
  return pool;
}

export class Fail extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new Fail(status, message);
};

// ---- settings written by the worker / set-up, read here --------------------------------------
type Conf = Record<string, string>;
let confCache: { at: number; v: Conf } | undefined;
export async function config(): Promise<Conf> {
  if (confCache && Date.now() - confCache.at < 30_000) return confCache.v;
  const { rows } = await db().query("select key, value from stake_config");
  const v: Conf = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  confCache = { at: Date.now(), v };
  return v;
}

// ---- rate limits (fixed window) -----------------------------------------------------------------
export async function limited(key: string, max: number, windowSec: number) {
  const { rows } = await db().query(
    `insert into stake_rate (key, count, window_start) values ($1, 1, now())
     on conflict (key) do update set
       count = case when stake_rate.window_start < now() - make_interval(secs => $2) then 1 else stake_rate.count + 1 end,
       window_start = case when stake_rate.window_start < now() - make_interval(secs => $2) then now() else stake_rate.window_start end
     returning count`,
    [key, windowSec],
  );
  return rows[0].count > max;
}

// ---- sessions: a random token in a cookie the page's scripts cannot read; only its hash is stored ----
const secure = process.env.NODE_ENV === "production";
export const COOKIE = secure ? "__Host-zstake" : "zstake";
const IDLE_MIN = 30;
const MAX_HOURS = 12;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure, sameSite: "strict" as const, path: "/", maxAge });

export async function createSession(userId: string, email: string, ip: string, ua: string) {
  const token = randomBytes(32).toString("base64url");
  await db().query("delete from stake_sessions where expires_at < now() or last_seen < now() - make_interval(mins => $1)", [IDLE_MIN]);
  await db().query("insert into stake_sessions (token_hash, user_id, email, expires_at, ip, ua) values ($1, $2, $3, now() + make_interval(hours => $4), $5, $6)", [sha(token), userId, email, MAX_HOURS, ip.slice(0, 60), ua.slice(0, 200)]);
  return { token, maxAge: MAX_HOURS * 3600 };
}
export type Session = { userId: string; email: string; hash: string };
export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 100) return null;
  const { rows } = await db().query(
    `update stake_sessions set last_seen = now()
      where token_hash = $1 and expires_at > now() and last_seen > now() - make_interval(mins => $2)
      returning user_id, email`,
    [sha(token), IDLE_MIN],
  );
  return rows[0] ? { userId: rows[0].user_id, email: rows[0].email, hash: sha(token) } : null;
}
export const endSession = (token: string) => db().query("delete from stake_sessions where token_hash = $1", [sha(token)]);

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
/** Requests that change something must come from our own pages (a second guard on top of the strict cookie). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host && req.headers.get("x-zs") === "1";
  } catch {
    return false;
  }
}

// ---- sign-in: the password is checked by the Zualingo account service, never stored or seen again here ----
export async function accountLogin(email: string, password: string) {
  const base = env("STAKE_AUTH_URL").replace(/\/+$/, "");
  let r: Response;
  try {
    r = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(12_000), cache: "no-store" });
  } catch {
    return fail(502, "Sign-in is not reachable right now. Please try again.");
  }
  const j = (await r.json().catch(() => ({}))) as { error?: string; next?: string; refresh?: string; user?: { id?: string; email?: string } };
  if (r.status === 403 && j.next === "verify") fail(403, "Verify your email in the Zualingo app or ZUBA Arcade first, then sign in here.");
  if (r.status === 429) fail(429, j.error || "Too many attempts. Try again later.");
  if (!r.ok || !j.user?.id || !/^[0-9a-f-]{36}$/i.test(j.user.id)) fail(401, "Wrong email or password");
  // we do not need the long-lived app token here: end it straight away
  if (j.refresh) fetch(`${base}/auth/logout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh: j.refresh }), signal: AbortSignal.timeout(8_000), cache: "no-store" }).catch(() => {});
  return { id: j.user!.id!.toLowerCase(), email: String(j.user!.email || email) };
}

// ---- two-factor: the secret is made here, shown once, and locked so that only the worker can open it ----
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret() {
  let bits = "", out = "";
  for (const x of randomBytes(20)) bits += x.toString(2).padStart(8, "0");
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
export function sealForWorker(plain: string) {
  const pem = Buffer.from(env("STAKE_SEAL_PUB_B64"), "base64").toString("utf8");
  return "r1." + publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(plain, "utf8")).toString("base64");
}
export const otpauthUrl = (secret: string, email: string, test: boolean) => {
  const issuer = test ? "ZUBA Staking TEST" : "ZUBA Staking";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
};

// ---- asking the worker ---------------------------------------------------------------------------------
export async function kickWorker(mode: "requests" | "chain", timeoutMs: number) {
  const url = env("STAKE_WORKER_URL");
  if (!url) return; // an always-on worker picks requests up by itself
  try {
    await fetch(`${url.replace(/\/+$/, "")}/api/tick?mode=${mode}`, { method: "POST", headers: { authorization: `Bearer ${env("STAKE_TICK_TOKEN")}` }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch {
    /* the worker also runs on its own schedule */
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export type Answer = { http: number; error: string | null; result: Record<string, unknown> | null };
/** Adds a request for the worker and waits for its answer. */
export async function ask(userId: string, kind: string, payload: Record<string, unknown>): Promise<Answer> {
  const { rows } = await db().query("insert into stake_requests (user_id, kind, payload) values ($1, $2, $3) returning id", [userId, kind, JSON.stringify(payload)]);
  const id = rows[0].id;
  const until = Date.now() + 25_000;
  while (Date.now() < until) {
    await kickWorker("requests", 12_000);
    const r = await db().query("select status, http, error, result from stake_requests where id = $1", [id]);
    if (r.rows[0] && r.rows[0].status !== "new") return { http: r.rows[0].http, error: r.rows[0].error, result: r.rows[0].result };
    await sleep(450);
  }
  return { http: 504, error: "This is taking longer than usual. Refresh in a moment to see whether it went through.", result: null };
}
