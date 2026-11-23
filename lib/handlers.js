import crypto from 'node:crypto';
import { sql } from './db.js';
import {
  DUMMY_HASH, address, audit, clientIp, codeHash, email, fail, hashPassword, issueTokens, limit, newCode, password, publicUser, readBody,
  requireUser, safeEqual, sha256, str, txHash, username, verifyPassword,
} from './core.js';
import { sendCode, sendNotice } from './mail.js';
import { checkPayment, signerOf, zubaPerUsd, ZUBA_DECIMALS } from './chain.js';
import { mediaUrl, wipe } from './social.js';

// Prices live on the server; the app only displays them.
export const PLANS = {
  premium: { month: { usd: 4, days: 30, label: 'Monthly' }, half: { usd: 16, days: 182, label: '6 months' }, year: { usd: 30, days: 365, label: 'Yearly' } },
  promo: { day: { usd: 5, days: 1, label: 'Daily' }, week: { usd: 25, days: 7, label: 'Weekly' }, month: { usd: 79, days: 30, label: 'Monthly' }, year: { usd: 699, days: 365, label: 'Yearly' } },
};
const PAY_TOLERANCE_BP = () => BigInt(process.env.PAY_TOLERANCE_BP || '600'); // allows ZUBA's own transfer tax

async function notify(userId, kind, text, data = {}, mailTo) {
  await sql`insert into notifications (user_id, kind, text, data) values (${userId}, ${kind}, ${text}, ${JSON.stringify(data)})`;
  if (mailTo) {
    try {
      await sendNotice(mailTo, text, text);
    } catch {}
  }
}

async function sendOtp(user, purpose) {
  const code = newCode();
  await sql`update otps set used = true where user_id = ${user.id} and purpose = ${purpose} and not used`;
  await sql`insert into otps (user_id, purpose, code_hash, expires_at) values (${user.id}, ${purpose}, ${codeHash(user.id, purpose, code)}, now() + interval '10 minutes')`;
  await sendCode(user.email, code, purpose);
}

async function checkOtp(user, purpose, code) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) fail(400, 'Enter the 6-digit code');
  const [o] = await sql`select * from otps where user_id = ${user.id} and purpose = ${purpose} and not used order by created_at desc limit 1`;
  if (!o || new Date(o.expires_at) < new Date()) fail(400, 'That code has expired. Ask for a new one.');
  if (o.attempts >= 5) fail(429, 'Too many wrong codes. Ask for a new one.');
  if (!safeEqual(o.code_hash, codeHash(user.id, purpose, code))) {
    await sql`update otps set attempts = attempts + 1 where id = ${o.id}`;
    fail(400, 'That code is not right');
  }
  // Single use, even if two requests race.
  const [ok] = await sql`update otps set used = true where id = ${o.id} and not used returning id`;
  if (!ok) fail(400, 'That code has already been used');
}

// ---------------- auth ----------------
export async function signup(req) {
  const ip = clientIp(req);
  await limit(`signup:${ip}`, 8, 3600);
  const b = await readBody(req);
  const e = email(b.email);
  const pw = password(b.password);
  const u = username(b.username);
  const name = str(b.name || '', { max: 60, name: 'name' });
  const kind = b.kind === 'business' ? 'business' : 'individual';
  const bizName = kind === 'business' ? str(b.bizName || '', { min: 2, max: 80, name: 'business name' }) : '';
  const bizCategory = kind === 'business' ? str(b.bizCategory || '', { min: 2, max: 40, name: 'business category' }) : '';
  const language = str(b.language || '', { max: 40, name: 'language' });
  const level = Number.isInteger(b.level) && b.level >= 0 && b.level <= 4 ? b.level : 0;
  let referrer = null;
  if (b.ref) {
    try {
      const [r] = await sql`select id from users where username = ${username(b.ref)} and email_verified`;
      referrer = r?.id ?? null;
    } catch {}
  }
  const [existing] = await sql`select * from users where email = ${e}`;
  const [taken] = await sql`select id from users where username = ${u}`;
  if (taken && taken.id !== existing?.id) fail(409, 'That username is taken');
  if (existing && existing.email_verified) {
    // Don't reveal which emails have accounts: answer the same way, email the owner instead.
    try {
      await sendNotice(e, 'Someone tried to sign up with your email', 'Someone tried to create an AfriT Hub account with this email. If it was you, log in or reset your password instead.');
    } catch {}
    return { status: 'verify', email: e };
  }
  const hash = await hashPassword(pw);
  let user;
  if (existing) {
    [user] = await sql`update users set pw = ${hash}, name = ${name}, username = ${u}, kind = ${kind}, biz_name = ${bizName}, biz_category = ${bizCategory}, language = ${language}, level = ${level}, referred_by = ${referrer}, signup_ip = ${ip} where id = ${existing.id} returning *`;
  } else {
    [user] = await sql`insert into users (email, pw, name, username, kind, biz_name, biz_category, language, level, referred_by, signup_ip) values (${e}, ${hash}, ${name}, ${u}, ${kind}, ${bizName}, ${bizCategory}, ${language}, ${level}, ${referrer}, ${ip}) returning *`;
  }
  await limit(`otp-send:${user.id}`, 5, 3600);
  await sendOtp(user, 'verify');
  await audit(user.id, 'signup', ip);
  return { status: 'verify', email: e };
}

export async function verifyEmail(req) {
  const ip = clientIp(req);
  await limit(`verify:${ip}`, 30, 900);
  const b = await readBody(req);
  const e = email(b.email);
  const [user] = await sql`select * from users where email = ${e}`;
  if (!user) fail(400, 'That code is not right');
  await checkOtp(user, 'verify', b.code);
  const [u] = await sql`update users set email_verified = true where id = ${user.id} returning *`;
  await notify(u.id, 'welcome', 'Welcome to AfriT Hub! Your email is verified.');
  await audit(u.id, 'verified', ip);
  return { user: publicUser(u), tokens: await issueTokens(u) };
}

export async function resendCode(req) {
  const ip = clientIp(req);
  await limit(`resend:${ip}`, 10, 3600);
  const b = await readBody(req);
  const e = email(b.email);
  const purpose = b.purpose === 'reset' ? 'reset' : 'verify';
  const [user] = await sql`select * from users where email = ${e}`;
  if (user && (purpose === 'reset' ? user.email_verified : !user.email_verified)) {
    await limit(`otp-send:${user.id}`, 5, 3600);
    await sendOtp(user, purpose);
  }
  return { ok: true };
}

export async function login(req) {
  const ip = clientIp(req);
  await limit(`login-ip:${ip}`, 20, 900);
  const b = await readBody(req);
  const e = email(b.email);
  if (typeof b.password !== 'string' || b.password.length > 128) fail(400, 'Wrong email or password');
  await limit(`login-email:${e}`, 10, 900);
  const [user] = await sql`select * from users where email = ${e}`;
  const ok = await verifyPassword(b.password, user?.pw || DUMMY_HASH);
  if (user?.locked_until && new Date(user.locked_until) > new Date()) fail(429, 'Account temporarily locked after too many attempts. Try again later or reset your password.');
  if (!user || !ok) {
    if (user) {
      const [u] = await sql`update users set failed_logins = failed_logins + 1,
        locked_until = case when failed_logins + 1 >= 8 then now() + interval '30 minutes' else locked_until end where id = ${user.id} returning failed_logins`;
      if (u.failed_logins === 8) {
        try {
          await sendNotice(user.email, 'Your account was locked for 30 minutes', 'There were 8 wrong password attempts on your AfriT Hub account, so we locked it for 30 minutes.');
        } catch {}
      }
    }
    await audit(user?.id ?? null, 'login-failed', ip);
    fail(401, 'Wrong email or password');
  }
  if (!user.email_verified) {
    await limit(`otp-send:${user.id}`, 5, 3600);
    await sendOtp(user, 'verify');
    return { status: 'verify', email: e };
  }
  await sql`update users set failed_logins = 0, locked_until = null where id = ${user.id}`;
  await audit(user.id, 'login', ip);
  const [w] = await sql`select address from wallets where user_id = ${user.id}`;
  return { user: publicUser(user, w?.address), tokens: await issueTokens(user) };
}

export async function refresh(req) {
  const b = await readBody(req);
  if (typeof b.refresh !== 'string' || b.refresh.length > 100) fail(401, 'Please sign in again');
  const [t] = await sql`select * from refresh_tokens where token_hash = ${sha256(b.refresh)}`;
  if (!t || new Date(t.expires_at) < new Date()) fail(401, 'Please sign in again');
  if (t.revoked && t.reason === 'rotated' && t.used_at && Date.now() - new Date(t.used_at).getTime() < 30_000) {
    // The same phone retrying a moment later (app closed mid-refresh, two requests at once):
    // hand it a fresh pair in the same session instead of signing it out.
    const [live] = await sql`select 1 from refresh_tokens where family = ${t.family} and not revoked and expires_at > now() limit 1`;
    const [u] = live ? await sql`select * from users where id = ${t.user_id}` : [];
    if (u) return { tokens: await issueTokens(u, t.family) };
  }
  if (t.revoked) {
    // A used token came back: assume it was stolen and end the whole session family.
    await sql`update refresh_tokens set revoked = true, reason = 'stolen' where family = ${t.family}`;
    await audit(t.user_id, 'refresh-reuse', clientIp(req));
    fail(401, 'Please sign in again');
  }
  const [mark] = await sql`update refresh_tokens set revoked = true, reason = 'rotated', used_at = now() where id = ${t.id} and not revoked returning id`;
  if (!mark) fail(401, 'Please sign in again');
  const [u] = await sql`select * from users where id = ${t.user_id}`;
  if (!u) fail(401, 'Please sign in again');
  return { tokens: await issueTokens(u, t.family) };
}

export async function logout(req) {
  const b = await readBody(req);
  if (typeof b.refresh === 'string' && b.refresh.length <= 100) {
    const [t] = await sql`select family from refresh_tokens where token_hash = ${sha256(b.refresh)}`;
    if (t) await sql`update refresh_tokens set revoked = true, reason = 'logout' where family = ${t.family}`;
  }
  return { ok: true };
}

export async function forgot(req) {
  const ip = clientIp(req);
  await limit(`forgot-ip:${ip}`, 10, 3600);
  const b = await readBody(req);
  const e = email(b.email);
  await limit(`forgot:${e}`, 3, 3600);
  const [user] = await sql`select * from users where email = ${e} and email_verified`;
  if (user) await sendOtp(user, 'reset');
  return { ok: true }; // same answer whether or not the account exists
}

export async function reset(req) {
  const ip = clientIp(req);
  await limit(`reset-ip:${ip}`, 20, 3600);
  const b = await readBody(req);
  const e = email(b.email);
  const pw = password(b.password);
  const [user] = await sql`select * from users where email = ${e} and email_verified`;
  if (!user) fail(400, 'That code is not right');
  await checkOtp(user, 'reset', b.code);
  const hash = await hashPassword(pw);
  // New password ends every session, and wallet changes pause for 24 hours.
  const [u] = await sql`update users set pw = ${hash}, pw_changed_at = now(), session_version = session_version + 1, failed_logins = 0, locked_until = null,
    wallet_frozen_until = now() + interval '24 hours' where id = ${user.id} returning *`;
  await sql`update refresh_tokens set revoked = true, reason = 'reset' where user_id = ${u.id} and not revoked`;
  await notify(u.id, 'security', 'Your password was changed. All other devices were signed out.', {}, u.email);
  await audit(u.id, 'password-reset', ip);
  return { user: publicUser(u), tokens: await issueTokens(u) };
}

export async function me(req) {
  const u = await requireUser(req);
  const [w] = await sql`select address from wallets where user_id = ${u.id}`;
  return { user: publicUser(u, w?.address) };
}

// Titles people can show on their profile. Business accounts can use both lists.
export const PERSONAL_CATEGORIES = ['Founder', 'Co-founder', 'CEO', 'Entrepreneur', 'Investor', 'Creator', 'Content creator', 'Influencer', 'Public figure', 'Artist', 'Musician', 'Music producer', 'DJ', 'Actor', 'Comedian', 'Writer', 'Poet', 'Photographer', 'Videographer', 'Designer', 'Fashion designer', 'Model', 'Makeup artist', 'Developer', 'Engineer', 'Product manager', 'Marketer', 'Journalist', 'Blogger', 'Chef', 'Athlete', 'Coach', 'Fitness trainer', 'Doctor', 'Nurse', 'Pharmacist', 'Lawyer', 'Accountant', 'Banker', 'Crypto trader', 'Real estate agent', 'Teacher', 'Lecturer', 'Student', 'Researcher', 'Language tutor', 'Tour guide', 'Traveller', 'Community leader', 'Volunteer', 'Farmer', 'Civil servant'];
export const BUSINESS_CATEGORIES = ['Company', 'Startup', 'Brand', 'Restaurant', 'Café', 'Bar & lounge', 'Hotel & stays', 'Tours & travel', 'Transport', 'Shop', 'Fashion brand', 'Beauty & salon', 'Real estate', 'Bank & finance', 'Crypto project', 'Tech company', 'Media & news', 'Entertainment', 'Music label', 'Events', 'Education', 'School', 'Health & wellness', 'Hospital & clinic', 'Agriculture', 'Logistics', 'Services', 'Non-profit', 'Government', 'Creator & artist'];

export async function updateMe(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const name = b.name === undefined ? u.name : str(b.name, { max: 60, name: 'name' });
  let { kind, biz_name: bizName, biz_category: bizCategory, level, language } = u;
  if (b.kind === 'business' && kind !== 'business') {
    kind = 'business';
    bizName = str(b.bizName || '', { min: 2, max: 80, name: 'business name' });
  }
  if (kind === 'business' && b.bizName !== undefined) bizName = str(b.bizName, { min: 2, max: 80, name: 'business name' });
  if (b.bizCategory !== undefined) {
    const c = String(b.bizCategory || '');
    const allowed = kind === 'business' ? [...BUSINESS_CATEGORIES, ...PERSONAL_CATEGORIES] : PERSONAL_CATEGORIES;
    if (c && !allowed.includes(c)) fail(400, 'Pick a category from the list');
    bizCategory = c;
  }
  if (b.level !== undefined) {
    const l = Number(b.level);
    if (!Number.isInteger(l) || l < 0 || l > 4) fail(400, 'Check the level');
    level = l;
  }
  if (b.language !== undefined) language = str(b.language, { min: 2, max: 30, name: 'language' });
  let { bio, photo_url: photo, home_country: home, local_helper: helper, dms, private: priv } = u;
  if (b.bio !== undefined) {
    if (typeof b.bio !== 'string' || b.bio.length > 300 || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(b.bio)) fail(400, 'Check your bio');
    bio = b.bio.normalize('NFC').trim();
  }
  if (b.photo !== undefined) photo = b.photo ? mediaUrl(b.photo) : '';
  if (b.homeCountry !== undefined) {
    home = b.homeCountry ? str(b.homeCountry, { min: 2, max: 56, name: 'country' }) : '';
    if (home && !/^[\p{L} .'’()-]+$/u.test(home)) fail(400, 'Check the country');
  }
  if (b.localHelper !== undefined) helper = b.localHelper === true;
  if (!home) helper = false;
  if (b.dms !== undefined) {
    const d = { everyone: 'everyone', friends: 'friends', nobody: 'nobody', 'no one': 'nobody' }[String(b.dms).toLowerCase()];
    if (!d) fail(400, 'Check who can message you');
    dms = d;
  }
  if (b.private !== undefined) priv = b.private === true;
  const [x] = await sql`update users set name = ${name}, kind = ${kind}, biz_name = ${bizName}, biz_category = ${bizCategory}, level = ${level}, language = ${language},
    bio = ${bio}, photo_url = ${photo}, home_country = ${home}, local_helper = ${helper}, dms = ${dms}, private = ${priv} where id = ${u.id} returning *`;
  return { user: publicUser(x) };
}

// ---------------- referrals ----------------
const REF_ZUBA = 2000;
const REF_DAILY_CAP = 20;

/** Records the referral reward once the new member is verified and has linked a wallet. */
async function creditReferral(u) {
  if (!u.referred_by || u.referred_by === u.id) return;
  const [today] = await sql`select count(*)::int as n from referrals where referrer_id = ${u.referred_by} and created_at > now() - interval '1 day'`;
  const [ref] = await sql`select id, signup_ip from users where id = ${u.referred_by}`;
  if (!ref) return;
  // Suspicious patterns are held for review instead of paid automatically.
  const flag = today.n >= REF_DAILY_CAP ? 'daily-cap' : ref.signup_ip && ref.signup_ip === u.signup_ip ? 'same-ip' : null;
  const [r] = await sql`insert into referrals (referrer_id, referee_id, zuba, flag) values (${ref.id}, ${u.id}, ${REF_ZUBA}, ${flag})
    on conflict (referee_id) do nothing returning id`;
  if (r) await notify(ref.id, 'referral', `You earned ${REF_ZUBA.toLocaleString('en-US')} ZUBA: @${u.username} joined with your link`);
}

export async function referrals(req) {
  const u = await requireUser(req);
  const rows = await sql`select r.status, r.zuba, r.created_at, x.username from referrals r join users x on x.id = r.referee_id where r.referrer_id = ${u.id} order by r.created_at desc limit 100`;
  const [joined] = await sql`select count(*)::int as n from users where referred_by = ${u.id}`;
  const sum = (st) => rows.filter((r) => r.status === st).reduce((a, r) => a + Number(r.zuba), 0);
  return { code: u.username, reward: REF_ZUBA, joined: joined.n, earned: rows.length, pending: sum('pending'), paid: sum('paid'), list: rows };
}

function isAdmin(req) {
  const want = process.env.ADMIN_KEY || '';
  const got = String(req.headers['x-admin-key'] || '');
  return want.length >= 32 && got.length === want.length && safeEqual(got, want);
}

/** Admin: rewards waiting to be paid from the treasury, grouped by wallet. */
export async function adminReferrals(req) {
  if (!isAdmin(req)) fail(404, 'Not found');
  const rows = await sql`select r.id, r.zuba, r.flag, r.created_at, a.username as referrer, w.address
    from referrals r join users a on a.id = r.referrer_id left join wallets w on w.user_id = a.id where r.status = 'pending' order by r.created_at limit 500`;
  return { pending: rows };
}

export async function adminReferralsPaid(req) {
  if (!isAdmin(req)) fail(404, 'Not found');
  const b = await readBody(req);
  const tx = txHash(b.tx);
  if (!Array.isArray(b.ids) || !b.ids.length || b.ids.length > 500 || !b.ids.every((x) => /^\d{1,18}$/.test(String(x)))) fail(400, 'Bad ids');
  const ids = b.ids.map(String);
  const rows = await sql`update referrals set status = 'paid', tx_hash = ${tx}, paid_at = now() where id = any(${ids}::bigint[]) and status = 'pending' returning referrer_id, zuba`;
  for (const r of rows) await notify(r.referrer_id, 'payment', `Your referral reward of ${Number(r.zuba).toLocaleString('en-US')} ZUBA was sent to your wallet`);
  await audit(null, 'referrals-paid', clientIp(req), { tx, n: rows.length });
  return { paid: rows.length };
}

// ---------------- wallet linking ----------------
export async function walletChallenge(req) {
  const u = await requireUser(req);
  const nonce = crypto.randomBytes(16).toString('hex');
  await sql`insert into wallet_challenges (user_id, nonce, expires_at) values (${u.id}, ${nonce}, now() + interval '10 minutes')
    on conflict (user_id) do update set nonce = excluded.nonce, expires_at = excluded.expires_at`;
  return { message: `AfriT Hub: link this wallet to @${u.username}\nNonce: ${nonce}` };
}

export async function walletLink(req) {
  const u = await requireUser(req);
  await limit(`wallet-link:${u.id}`, 10, 3600);
  const b = await readBody(req);
  const addr = address(b.address);
  if (u.wallet_frozen_until && new Date(u.wallet_frozen_until) > new Date()) fail(423, 'Wallet changes are paused for 24 hours after a password reset');
  const [existing] = await sql`select address from wallets where user_id = ${u.id}`;
  if (existing) {
    if (existing.address.toLowerCase() === addr) return { wallet: existing.address };
    fail(409, 'Your account already has a wallet. Each account can have one wallet.');
  }
  const [c] = await sql`delete from wallet_challenges where user_id = ${u.id} returning nonce, expires_at`;
  if (!c || new Date(c.expires_at) < new Date()) fail(400, 'Request a new link message and try again');
  const message = `AfriT Hub: link this wallet to @${u.username}\nNonce: ${c.nonce}`;
  if (typeof b.signature !== 'string' || signerOf(message, b.signature) !== addr) fail(400, 'Signature does not match this wallet');
  try {
    await sql`insert into wallets (user_id, address) values (${u.id}, ${addr})`;
  } catch {
    fail(409, 'That wallet is already linked to another account');
  }
  await notify(u.id, 'security', 'A wallet was linked to your account', { address: addr }, u.email);
  await creditReferral(u);
  await audit(u.id, 'wallet-linked', clientIp(req), { addr });
  return { wallet: addr };
}

export async function walletOf(req, name) {
  await requireUser(req);
  const un = username(name);
  const [r] = await sql`select w.address from users u join wallets w on w.user_id = u.id where u.username = ${un}`;
  if (!r) fail(404, 'That person has not set up a wallet yet');
  return { username: un, wallet: r.address };
}

// ---------------- payments ----------------
export async function price() {
  const per = await zubaPerUsd();
  return { zubaPerUsd: (Number(per) / 1e9).toFixed(0), usdPerZuba: (1e9 / Number(per)).toPrecision(6) };
}

export async function createInvoice(req) {
  const u = await requireUser(req);
  await limit(`invoice:${u.id}`, 30, 3600);
  const b = await readBody(req);
  const purpose = b.purpose;
  const table = PLANS[purpose];
  if (!table) fail(400, 'Unknown purchase');
  const plan = table[b.plan];
  if (!plan) fail(400, 'Unknown plan');
  let forUser = null;
  if (purpose === 'premium' && b.giftTo) {
    const [f] = await sql`select id, username from users where username = ${username(b.giftTo)} and email_verified`;
    if (!f) fail(404, 'No member with that username');
    forUser = f.id;
  }
  const [w] = await sql`select address from wallets where user_id = ${u.id}`;
  const per = await zubaPerUsd();
  // A small unique tail on the amount ties a payment from any wallet to this one order.
  const tail = BigInt(crypto.randomInt(1, 999999));
  const units = (per * BigInt(Math.round(plan.usd * 100)) / 100n / 1000000n) * 1000000n + tail;
  const meta = purpose === 'promo' ? { audience: str(b.audience || 'Near me', { max: 40, name: 'audience' }), target: str(b.target || '', { max: 120, name: 'target' }) } : {};
  const id = crypto.randomUUID();
  await sql`insert into invoices (id, user_id, purpose, plan, for_user_id, usd, zuba_units, usd_per_zuba, meta, expires_at)
    values (${id}, ${u.id}, ${purpose}, ${b.plan}, ${forUser}, ${plan.usd}, ${units.toString()}, ${(1e9 / Number(per)).toPrecision(12)}, ${JSON.stringify(meta)}, now() + interval '30 minutes')`;
  return { invoice: id, usd: plan.usd, zubaUnits: units.toString(), zuba: (units / 10n ** ZUBA_DECIMALS).toString(), payTo: process.env.TREASURY, from: w?.address ?? null, expiresInSec: 1800 };
}

export async function verifyInvoice(req) {
  const u = await requireUser(req);
  await limit(`verify-pay:${u.id}`, 60, 3600);
  const b = await readBody(req);
  const tx = txHash(b.tx);
  if (typeof b.invoice !== 'string' || !/^[0-9a-f-]{36}$/.test(b.invoice)) fail(400, 'Unknown order');
  const [inv] = await sql`select * from invoices where id = ${b.invoice} and user_id = ${u.id}`;
  if (!inv) fail(404, 'Unknown order');
  if (inv.status === 'paid') return { status: 'paid' };
  const [used] = await sql`select 1 as x from invoices where tx_hash = ${tx}`;
  if (used) fail(409, 'That payment has already been used');
  const [w] = await sql`select address from wallets where user_id = ${u.id}`;
  // From the linked wallet: any amount at or above the price counts.
  // From any other wallet: the transfer must be for this order's exact amount.
  const r = await checkPayment(tx, w ? w.address.toLowerCase() : null, new Date(inv.created_at).getTime(), 5, BigInt(inv.zuba_units));
  if (r.status === 'pending') return { status: 'pending', reason: r.reason };
  if (r.status === 'bad') fail(400, r.reason);
  if (r.when > new Date(inv.expires_at).getTime() + 5 * 60000) fail(400, 'That payment arrived after the order expired. Contact support with your transaction hash.');
  const need = BigInt(inv.zuba_units) * (10000n - PAY_TOLERANCE_BP()) / 10000n;
  if (r.received < need) fail(400, 'The amount received is less than the price');
  const days = (PLANS[inv.purpose][inv.plan] || {}).days || 0;
  // One statement: marks the order paid only once and applies what was bought.
  const [paid] = await sql`update invoices set status = 'paid', tx_hash = ${tx}, paid_at = now() where id = ${inv.id} and status = 'open' returning *`;
  if (!paid) return { status: 'paid' };
  if (inv.purpose === 'premium') {
    const target = inv.for_user_id || u.id;
    const [t] = await sql`update users set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => ${days}) where id = ${target} returning id, email, premium_until`;
    await notify(u.id, 'payment', `Payment received: ${PLANS.premium[inv.plan].label} Premium`, { tx }, u.email);
    if (inv.for_user_id) await notify(t.id, 'gift', `@${u.username} gifted you ${PLANS.premium[inv.plan].label} Premium!`, {}, t.email);
    return { status: 'paid', premiumUntil: t.premium_until };
  }
  if (inv.purpose === 'promo') {
    await sql`insert into promotions (user_id, invoice_id, plan, audience, target, starts_at, ends_at)
      values (${u.id}, ${inv.id}, ${inv.plan}, ${inv.meta.audience || ''}, ${inv.meta.target || ''}, now(), now() + make_interval(days => ${days}))`;
    await notify(u.id, 'payment', `Payment received: ${PLANS.promo[inv.plan].label} promotion is live`, { tx }, u.email);
    return { status: 'paid' };
  }
  return { status: 'paid' };
}

// ---------------- notifications ----------------
export async function notifications(req) {
  const u = await requireUser(req);
  const rows = await sql`select id, kind, text, data, read, created_at from notifications where user_id = ${u.id} order by created_at desc limit 100`;
  return { notifications: rows };
}

export async function readNotifications(req) {
  const u = await requireUser(req);
  await sql`update notifications set read = true where user_id = ${u.id} and not read`;
  return { ok: true };
}

// ---------------- account security ----------------

/** Signs the account out on every device. */
export async function logoutAll(req) {
  const u = await requireUser(req);
  await sql`update users set session_version = session_version + 1 where id = ${u.id}`;
  await sql`update refresh_tokens set revoked = true, reason = 'logout-all' where user_id = ${u.id} and not revoked`;
  await audit(u.id, 'auth.logout_all', clientIp(req));
  await notify(u.id, 'security', 'You were signed out on all devices');
  return { ok: true };
}

/** Deletes the account after the password is confirmed. Personal details are removed. */
export async function deleteMe(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`delete:${u.id}`, 5, 3600);
  if (!(await verifyPassword(String(b.password || ''), u.pw))) fail(401, 'That password is not right');
  await sql`delete from wallets where user_id = ${u.id}`;
  await wipe(u.id);
  await sql`update refresh_tokens set revoked = true, reason = 'deleted' where user_id = ${u.id}`;
  await sql`update users set email = ${'deleted+' + u.id + '@deleted.invalid'}, username = ${'deleted_' + u.id}, name = '', biz_name = '', biz_category = '',
    pw = ${DUMMY_HASH}, email_verified = false, session_version = session_version + 1, premium_until = null,
    bio = '', photo_url = '', home_country = '', local_helper = false where id = ${u.id}`;
  await audit(u.id, 'account.deleted', clientIp(req));
  return { ok: true };
}
