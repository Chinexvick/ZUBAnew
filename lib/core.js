// Shared helpers: HTTP, validation, passwords, tokens, rate limits, audit.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { sql } from './db.js';

const scrypt = promisify(crypto.scrypt);

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const fail = (status, message, extra) => {
  throw new HttpError(status, message, extra);
};

function secret(name) {
  const v = process.env[name];
  if (!v || v.length < 32) throw new Error(`missing secret ${name}`);
  return v;
}

// ---------- HTTP ----------
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.end(JSON.stringify(body));
}

export async function readBody(req, max = 16 * 1024) {
  if (req.body && typeof req.body === 'object') {
    if (JSON.stringify(req.body).length > max) fail(413, 'Request too large');
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) fail(413, 'Request too large');
    chunks.push(c);
  }
  if (!size) return {};
  try {
    const b = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!b || typeof b !== 'object' || Array.isArray(b)) fail(400, 'Bad request');
    return b;
  } catch {
    fail(400, 'Bad request');
  }
}

export function clientIp(req) {
  const h = req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0];
  return String(h || req.socket?.remoteAddress || 'unknown').trim().slice(0, 64);
}

// ---------- validation ----------
export function str(v, { min = 0, max = 200, name = 'value' } = {}) {
  if (typeof v !== 'string') fail(400, `Missing ${name}`);
  const s = v.normalize('NFC').trim();
  if (s.length < min || s.length > max) fail(400, `Check your ${name}`);
  if (/[\u0000-\u001f\u007f]/.test(s)) fail(400, `Check your ${name}`);
  return s;
}
export function email(v) {
  const e = str(v, { min: 5, max: 254, name: 'email' }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) fail(400, 'Enter a valid email');
  return e;
}
export function username(v) {
  const u = str(v, { min: 3, max: 24, name: 'username' }).toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9][a-z0-9._]{2,23}$/.test(u)) fail(400, 'Usernames use 3-24 letters, numbers, dots or underscores');
  return u;
}
export function password(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) fail(400, 'Use a password of at least 8 characters');
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) fail(400, 'Use letters and numbers in your password');
  return v;
}
export const address = (v) => {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(v)) fail(400, 'Invalid wallet address');
  return v.toLowerCase();
};
export const txHash = (v) => {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(v)) fail(400, 'Invalid transaction hash');
  return v.toLowerCase();
};

// ---------- passwords ----------
const SC = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, SC);
  return `s1$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  try {
    const [v, s, k] = stored.split('$');
    if (v !== 's1') return false;
    const key = await scrypt(pw, Buffer.from(s, 'base64'), 64, SC);
    const want = Buffer.from(k, 'base64');
    return want.length === key.length && crypto.timingSafeEqual(want, key);
  } catch {
    return false;
  }
}
export const DUMMY_HASH = 's1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

// ---------- one-time codes ----------
export const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
export const codeHash = (userId, purpose, code) => crypto.createHmac('sha256', secret('OTP_PEPPER')).update(`${userId}:${purpose}:${code}`).digest('hex');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- access tokens (HS256, 15 minutes) ----------
const b64u = (b) => Buffer.from(b).toString('base64url');
export function signAccess(user) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ sub: String(user.id), sv: user.session_version, iat: now, exp: now + 900, aud: 'afrit' }));
  const sig = crypto.createHmac('sha256', secret('JWT_SECRET')).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
export function verifyAccess(token) {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const head = JSON.parse(Buffer.from(h, 'base64url'));
    if (head.alg !== 'HS256') return null;
    const want = crypto.createHmac('sha256', secret('JWT_SECRET')).update(`${h}.${b}`).digest('base64url');
    if (!safeEqual(want, s)) return null;
    const p = JSON.parse(Buffer.from(b, 'base64url'));
    if (p.aud !== 'afrit' || typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
    return { id: Number(p.sub), sv: p.sv };
  } catch {
    return null;
  }
}

/** Signed-in user, re-checked against the database on every request. */
export async function requireUser(req) {
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? verifyAccess(h.slice(7)) : null;
  if (!t) fail(401, 'Please sign in again');
  const [u] = await sql`select * from users where id = ${t.id}`;
  if (!u || u.session_version !== t.sv || !u.email_verified) fail(401, 'Please sign in again');
  return u;
}

export async function issueTokens(user, family = crypto.randomUUID()) {
  const refresh = crypto.randomBytes(32).toString('base64url');
  await sql`insert into refresh_tokens (user_id, family, token_hash, expires_at) values (${user.id}, ${family}, ${sha256(refresh)}, now() + interval '7 days')`;
  return { access: signAccess(user), refresh, expiresIn: 900 };
}

// ---------- rate limits (fixed windows in the database) ----------
export async function limit(key, max, windowSec) {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const [r] = await sql`insert into rate_hits (key, bucket, hits) values (${key}, ${bucket}, 1)
    on conflict (key, bucket) do update set hits = rate_hits.hits + 1 returning hits`;
  if (r.hits > max) fail(429, 'Too many attempts. Please wait a little and try again.');
}

export async function audit(userId, event, ip, meta = {}) {
  try {
    await sql`insert into audit (user_id, event, ip, meta) values (${userId}, ${event}, ${ip}, ${JSON.stringify(meta)})`;
  } catch {}
}

export function publicUser(u, wallet) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    username: u.username,
    kind: u.kind,
    bizName: u.biz_name,
    bizCategory: u.biz_category,
    language: u.language,
    level: u.level,
    premiumUntil: u.premium_until,
    premium: !!u.premium_until && new Date(u.premium_until) > new Date(),
    bio: u.bio ?? '',
    photo: u.photo_url || null,
    homeCountry: u.home_country ?? '',
    localHelper: !!u.local_helper,
    dms: u.dms ?? 'everyone',
    private: !!u.private,
    wallet: wallet ?? null,
  };
}
