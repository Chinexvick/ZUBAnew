// ZUBA staking: everything that changes a balance. Each function runs inside ONE database transaction and
// locks the user's account row first, so two requests can never both spend the same tokens.
// Only the worker calls these (the website's database login cannot write to these tables at all).
import { DAYS_PER_YEAR, PROGRAM_DAYS, TOTAL_BUDGET, dailyPool, dayMs, dayRewards, lockWeight, tokens, totpCheck } from './core.js';

export class StakeError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const bad = (status, msg) => { throw new StakeError(status, msg); };
const big = (v) => BigInt(v ?? 0);

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
/** Limits. Defaults are cautious placeholders; the real numbers are set by environment variables. */
export const limits = () => ({
  minStake: tokens(env('STAKE_MIN_STAKE', 1000)),
  minWithdraw: tokens(env('STAKE_MIN_WITHDRAW', 1000)),
  autoLimit: tokens(env('STAKE_AUTO_LIMIT', 5_000_000)), // paid with no human approval up to this
  userDaily: tokens(env('STAKE_USER_DAILY', 50_000_000)),
  globalDaily: tokens(env('STAKE_GLOBAL_DAILY', 300_000_000)), // total that may leave in 24h without a human
  totalStakeCap: tokens(env('STAKE_TOTAL_CAP', 2_000_000_000)),
  whitelistDelayMs: Math.round(Number(env('STAKE_WHITELIST_DELAY_H', 24)) * 3600_000),
  confirmations: Number(env('STAKE_CONFIRMATIONS', 15)),
  maxAddresses: 5,
  // 'manual' (the default): every withdrawal waits for the founder, who pays it from a wallet only he holds.
  // 'auto': withdrawals up to autoLimit are paid by the worker's own small wallet.
  manual: env('STAKE_PAYOUT_MODE', 'manual') !== 'auto',
});

/** Runs fn(client) in a transaction; retries on deadlock / serialization failures. */
export async function withTx(pool, fn) {
  for (let attempt = 0; ; attempt++) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      const out = await fn(c);
      await c.query('commit');
      return out;
    } catch (e) {
      try { await c.query('rollback'); } catch { /* connection already gone */ }
      if ((e.code === '40001' || e.code === '40P01') && attempt < 3) continue;
      throw e;
    } finally {
      c.release();
    }
  }
}

/**
 * "Only one of us at a time." Takes a named lease for at most ttlMs, runs fn, and gives it back.
 * If someone else holds it, returns { busy: true } without running. A crashed holder's lease simply expires.
 * (Uses the database's clock, and a plain row, so it also works through a connection pooler.)
 */
export async function withLease(pool, name, ttlMs, fn) {
  const key = `lease:${name}`;
  const r = await pool.query(
    `insert into stake_cursor (name, block) values ($1, (extract(epoch from clock_timestamp()) * 1000)::bigint + $2)
     on conflict (name) do update set block = excluded.block
       where stake_cursor.block < (extract(epoch from clock_timestamp()) * 1000)::bigint
     returning block`,
    [key, ttlMs],
  );
  if (!r.rowCount) return { busy: true };
  try {
    return await fn();
  } finally {
    try { await pool.query('update stake_cursor set block = 0 where name = $1 and block = $2', [key, r.rows[0].block]); } catch { /* it expires by itself */ }
  }
}

export async function audit(c, actor, action, detail = {}) {
  await c.query('insert into stake_audit (actor, action, detail) values ($1, $2, $3)', [actor, action, JSON.stringify(detail, (_, v) => (typeof v === 'bigint' ? v.toString() : v))]);
}
export async function alert(c, level, msg) {
  await c.query('insert into stake_alerts (level, msg) values ($1, $2)', [level, String(msg).slice(0, 500)]);
}

export async function state(c) {
  const { rows } = await c.query('select paused, pause_reason, launch_at from stake_state where id = 1');
  if (!rows[0]) throw new Error('staking not initialised');
  return { paused: rows[0].paused, pause_reason: rows[0].pause_reason, launchAt: new Date(rows[0].launch_at).getTime() };
}
/** Which program day it is (0 = the launch day; negative before launch). */
export const programDay = (launchAt, now = Date.now()) => Math.floor((now - launchAt) / dayMs());

export async function pause(c, reason, actor = 'system') {
  const r = await c.query('update stake_state set paused = true, pause_reason = $1 where id = 1 and not paused', [String(reason).slice(0, 500)]);
  if (!r.rowCount) return false; // already paused
  await audit(c, actor, 'pause', { reason });
  await alert(c, 'critical', `Staking PAUSED: ${reason}`);
  return true;
}
export async function resume(c, actor) {
  await c.query('update stake_state set paused = false, pause_reason = null where id = 1');
  await audit(c, actor, 'resume');
}
async function mustBeRunning(c) {
  const s = await state(c);
  if (s.paused) bad(503, 'Staking is paused for a moment. Please try again later.');
  return s;
}

export const ensureUser = (c, userId) => c.query('insert into users (id) values ($1) on conflict do nothing', [userId]);

async function lockAccount(c, userId) {
  await c.query('insert into stake_accounts (user_id) values ($1) on conflict do nothing', [userId]);
  const { rows } = await c.query('select * from stake_accounts where user_id = $1 for update', [userId]);
  const a = rows[0];
  return { ...a, available: big(a.available), staked: big(a.staked), held: big(a.held), rewards: big(a.rewards) };
}
const ledger = (c, userId, kind, amount, ref = null) =>
  c.query('insert into stake_ledger (user_id, kind, amount, ref) values ($1, $2, $3, $4)', [userId, kind, amount.toString(), ref]);

// ---- deposits ---------------------------------------------------------------------------------------------------
/** The watcher saw a Transfer to a deposit address. Safe to call again for the same transfer. */
export async function recordDeposit(c, d) {
  const { rows } = await c.query('select user_id from stake_addresses where lower(address) = lower($1)', [d.to]);
  if (!rows[0]) return false; // not one of our deposit addresses
  const r = await c.query(
    `insert into stake_deposits (tx_hash, log_index, block_number, block_hash, to_address, from_address, user_id, amount)
     values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (tx_hash, log_index) do nothing`,
    [d.txHash.toLowerCase(), d.logIndex, d.block, d.blockHash.toLowerCase(), d.to, d.from ?? null, rows[0].user_id, d.amount.toString()],
  );
  return r.rowCount === 1;
}

/** Credits one confirmed deposit. The row is locked, so a second worker (or a retry) credits nothing. */
export async function creditDeposit(c, txHash, logIndex) {
  const { rows } = await c.query("select * from stake_deposits where tx_hash = $1 and log_index = $2 and status = 'pending' for update", [txHash, logIndex]);
  const d = rows[0];
  if (!d || !d.user_id) return false;
  const amount = big(d.amount);
  await lockAccount(c, d.user_id);
  await c.query('update stake_accounts set available = available + $2, updated_at = now() where user_id = $1', [d.user_id, amount.toString()]);
  await c.query("update stake_deposits set status = 'credited', credited_at = now() where tx_hash = $1 and log_index = $2", [txHash, logIndex]);
  await ledger(c, d.user_id, 'deposit', amount, `${txHash}:${logIndex}`);
  return true;
}

// ---- staking ------------------------------------------------------------------------------------------------------
export async function stake(c, userId, amount, lockDays, now = Date.now()) {
  await mustBeRunning(c);
  const w = lockWeight(lockDays);
  if (w === null) bad(400, 'Choose one of the lock options');
  const L = limits();
  if (amount < L.minStake) bad(400, 'That is below the minimum stake');
  const acct = await lockAccount(c, userId);
  if (acct.available < amount) bad(400, 'Not enough available ZUBA');
  const { rows } = await c.query("select coalesce(sum(amount), 0) as s from stake_positions where status = 'active'");
  if (big(rows[0].s) + amount > L.totalStakeCap) bad(400, 'Staking has reached its limit for now');
  await c.query('update stake_accounts set available = available - $2, staked = staked + $2, updated_at = now() where user_id = $1', [userId, amount.toString()]);
  const p = await c.query(
    'insert into stake_positions (user_id, amount, lock_days, weight_bp, started_at, unlock_at) values ($1, $2, $3, $4, $5, $6) returning id',
    [userId, amount.toString(), lockDays, Number(w), new Date(now), new Date(now + lockDays * dayMs())],
  );
  await ledger(c, userId, 'stake', amount, String(p.rows[0].id));
  return Number(p.rows[0].id);
}

export async function unstake(c, userId, positionId, now = Date.now()) {
  await lockAccount(c, userId);
  const { rows } = await c.query("select * from stake_positions where id = $1 and user_id = $2 and status = 'active' for update", [positionId, userId]);
  const p = rows[0];
  if (!p) bad(404, 'Stake not found');
  if (new Date(p.unlock_at).getTime() > now) bad(400, `This stake is locked until ${new Date(p.unlock_at).toISOString().replace('T', ' ').slice(0, 16)} UTC`);
  const amount = big(p.amount);
  await c.query("update stake_positions set status = 'ended', ended_at = $2 where id = $1", [positionId, new Date(now)]);
  await c.query('update stake_accounts set available = available + $2, staked = staked - $2, updated_at = now() where user_id = $1', [userId, amount.toString()]);
  await ledger(c, userId, 'unstake', amount, String(positionId));
  return amount;
}

// ---- daily rewards ------------------------------------------------------------------------------------------------
/**
 * Pays program day `day` (0 = launch day). The day must be over. It can run any number of times: only the first counts.
 * A stake earns for a day only if it was already staked when that day began and stayed staked through to its end.
 */
export async function runEpoch(c, day, now = Date.now()) {
  const s = await state(c);
  if (s.paused) return { skipped: 'paused' };
  if (!Number.isInteger(day) || day < 0 || day >= PROGRAM_DAYS) return { skipped: 'outside the program' };
  const dayStart = s.launchAt + day * dayMs();
  const dayEnd = dayStart + dayMs();
  if (now < dayEnd) return { skipped: 'day not over' };
  // one payer at a time; the lock ends with this transaction
  await c.query("select pg_advisory_xact_lock(hashtext('zuba-stake-epoch'))");
  const done = await c.query('select 1 from stake_epochs where day = $1', [day]);
  if (done.rowCount) return { skipped: 'already paid' };
  const pool = dailyPool(day);
  const spent = await c.query('select coalesce(sum(paid), 0) as s from stake_epochs');
  if (big(spent.rows[0].s) + pool > TOTAL_BUDGET) throw new Error('reward budget would be exceeded');
  const { rows } = await c.query(
    `select id, user_id, amount, weight_bp from stake_positions
      where started_at < $1 and (status = 'active' or ended_at >= $2) order by id`,
    [new Date(dayStart), new Date(dayEnd)],
  );
  const pos = rows.map((r) => ({ id: r.id, user: r.user_id, amount: big(r.amount), weightBp: BigInt(r.weight_bp) }));
  const rewards = dayRewards(pos, pool);
  let paid = 0n, totalW = 0n;
  for (const p of pos) totalW += p.amount * p.weightBp;
  const byUser = new Map(), pids = [], pamt = [];
  for (const p of pos) {
    const r = rewards.get(p.id);
    if (!r) continue;
    paid += r;
    pids.push(String(p.id)); pamt.push(r.toString());
    byUser.set(p.user, (byUser.get(p.user) ?? 0n) + r);
  }
  if (paid > pool) throw new Error('internal: rewards above the pool');
  if (pids.length) {
    // accounts in a fixed order, so two jobs can never deadlock each other
    const users = [...byUser.keys()].sort();
    await c.query('insert into stake_accounts (user_id) select unnest($1::uuid[]) on conflict do nothing', [users]);
    await c.query('select 1 from stake_accounts where user_id = any($1::uuid[]) order by user_id for update', [users]);
    await c.query('update stake_positions p set earned = p.earned + r.a from (select unnest($1::bigint[]) as id, unnest($2::numeric[]) as a) r where p.id = r.id', [pids, pamt]);
    await c.query(
      `update stake_accounts a set available = a.available + r.a, rewards = a.rewards + r.a, updated_at = now()
         from (select unnest($1::uuid[]) as u, unnest($2::numeric[]) as a) r where a.user_id = r.u`,
      [users, users.map((u) => byUser.get(u).toString())],
    );
    await c.query(
      "insert into stake_ledger (user_id, kind, amount, ref) select unnest($1::uuid[]), 'reward', unnest($2::numeric[]), $3",
      [users, users.map((u) => byUser.get(u).toString()), `day ${day}`],
    );
  }
  // the day's row is written once, complete, and never changed afterwards
  await c.query('insert into stake_epochs (day, pool, paid, total_weighted, positions) values ($1, $2, $3, $4, $5)', [day, pool.toString(), paid.toString(), totalW.toString(), pos.length]);
  return { day, paid, positions: pos.length };
}

/** Pays every finished day that has not been paid yet (a restart or an outage never loses a day). */
export async function catchUpEpochs(pool, now = Date.now(), { max = 400 } = {}) {
  const s = await withTx(pool, (c) => state(c));
  if (s.paused) return [];
  const last = Math.min(programDay(s.launchAt, now) - 1, PROGRAM_DAYS - 1);
  const done = new Set((await pool.query('select day from stake_epochs')).rows.map((r) => r.day));
  const out = [];
  for (let d = 0; d <= last && out.length < max; d++) {
    if (done.has(d)) continue;
    out.push(await withTx(pool, (c) => runEpoch(c, d, now)));
  }
  return out;
}

// ---- withdrawal addresses and 2FA --------------------------------------------------------------------------------
export async function addWhitelist(c, userId, address, now = Date.now()) {
  await mustBeRunning(c);
  const L = limits();
  const { rows } = await c.query('select count(*)::int as n from stake_whitelist where user_id = $1', [userId]);
  if (rows[0].n >= L.maxAddresses) bad(400, `You can save up to ${L.maxAddresses} withdrawal addresses`);
  const at = new Date(now + L.whitelistDelayMs);
  const r = await c.query('insert into stake_whitelist (user_id, address, active_at) values ($1, $2, $3) on conflict (user_id, address) do nothing returning active_at', [userId, address, at]);
  if (!r.rows[0]) bad(400, 'That address is already saved');
  return r.rows[0].active_at;
}
export async function removeWhitelist(c, userId, address) {
  const r = await c.query('delete from stake_whitelist where user_id = $1 and address = $2', [userId, address]);
  if (!r.rowCount) bad(404, 'Address not found');
}

/**
 * Checks a 2FA code (run it in its own transaction, so a wrong try is always recorded).
 * A code works once; five wrong tries lock it for 15 minutes. `open` turns the stored sealed secret into the secret.
 * Returns { ok: true } or { ok: false, status, msg }.
 */
export async function verifyTotp(c, userId, code, open, now = Date.now(), { requireEnabled = true } = {}) {
  const { rows } = await c.query('select * from stake_totp where user_id = $1 for update', [userId]);
  const t = rows[0];
  if (!t || (requireEnabled && !t.enabled)) return { ok: false, status: 403, msg: 'Turn on two-factor sign-in first' };
  if (t.locked_until && new Date(t.locked_until).getTime() > now) return { ok: false, status: 429, msg: 'Too many wrong codes. Try again in a few minutes.' };
  const step = totpCheck(open(t.secret_enc), code, now);
  if (step === null || step <= Number(t.last_step)) {
    const failed = t.failed + 1;
    await c.query('update stake_totp set failed = $2, locked_until = $3 where user_id = $1', [userId, failed >= 5 ? 0 : failed, failed >= 5 ? new Date(now + 15 * 60_000) : null]);
    return { ok: false, status: 403, msg: 'That code is not right' };
  }
  await c.query('update stake_totp set last_step = $2, failed = 0, locked_until = null where user_id = $1', [userId, step]);
  return { ok: true };
}
export async function totpEnabled(c, userId) {
  const { rows } = await c.query('select enabled from stake_totp where user_id = $1', [userId]);
  return Boolean(rows[0]?.enabled);
}

// ---- withdrawals ---------------------------------------------------------------------------------------------------
export async function requestWithdrawal(c, userId, amount, address, now = Date.now()) {
  await mustBeRunning(c);
  const L = limits();
  if (amount < L.minWithdraw) bad(400, 'That is below the minimum withdrawal');
  const acct = await lockAccount(c, userId);
  if (acct.frozen_until && new Date(acct.frozen_until).getTime() > now) bad(403, 'Withdrawals are on hold for a short time after a security change');
  const wl = await c.query('select active_at from stake_whitelist where user_id = $1 and address = $2', [userId, address]);
  if (!wl.rows[0]) bad(400, 'Save this address in your withdrawal addresses first');
  if (new Date(wl.rows[0].active_at).getTime() > now) bad(403, `This address becomes active on ${new Date(wl.rows[0].active_at).toISOString().replace('T', ' ').slice(0, 16)} UTC`);
  if (acct.available < amount) bad(400, 'Not enough available ZUBA');
  const since = new Date(now - 86_400_000);
  const u = await c.query("select coalesce(sum(amount), 0) as s from stake_withdrawals where user_id = $1 and created_at > $2 and status in ('review', 'queued', 'sending', 'sent')", [userId, since]);
  if (big(u.rows[0].s) + amount > L.userDaily) bad(429, 'Daily withdrawal limit reached. Try again tomorrow.');
  const g = await c.query("select coalesce(sum(amount), 0) as s from stake_withdrawals where created_at > $1 and status in ('queued', 'sending', 'sent')", [since]);
  const auto = !L.manual && amount <= L.autoLimit && big(g.rows[0].s) + amount <= L.globalDaily;
  await c.query('update stake_accounts set available = available - $2, held = held + $2, updated_at = now() where user_id = $1', [userId, amount.toString()]);
  const w = await c.query('insert into stake_withdrawals (user_id, to_address, amount, status) values ($1, $2, $3, $4) returning id', [userId, address, amount.toString(), auto ? 'queued' : 'review']);
  await ledger(c, userId, 'withdraw_hold', amount, String(w.rows[0].id));
  await audit(c, `user:${userId}`, 'withdraw_request', { id: Number(w.rows[0].id), amount, address, auto });
  if (!auto) await alert(c, 'info', L.manual ? `Withdrawal ${w.rows[0].id} is waiting to be paid` : `Withdrawal ${w.rows[0].id} is waiting for your approval`);
  return { id: Number(w.rows[0].id), status: auto ? 'queued' : 'review' };
}

async function release(c, w, status, note) {
  const amount = big(w.amount);
  await lockAccount(c, w.user_id);
  await c.query('update stake_accounts set available = available + $2, held = held - $2, updated_at = now() where user_id = $1', [w.user_id, amount.toString()]);
  await c.query('update stake_withdrawals set status = $2, note = $3 where id = $1', [w.id, status, note ?? null]);
  await ledger(c, w.user_id, 'withdraw_release', amount, String(w.id));
}

export async function cancelWithdrawal(c, userId, id) {
  const { rows } = await c.query("select * from stake_withdrawals where id = $1 and user_id = $2 and status in ('review', 'queued') for update", [id, userId]);
  if (!rows[0]) bad(400, 'This withdrawal can no longer be cancelled');
  await release(c, rows[0], 'cancelled', 'cancelled by user');
}
export async function adminDecide(c, id, approve, actor) {
  const { rows } = await c.query("select * from stake_withdrawals where id = $1 and status = 'review' for update", [id]);
  if (!rows[0]) bad(404, 'No withdrawal waiting for review with that number');
  if (approve && limits().manual) bad(400, 'Send the tokens from your wallet, then confirm with the transaction');
  if (approve) await c.query("update stake_withdrawals set status = 'queued', approved_at = now() where id = $1", [id]);
  else await release(c, rows[0], 'rejected', 'rejected by admin');
  await audit(c, actor, approve ? 'withdraw_approve' : 'withdraw_reject', { id });
}

/**
 * Manual payout: the founder has sent the tokens himself and the worker has checked that transfer on-chain.
 * One on-chain transfer can settle one withdrawal, once (the settlements table refuses a second use).
 */
export async function settleWithdrawal(c, id, txHash, logIndex, actor) {
  const { rows } = await c.query("select * from stake_withdrawals where id = $1 and status = 'review' for update", [id]);
  const w = rows[0];
  if (!w) bad(404, 'No withdrawal waiting with that number');
  const used = await c.query('insert into stake_settlements (tx_hash, log_index, withdrawal_id) values ($1, $2, $3) on conflict do nothing', [txHash.toLowerCase(), logIndex, id]);
  if (!used.rowCount) bad(400, 'That transfer was already used for another withdrawal');
  const amount = big(w.amount);
  await lockAccount(c, w.user_id);
  await c.query('update stake_accounts set held = held - $2, updated_at = now() where user_id = $1', [w.user_id, amount.toString()]);
  await c.query("update stake_withdrawals set status = 'sent', sent_at = now(), approved_at = now(), tx_hash = $2 where id = $1", [id, txHash.toLowerCase()]);
  await ledger(c, w.user_id, 'withdraw_paid', amount, String(id));
  await audit(c, actor, 'withdraw_settle', { id, tx: txHash, logIndex });
}

// ---- used by the payout worker -------------------------------------------------------------------------------------
/** Takes the next queued withdrawal (or resumes one that was being sent when the worker stopped). */
export async function claimWithdrawal(c) {
  const { rows } = await c.query("select * from stake_withdrawals where status in ('sending', 'queued') order by (status = 'sending') desc, id limit 1 for update skip locked");
  const w = rows[0];
  if (!w) return null;
  if (w.status === 'queued') await c.query("update stake_withdrawals set status = 'sending' where id = $1", [w.id]);
  return { ...w, id: Number(w.id), status: 'sending', amount: big(w.amount), nonce: w.nonce === null ? null : Number(w.nonce) };
}
/** Puts a claimed withdrawal back in the queue. Only possible while nothing has been signed for it. */
export async function unclaimWithdrawal(c, id) {
  const r = await c.query("update stake_withdrawals set status = 'queued' where id = $1 and status = 'sending' and nonce is null", [id]);
  return r.rowCount === 1;
}
/** Records a signed transaction BEFORE it is sent. The withdrawal's nonce is fixed by its first transaction. */
export async function saveSignedTx(c, id, txHash, rawTx, nonce, gasPrice) {
  const { rows } = await c.query("select nonce from stake_withdrawals where id = $1 and status = 'sending' for update", [id]);
  if (!rows[0]) throw new Error('withdrawal is not being sent');
  if (rows[0].nonce !== null && Number(rows[0].nonce) !== nonce) throw new Error('a withdrawal can only ever use one nonce');
  await c.query('update stake_withdrawals set nonce = $2 where id = $1', [id, nonce]);
  await c.query('insert into stake_payout_txs (tx_hash, withdrawal_id, raw_tx, nonce, gas_price) values ($1, $2, $3, $4, $5)', [txHash.toLowerCase(), id, rawTx, nonce, gasPrice.toString()]);
}
export async function payoutTxs(c, id) {
  const { rows } = await c.query('select tx_hash, raw_tx, nonce, gas_price, created_at from stake_payout_txs where withdrawal_id = $1 order by created_at, tx_hash', [id]);
  return rows.map((r) => ({ hash: r.tx_hash, raw: r.raw_tx, nonce: Number(r.nonce), gasPrice: big(r.gas_price), at: new Date(r.created_at).getTime() }));
}
export async function finishWithdrawal(c, id, txHash = null) {
  const { rows } = await c.query("select * from stake_withdrawals where id = $1 and status = 'sending' for update", [id]);
  const w = rows[0];
  if (!w) return false;
  const amount = big(w.amount);
  await lockAccount(c, w.user_id);
  await c.query('update stake_accounts set held = held - $2, updated_at = now() where user_id = $1', [w.user_id, amount.toString()]);
  await c.query("update stake_withdrawals set status = 'sent', sent_at = now(), tx_hash = coalesce($2, tx_hash) where id = $1", [id, txHash]);
  await ledger(c, w.user_id, 'withdraw_paid', amount, String(id));
  return true;
}
export async function failWithdrawal(c, id, note, txHash = null) {
  const { rows } = await c.query("select * from stake_withdrawals where id = $1 and status = 'sending' for update", [id]);
  if (!rows[0]) return false;
  await release(c, rows[0], 'failed', note);
  if (txHash) await c.query('update stake_withdrawals set tx_hash = $2 where id = $1', [id, txHash]);
  return true;
}

// ---- self-check ------------------------------------------------------------------------------------------------------
/**
 * The books must always balance. Returns a list of problems (empty = fine).
 *   every account:  available + staked + held  ==  deposits + rewards - paid-out withdrawals   (from the ledger)
 *   all accounts:   staked == the open stakes;  held == the withdrawals not yet paid
 *   all time:       rewards paid never above the 10B budget, and equal to the rewards in the ledger
 */
export async function checkBooks(c) {
  const problems = [];
  const r = await c.query(
    `select a.user_id, a.available, a.staked, a.held,
            coalesce(sum(case when l.kind in ('deposit', 'reward') then l.amount when l.kind = 'withdraw_paid' then -l.amount else 0 end), 0) as net
       from stake_accounts a left join stake_ledger l on l.user_id = a.user_id group by a.user_id, a.available, a.staked, a.held`,
  );
  for (const x of r.rows) {
    if (big(x.available) + big(x.staked) + big(x.held) !== big(x.net)) problems.push(`account ${x.user_id}: balance differs from the ledger`);
  }
  const one = async (q) => big((await c.query(q)).rows[0].s);
  const paid = await one('select coalesce(sum(paid), 0) as s from stake_epochs');
  if (paid > TOTAL_BUDGET) problems.push('rewards paid are above the 10B budget');
  if (paid !== (await one("select coalesce(sum(amount), 0) as s from stake_ledger where kind = 'reward'"))) problems.push('rewards in the ledger differ from the reward days');
  if ((await one("select coalesce(sum(amount), 0) as s from stake_positions where status = 'active'")) !== (await one('select coalesce(sum(staked), 0) as s from stake_accounts'))) problems.push('staked totals differ between positions and accounts');
  if ((await one("select coalesce(sum(amount), 0) as s from stake_withdrawals where status in ('review', 'queued', 'sending')")) !== (await one('select coalesce(sum(held), 0) as s from stake_accounts'))) problems.push('held totals differ between withdrawals and accounts');
  if ((await one("select coalesce(sum(amount), 0) as s from stake_deposits where status = 'credited'")) !== (await one("select coalesce(sum(amount), 0) as s from stake_ledger where kind = 'deposit'"))) problems.push('deposits in the ledger differ from the deposits seen on-chain');
  return problems;
}

/**
 * Everything the system owes right now (base units). The wallets must always hold at least `owed - inFlight + rewardBudgetLeft`.
 * inFlight = withdrawals whose transaction has been signed: those tokens may already have left, while the books still hold them.
 */
export async function liabilities(c) {
  const r = await c.query('select coalesce(sum(available + staked + held), 0) as s from stake_accounts');
  const e = await c.query('select coalesce(sum(paid), 0) as s from stake_epochs');
  // 'sending' = signed by the worker; 'review' in manual mode = the founder may already have paid it and not confirmed yet
  const f = await c.query("select coalesce(sum(amount), 0) as s from stake_withdrawals where (status = 'sending' and nonce is not null) or (status = 'review' and $1)", [limits().manual]);
  return { owed: big(r.rows[0].s), inFlight: big(f.rows[0].s), rewardsPaid: big(e.rows[0].s), rewardBudgetLeft: TOTAL_BUDGET - big(e.rows[0].s) };
}
export { DAYS_PER_YEAR };
