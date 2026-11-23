import crypto from 'node:crypto';
import { sql } from './db.js';
import {
  DUMMY_HASH, address, audit, clientIp, codeHash, email, fail, hashPassword, issueTokens, limit, newCode, password, publicUser, readBody,
  requireUser, safeEqual, sha256, str, txHash, username, verifyPassword,
} from './core.js';
import { sendCode, sendNotice } from './mail.js';
import { checkPayment, signerOf, zubaPerUsd, ZUBA_DECIMALS } from './chain.js';

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
    [user] = await sql`update users set pw = ${hash}, name = ${name}, username = ${u}, kind = ${kind}, biz_name = ${bizName}, biz_category = ${bizCategory}, language = ${language}, level = ${level} where id = ${existing.id} returning *`;
  } else {
    [user] = await sql`insert into users (email, pw, name, username, kind, biz_name, biz_category, language, level) values (${e}, ${hash}, ${name}, ${u}, ${kind}, ${bizName}, ${bizCategory}, ${language}, ${level}) returning *`;
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

export async function updateMe(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const name = b.name === undefined ? u.name : str(b.name, { max: 60, name: 'name' });
  let { kind, biz_name: bizName, biz_category: bizCategory } = u;
  if (b.kind === 'business') {
    kind = 'business';
    bizName = str(b.bizName || '', { min: 2, max: 80, name: 'business name' });
    bizCategory = str(b.bizCategory || '', { min: 2, max: 40, name: 'business category' });
  }
  const [x] = await sql`update users set name = ${name}, kind = ${kind}, biz_name = ${bizName}, biz_category = ${bizCategory} where id = ${u.id} returning *`;
  return { user: publicUser(x) };
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
  if (!w) fail(400, 'Set up your AfriT wallet first');
  const per = await zubaPerUsd();
  const units = per * BigInt(Math.round(plan.usd * 100)) / 100n;
  const meta = purpose === 'promo' ? { audience: str(b.audience || 'Near me', { max: 40, name: 'audience' }), target: str(b.target || '', { max: 120, name: 'target' }) } : {};
  const id = crypto.randomUUID();
  await sql`insert into invoices (id, user_id, purpose, plan, for_user_id, usd, zuba_units, usd_per_zuba, meta, expires_at)
    values (${id}, ${u.id}, ${purpose}, ${b.plan}, ${forUser}, ${plan.usd}, ${units.toString()}, ${(1e9 / Number(per)).toPrecision(12)}, ${JSON.stringify(meta)}, now() + interval '30 minutes')`;
  return { invoice: id, usd: plan.usd, zubaUnits: units.toString(), zuba: (units / 10n ** ZUBA_DECIMALS).toString(), payTo: process.env.TREASURY || '0x60E5EFE6dcf598Ff8ED52B70a80bddaca3C6AFdd', from: w.address, expiresInSec: 1800 };
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
  if (!w) fail(400, 'No wallet linked');
  // Payments sent before the order expired are still honoured; later ones are not.
  const r = await checkPayment(tx, w.address.toLowerCase(), new Date(inv.created_at).getTime());
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
