// ZUBA Staking, website side.
//   GET  /api/stake/public        totals for everyone
//   GET  /api/stake/me            my dashboard (needs the session cookie)
//   POST /api/stake/login {email, password}      POST /api/stake/logout
//   POST /api/stake/act {kind, ...}              asks the worker to do something
import { after, NextResponse } from "next/server";
import { mailEnabled, sendMail, siteUrl } from "@/lib/mailer";
import { cookies } from "next/headers";
import { Fail, ACOOKIE, COOKIE, FLAG, accountLogin, accountLogout, accountProgress, openAcct, sealAcct, ask, clientIp, config, cookieOptions, createSession, db, endSession, fail, kickWorker, limited, newTotpSecret, otpauthUrl, readSession, sameOrigin, sealForWorker, stakeEnabled, type Session } from "@/lib/stake/server";
import { LOCKS, MAX_APY_BP, PROGRAM_DAYS, TOTAL_BUDGET, dailyPool, estimateApy, formatAmount, parseAmount } from "@/lib/stake/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" } });

async function session(): Promise<Session> {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  return s ?? fail(401, "Please sign in");
}

// What every visitor sees is the same for a few seconds, so a crowd (or a flood) costs the database one read, not thousands.
let sharedCache: { at: number; v: Awaited<ReturnType<typeof loadShared>> } | undefined;
async function shared() {
  if (sharedCache && Date.now() - sharedCache.at < 5_000) return sharedCache.v;
  const v = await loadShared();
  sharedCache = { at: Date.now(), v };
  return v;
}
let lastKick = 0;
/** Wakes the worker if its own schedule seems to have stopped. At most once every 30 seconds from here. */
function nudge(lag: number | null) {
  if (!process.env.STAKE_WORKER_URL || (lag !== null && lag <= 150) || Date.now() - lastKick < 30_000) return;
  lastKick = Date.now();
  after(() => kickWorker("chain", 35_000));
}
let pubCache: { at: number; v: unknown } | undefined;

async function loadShared() {
  const conf = await config();
  const decimals = Number(conf.decimals || 9);
  const unit = 10n ** BigInt(decimals);
  const pub = JSON.parse(conf.public || "{}") as Record<string, string | number | boolean | null>;
  const dayMs = Number(pub.dayMs || 86_400_000);
  const st = (await db().query("select paused, launch_at from stake_state where id = 1")).rows[0];
  if (!st) fail(503, "Staking is not open yet.");
  const day = Math.floor((Date.now() - new Date(st.launch_at).getTime()) / dayMs);
  const tot = (await db().query("select coalesce(sum(amount * weight_bp), 0) as w, coalesce(sum(amount), 0) as a, count(distinct user_id)::int as n from stake_positions where status = 'active'")).rows[0];
  const apy: Record<string, number> = {};
  for (const [d, w] of Object.entries(LOCKS)) apy[d] = estimateApy(Math.max(0, day), BigInt(tot.w), w, unit);
  const fmt = (v: bigint | string | number) => formatAmount(v, decimals);
  const chainId = Number(conf.chain_id || 56);
  const paid = (await db().query("select coalesce(sum(paid), 0) as s from stake_epochs")).rows[0].s;
  const d0 = Math.max(0, day);
  const program = {
    day: d0, programDays: PROGRAM_DAYS, dayMs, nextDayAt: new Date(st.launch_at).getTime() + (day + 1) * dayMs,
    budget: TOTAL_BUDGET.toString(), paid: fmt(paid), dailyPool: fmt(dailyPool(d0, unit)), totalStaked: fmt(tot.a), stakers: tot.n as number,
  };
  return {
    program,
    conf, decimals, unit, pub, dayMs, day, paused: Boolean(st.paused), apy, fmt, tot,
    token: { symbol: conf.symbol || "ZUBA", contract: conf.token || "", chain: chainId === 56 ? "BNB Smart Chain (BEP-20)" : "BNB Smart Chain TESTNET", chainId, explorer: conf.explorer || (chainId === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com") },
    test: Boolean(pub.testMode), depositsOpen: conf.chain_ready !== "0",
  };
}

async function getPublic() {
  if (pubCache && Date.now() - pubCache.at < 5_000) return pubCache.v;
  const v = await loadPublic();
  pubCache = { at: Date.now(), v };
  return v;
}
async function loadPublic() {
  const s = await shared();
  const hb = (await db().query("select block from stake_cursor where name = 'heartbeat'")).rows[0];
  nudge(hb ? Math.floor(Date.now() / 1000) - Number(hb.block) : null);
  return {
    enabled: true, test: s.test, token: s.token, paused: s.paused, program: { ...s.program, budget: undefined, paid: undefined, dailyPool: undefined }, apy: s.apy, maxApy: MAX_APY_BP / 100,
    locks: Object.keys(LOCKS).map(Number), weights: Object.fromEntries(Object.entries(LOCKS).map(([d, w]) => [d, w / 10000])),
    workerSecondsAgo: hb ? Math.max(0, Math.floor(Date.now() / 1000) - Number(hb.block)) : null,
  };
}

async function getMe(sess: Session) {
  const s = await shared();
  const id = sess.userId, q = db();
  const [acct, addr, pos, wd, led, wl, totp, dep, hb] = await Promise.all([
    q.query("select available, staked, held, rewards, frozen_until from stake_accounts where user_id = $1", [id]),
    q.query("select address from stake_addresses where user_id = $1", [id]),
    q.query("select id, amount, lock_days, weight_bp, started_at, unlock_at, earned from stake_positions where user_id = $1 and status = 'active' order by id desc", [id]),
    q.query("select id, to_address, amount, status, tx_hash, created_at from stake_withdrawals where user_id = $1 order by id desc limit 20", [id]),
    q.query("select kind, amount, created_at from stake_ledger where user_id = $1 order by id desc limit 40", [id]),
    q.query("select address, active_at from stake_whitelist where user_id = $1 order by id", [id]),
    q.query("select enabled from stake_totp where user_id = $1", [id]),
    q.query("select tx_hash, amount, status, seen_at from stake_deposits where user_id = $1 order by seen_at desc limit 10", [id]),
    q.query("select block from stake_cursor where name = 'heartbeat'"),
  ]);
  const a = acct.rows[0] ?? { available: 0, staked: 0, held: 0, rewards: 0, frozen_until: null };
  const lag = hb.rows[0] ? Math.max(0, Math.floor(Date.now() / 1000) - Number(hb.rows[0].block)) : null;
  nudge(lag);
  const now = Date.now();
  return {
    email: sess.email, test: s.test, token: s.token, paused: s.paused, apy: s.apy, maxApy: MAX_APY_BP / 100, day: Math.max(0, s.day), dayMs: s.dayMs, program: { ...s.program, budget: undefined, paid: undefined, dailyPool: undefined },
    weights: Object.fromEntries(Object.entries(LOCKS).map(([d, w]) => [d, w / 10000])),
    address: addr.rows[0]?.address ?? null, depositsOpen: s.depositsOpen,
    twoFactor: totp.rows[0] ? (totp.rows[0].enabled ? "on" : "pending") : "off",
    balance: { available: s.fmt(a.available), staked: s.fmt(a.staked), pendingWithdrawal: s.fmt(a.held), rewards: s.fmt(a.rewards), total: s.fmt(BigInt(a.available) + BigInt(a.staked) + BigInt(a.held)) },
    frozenUntil: a.frozen_until,
    positions: pos.rows.map((p) => ({ id: Number(p.id), amount: s.fmt(p.amount), lockDays: p.lock_days, weight: p.weight_bp / 10000, startedAt: p.started_at, unlockAt: p.unlock_at, earned: s.fmt(p.earned), canUnstake: new Date(p.unlock_at).getTime() <= now })),
    deposits: dep.rows.map((d) => ({ tx: d.tx_hash, amount: s.fmt(d.amount), status: d.status, at: d.seen_at })),
    withdrawals: wd.rows.map((w) => ({ id: Number(w.id), to: w.to_address, amount: s.fmt(w.amount), status: w.status, tx: w.tx_hash, at: w.created_at })),
    history: led.rows.map((l) => ({ kind: l.kind, amount: s.fmt(l.amount), at: l.created_at })),
    addresses: wl.rows.map((w) => ({ address: w.address, activeAt: w.active_at, active: new Date(w.active_at).getTime() <= now })),
    limits: {
      minStake: s.fmt(String(s.pub.minStake ?? 0)), minStakeFloor: s.fmt(String(s.pub.minStakeFloor ?? s.pub.minStake ?? 0)), minDeposit: s.fmt(String(s.pub.minDeposit ?? 0)), minWithdraw: s.fmt(String(s.pub.minWithdraw ?? 0)), autoLimit: s.fmt(String(s.pub.autoLimit ?? 0)), userDaily: s.fmt(String(s.pub.userDaily ?? 0)),
      confirmations: Number(s.pub.confirmations ?? 15), whitelistDelayMs: Number(s.pub.whitelistDelayMs ?? 86_400_000), maxAddresses: Number(s.pub.maxAddresses ?? 5),
      manual: s.pub.manual !== false,
      faucetAmount: s.pub.faucetAmount ? s.fmt(String(s.pub.faucetAmount)) : null,
    },
    workerSecondsAgo: lag,
  };
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v.length <= max ? v : fail(400, "Bad request"));
const code = (v: unknown) => (typeof v === "string" && /^\d{6}$/.test(v) ? v : fail(400, "Enter the 6-digit code from your authenticator app"));
const address = (v: unknown) => (typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v.trim()) ? v.trim() : fail(400, "That is not a valid wallet address"));
const posInt = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : fail(400, "Bad request"));

async function act(sess: Session, b: Record<string, unknown>) {
  const kind = str(b.kind, 30), id = sess.userId;
  if (await limited(`act:${id}`, 60, 3600)) fail(429, "Too many tries. Try again later.");
  // if the worker is behind, do not pile more on: say so instead
  const waiting = (await db().query("select count(*)::int as n from (select 1 from stake_requests where status = 'new' limit 200) q")).rows[0].n;
  if (waiting >= 200) fail(503, "ZUBA Staking is busy right now. Please try again in a minute.");
  const sensitive = ["2fa_setup", "2fa_enable", "whitelist_add", "withdraw"].includes(kind) || (kind === "stake" && b.lock !== 0);
  if (sensitive && (await limited(`act:s:${id}`, 30, 3600))) fail(429, "Too many tries. Try again later.");
  const s = await shared();
  const amount = (v: unknown) => {
    const a = parseAmount(v, s.decimals);
    return a === null || a <= 0n ? fail(400, "Enter a valid amount") : a.toString();
  };
  switch (kind) {
    case "2fa_setup": {
      const secret = newTotpSecret();
      const r = await ask(id, kind, { sealed: sealForWorker(secret) });
      return r.http === 200 ? { http: 200, error: null, result: { secret, url: otpauthUrl(secret, sess.email, s.test) } } : r;
    }
    case "2fa_enable": return ask(id, kind, { code: code(b.code) });
    case "address": return ask(id, kind, {});
    case "stake": {
      const lock = Number.isInteger(b.lock) ? (b.lock as number) : fail(400, "Choose a lock option");
      return ask(id, kind, lock > 0 ? { amount: amount(b.amount), lock, code: code(b.code) } : { amount: amount(b.amount), lock });
    }
    case "unstake": return ask(id, kind, { id: posInt(b.id) });
    case "whitelist_add": return ask(id, kind, { address: address(b.address), code: code(b.code) });
    case "whitelist_remove": return ask(id, kind, { address: address(b.address) });
    case "withdraw": {
      const amt = amount(b.amount), to = address(b.address);
      const r = await ask(id, kind, { amount: amt, address: to, code: code(b.code) });
      if (r.http === 200) {
        after(() => kickWorker("chain", 35_000));
        after(() => notifyFounder(Number(r.result?.id), s.fmt(amt), to, s.token.symbol));
      }
      return r;
    }
    case "withdraw_cancel": return ask(id, kind, { id: posInt(b.id) });
    case "faucet": {
      if (!s.test) fail(404, "Not found");
      const r = await ask(id, kind, {});
      if (r.http === 200) after(() => kickWorker("chain", 35_000));
      return r;
    }
    default:
      return fail(400, "Bad request");
  }
}

/** Tells the founder a withdrawal is waiting. A notice only: nothing can be approved from an email. */
async function notifyFounder(id: number, amount: string, to: string, symbol: string) {
  const dest = process.env.STAKE_NOTIFY_EMAIL;
  if (!dest || !mailEnabled()) return;
  const link = `${siteUrl()}/admin`;
  const text = `Withdrawal #${id}\nAmount: ${amount} ${symbol}\nTo: ${to}\n\nOpen the Workbench to check and pay it: ${link}\n\nNever act on a withdrawal from an email alone. Always use the Workbench.`;
  const html = `<p><b>Withdrawal #${id}</b></p><p>Amount: ${amount} ${symbol}<br>To: <code>${to}</code></p><p><a href="${link}">Open the Workbench</a> to check and pay it.</p><p style="color:#666">Never act on a withdrawal from an email alone. Always use the Workbench.</p>`;
  try {
    await sendMail({ to: dest, subject: `ZUBA Staking: withdrawal #${id} is waiting`, text, html });
  } catch (e) {
    console.error("stake notify", e);
  }
}

async function handle(req: Request, op: string) {
  if (!stakeEnabled()) return json({ enabled: false, error: "Staking is coming soon." }, req.method === "GET" && op === "public" ? 200 : 503);
  if (req.method === "GET") {
    if (op === "public") return json(await getPublic());
    if (op === "me") return json(await getMe(await session()));
    if (op === "account") {
      // who is signed in and their game balance, for the dashboard
      const sn = await session(), jar = await cookies();
      const acct = openAcct(jar.get(ACOOKIE)?.value, sn.userId);
      const got = acct ? await accountProgress(acct) : null;
      const res = json({ email: sn.email, name: acct?.n || "", game: got ? { zuba: got.zuba } : null });
      if (got?.renewed) res.cookies.set(ACOOKIE, sealAcct(got.acct), cookieOptions(12 * 3600));
      return res;
    }
    return json({ error: "Not found" }, 404);
  }
  if (req.method !== "POST") return json({ error: "Not found" }, 404);
  if (!sameOrigin(req)) return json({ error: "Bad request" }, 403);
  const raw = await req.text();
  if (raw.length > 4000) return json({ error: "Request too large" }, 413);
  let b: Record<string, unknown> = {};
  try {
    const v = raw ? JSON.parse(raw) : {};
    if (v && typeof v === "object" && !Array.isArray(v)) b = v;
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const ip = clientIp(req);

  if (op === "login") {
    const email = str(b.email, 254).trim().toLowerCase(), password = str(b.password, 128);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || !password) fail(400, "Enter your email and password");
    if (await limited(`login:ip:${ip}`, 20, 900)) fail(429, "Too many attempts. Try again in 15 minutes.");
    if (await limited(`login:em:${email}`, 8, 900)) fail(429, "Too many attempts. Try again in 15 minutes.");
    if (Math.random() < 0.05) after(() => db().query("delete from stake_rate where window_start < now() - interval '1 day'").catch(() => {}));
    const u = await accountLogin(email, password);
    const sn = await createSession(u.id, u.email, ip, req.headers.get("user-agent") || "");
    // "arcade" is the games' own sign-in, handed over once so one sign-in covers the games too
    const res = json({ ok: true, arcade: u.arcade });
    res.cookies.set(COOKIE, sn.token, cookieOptions(sn.maxAge));
    res.cookies.set(ACOOKIE, u.acct ? sealAcct(u.acct) : "", cookieOptions(u.acct ? sn.maxAge : 0));
    res.cookies.set(FLAG, "1", { ...cookieOptions(sn.maxAge), httpOnly: false, sameSite: "lax" });
    return res;
  }
  if (op === "logout") {
    const jar = await cookies(), t = jar.get(COOKIE)?.value;
    const sn = await readSession(t);
    if (sn) accountLogout(openAcct(jar.get(ACOOKIE)?.value, sn.userId));
    if (t) await endSession(t);
    const res = json({ ok: true });
    res.cookies.set(COOKIE, "", cookieOptions(0));
    res.cookies.set(ACOOKIE, "", cookieOptions(0));
    res.cookies.set(FLAG, "", { ...cookieOptions(0), httpOnly: false, sameSite: "lax" });
    return res;
  }
  if (op === "act") {
    if (await limited(`act:ip:${ip}`, 240, 3600)) fail(429, "Too many tries. Try again later.");
    const r = await act(await session(), b);
    return r.http === 200 ? json({ ok: true, ...(r.result ?? {}) }) : json({ error: r.error || "Something went wrong." }, r.http || 500);
  }
  return json({ error: "Not found" }, 404);
}

async function entry(req: Request, ctx: { params: Promise<{ op: string[] }> }) {
  try {
    const { op } = await ctx.params;
    return await handle(req, op.join("/"));
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    console.error("stake", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export { entry as GET, entry as POST };
