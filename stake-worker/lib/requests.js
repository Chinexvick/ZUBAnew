// The request desk. The website cannot change money: it can only add a row to stake_requests.
// The worker picks each request up here, checks EVERYTHING again (it trusts nothing the website says
// except which user is asking), does it in one transaction, and writes the answer back on the row.
import * as D from './db.js';
import { cleanAddress, depositAddress, isTotpSecret, lockWeight, totpCheck } from './core.js';

const MAX_AGE_MS = 45_000; // a request the website stopped waiting for is dropped, never done late
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (status, msg) => { throw new D.StakeError(status, msg); };
const baseUnits = (v) => { if (typeof v !== 'string' || !/^[1-9]\d{0,59}$/.test(v)) bad(400, 'Enter a valid amount'); return BigInt(v); };
const intId = (v) => { if (!Number.isInteger(v) || v <= 0 || v > 2 ** 40) bad(400, 'Bad request'); return v; };

/**
 * ctx = {
 *   openSecret(sealed) -> secret          only the worker can open two-factor secrets
 *   factory, initCodeHash                 for deposit addresses
 *   forbidden: [addresses]                never a withdrawal address (the token, the factory, the vaults, the hot wallet)
 *   adminIds: [user ids], adminSecret     who may approve, and their own authenticator secret
 *   verifyPayment({tx, to, amount, createdAt}, c) -> { logIndex }   manual payouts: checks the transfer on-chain, throws StakeError if not right
 *   testFaucet(address) -> { tx }         test network only
 * }
 */
const handlers = {
  // ---- two-factor ----------------------------------------------------------------------------
  async '2fa_setup'(c, u, p, ctx) {
    let secret;
    try { secret = ctx.openSecret(p.sealed); } catch { bad(400, 'Bad request'); }
    if (!isTotpSecret(secret)) bad(400, 'Bad request');
    const r = await c.query(
      `insert into stake_totp (user_id, secret_enc) values ($1, $2)
       on conflict (user_id) do update set secret_enc = excluded.secret_enc, enabled = false, last_step = 0, failed = 0, locked_until = null
         where stake_totp.enabled = false returning user_id`,
      [u, p.sealed],
    );
    if (!r.rowCount) bad(400, 'Two-factor sign-in is already on');
    return {};
  },
  async '2fa_enable'(c, u, p, ctx) {
    await code(ctx, u, p.code, { requireEnabled: false });
    const r = await c.query('update stake_totp set enabled = true where user_id = $1 and not enabled', [u]);
    if (!r.rowCount) bad(400, 'Two-factor sign-in is already on');
    await D.audit(c, `user:${u}`, '2fa_enable');
    return {};
  },

  // ---- deposit address: only once two-factor is on, so every account that can hold money is protected ---
  async address(c, u, p, ctx) {
    if (!(await D.totpEnabled(c, u))) bad(403, 'Turn on two-factor sign-in first');
    const address = depositAddress(u, ctx.factory, ctx.initCodeHash);
    await c.query('insert into stake_addresses (user_id, address) values ($1, $2) on conflict (user_id) do nothing', [u, address]);
    const { rows } = await c.query('select address from stake_addresses where user_id = $1', [u]);
    if (rows[0].address !== address) throw new Error('stored deposit address differs from the computed one');
    return { address };
  },

  // ---- staking ----------------------------------------------------------------------------------------
  async stake(c, u, p) {
    const amount = baseUnits(p.amount);
    if (!Number.isInteger(p.lock) || lockWeight(p.lock) === null) bad(400, 'Choose one of the lock options');
    return { id: await D.stake(c, u, amount, p.lock) };
  },
  async unstake(c, u, p) {
    await D.unstake(c, u, intId(p.id));
    return {};
  },

  // ---- withdrawal addresses -----------------------------------------------------------------------
  async whitelist_add(c, u, p, ctx) {
    const address = cleanAddress(p.address);
    if (!address) bad(400, 'That is not a valid wallet address');
    if (ctx.forbidden.some((a) => a.toLowerCase() === address.toLowerCase())) bad(400, 'That address belongs to ZUBA Staking itself, not to a wallet of yours');
    const dep = await c.query('select 1 from stake_addresses where lower(address) = lower($1)', [address]);
    if (dep.rowCount) bad(400, 'That is a ZUBA Staking deposit address, not a wallet of yours');
    await code(ctx, u, p.code);
    const activeAt = await D.addWhitelist(c, u, address);
    await D.audit(c, `user:${u}`, 'whitelist_add', { address });
    return { address, activeAt };
  },
  async whitelist_remove(c, u, p) {
    const address = cleanAddress(p.address);
    if (!address) bad(400, 'That is not a valid wallet address');
    await D.removeWhitelist(c, u, address);
    await D.audit(c, `user:${u}`, 'whitelist_remove', { address });
    return {};
  },

  // ---- withdrawals ----------------------------------------------------------------------------------
  async withdraw(c, u, p, ctx) {
    const amount = baseUnits(p.amount);
    const address = cleanAddress(p.address);
    if (!address) bad(400, 'That is not a valid wallet address');
    await code(ctx, u, p.code);
    return D.requestWithdrawal(c, u, amount, address);
  },
  async withdraw_cancel(c, u, p) {
    await D.cancelWithdrawal(c, u, intId(p.id));
    return {};
  },

  // ---- admin: needs to be on the worker's own admin list AND a code from the admin authenticator ------
  async admin_decide(c, u, p, ctx) {
    await adminCode(ctx, u, p.code);
    await D.adminDecide(c, intId(p.id), p.approve === true, `admin:${u}`);
    return {};
  },
  /** Manual payout: the founder sent the tokens himself. The worker checks that transfer on the chain before believing it. */
  async admin_settle(c, u, p, ctx) {
    if (!ctx.adminIds.includes(u) || !ctx.verifyPayment) bad(404, 'Not found');
    const id = intId(p.id);
    const m = typeof p.tx === 'string' ? p.tx.match(/0x[0-9a-fA-F]{64}/) : null;
    if (!m) bad(400, 'Paste the transaction hash or its BscScan link');
    const { rows } = await c.query("select to_address, amount, created_at from stake_withdrawals where id = $1 and status = 'review'", [id]);
    if (!rows[0]) bad(404, 'No withdrawal waiting with that number');
    const pay = await ctx.verifyPayment({ tx: m[0].toLowerCase(), to: rows[0].to_address, amount: BigInt(rows[0].amount), createdAt: new Date(rows[0].created_at).getTime() }, c);
    await adminCode(ctx, u, p.code);
    await D.settleWithdrawal(c, id, m[0].toLowerCase(), pay.logIndex, `admin:${u}`);
    return { tx: m[0].toLowerCase() };
  },
  async admin_resume(c, u, p, ctx) {
    await adminCode(ctx, u, p.code);
    await D.resume(c, `admin:${u}`);
    return {};
  },
  async admin_pause(c, u, p, ctx) { // stopping is always allowed for an admin, no code needed: it can only make things safer
    if (!ctx.adminIds.includes(u)) bad(404, 'Not found');
    await D.pause(c, 'paused by an admin', `admin:${u}`);
    return {};
  },

  // ---- test network only ------------------------------------------------------------------------------
  async faucet(c, u, p, ctx) {
    if (!ctx.testFaucet) bad(404, 'Not found');
    const { rows } = await c.query('select address from stake_addresses where user_id = $1', [u]);
    if (!rows[0]) bad(400, 'Create your deposit address first');
    const recent = await c.query("select 1 from stake_requests where user_id = $1 and kind = 'faucet' and status = 'done' and done_at > now() - interval '2 minutes'", [u]);
    if (recent.rowCount) bad(429, 'You just got test ZUBA. Try again in a couple of minutes.');
    return ctx.testFaucet(rows[0].address);
  },
};

/** A user's own authenticator code. Checked in its own transaction so that a wrong try is recorded even if the rest fails. */
async function code(ctx, userId, value, opts) {
  const v = await D.withTx(ctx.pool, (c) => D.verifyTotp(c, userId, String(value ?? ''), ctx.openSecret, Date.now(), opts));
  if (!v.ok) bad(v.status, v.msg);
}
/** The admin's authenticator code. A code works once, even across restarts (the last used step is kept in the database). */
async function adminCode(ctx, userId, value) {
  if (!ctx.adminIds.includes(userId) || !ctx.adminSecret) bad(404, 'Not found');
  const step = totpCheck(ctx.adminSecret, String(value ?? ''));
  if (step === null) bad(403, 'That admin code is not right');
  const r = await ctx.pool.query(
    `insert into stake_cursor (name, block) values ($1, $2)
     on conflict (name) do update set block = excluded.block where stake_cursor.block < excluded.block returning block`,
    [`admin-step:${userId}`, step],
  );
  if (!r.rowCount) bad(403, 'That admin code was already used. Wait for the next one.');
}

/** Handles up to `max` waiting requests, oldest first. Safe to run from several places at once: each request is taken by one only. */
export async function processRequests(pool, ctx, { max = 25 } = {}) {
  const cx = { ...ctx, pool };
  let handled = 0;
  for (; handled < max; handled++) {
    const more = await D.withTx(pool, async (c) => {
      const { rows } = await c.query("select *, extract(epoch from (clock_timestamp() - created_at)) * 1000 as age_ms from stake_requests where status = 'new' order by id limit 1 for update skip locked");
      const r = rows[0];
      if (!r) return false;
      let http = 200, error = null, result = {};
      await c.query('savepoint work');
      try {
        if (Number(r.age_ms) > MAX_AGE_MS) bad(408, 'That took too long, so nothing was changed. Please try again.');
        if (!UUID.test(r.user_id)) bad(400, 'Bad request');
        const h = Object.hasOwn(handlers, r.kind) ? handlers[r.kind] : null;
        if (!h) bad(400, 'Bad request');
        await D.ensureUser(c, r.user_id);
        result = (await h(c, r.user_id, r.payload && typeof r.payload === 'object' ? r.payload : {}, cx)) ?? {};
      } catch (e) {
        await c.query('rollback to savepoint work'); // whatever the request started is undone
        if (e instanceof D.StakeError) { http = e.status; error = e.message; } else {
          console.error('request', r.id, r.kind, e);
          http = 500; error = 'Something went wrong. Nothing was changed.';
        }
        result = null;
      }
      // codes and sealed secrets are wiped from the row as soon as it has been handled
      await c.query(
        "update stake_requests set status = $2, http = $3, error = $4, result = $5, done_at = now(), payload = payload - 'code' - 'sealed' where id = $1",
        [r.id, error ? 'error' : 'done', http, error, result === null ? null : JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v))],
      );
      return true;
    });
    if (!more) break;
  }
  return { handled };
}
