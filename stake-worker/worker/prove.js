// Before the founder pays a withdrawal by hand, the worker checks it against the chain itself:
// did this user's own deposit address really receive enough ZUBA to justify it?
// The answer is SIGNED, so the admin page can tell a genuine check from a row someone edited in the database.
import { ERC20, TRANSFER_TOPIC, firstOk } from './chain.js';
import { MAX_APY_BP, DAYS_PER_YEAR, depositAddress, dayMs } from '../lib/core.js';
import { withTx, pause } from '../lib/db.js';
import { proofText } from '../lib/seal.js';
import { raise } from './alerts.js';

const seen = new Map(); // `${tx}:${index}` -> { to, amount, time } once read from the chain (a mined transfer never changes)

async function onChain(providers, token, txHash, logIndex) {
  const key = `${txHash}:${logIndex}`;
  if (seen.has(key)) return seen.get(key);
  const rc = await firstOk(providers, (p) => p.getTransactionReceipt(txHash));
  if (!rc || rc.status !== 1) return null;
  const log = rc.logs.find((l) => l.index === logIndex && l.address.toLowerCase() === token.toLowerCase() && l.topics[0] === TRANSFER_TOPIC);
  const ev = log && ERC20.parseLog(log);
  if (!ev) return null;
  const block = await firstOk(providers, (p) => p.getBlock(rc.blockNumber));
  const out = { to: ev.args.to.toLowerCase(), amount: ev.args.value, time: Number(block.timestamp) * 1000 };
  seen.set(key, out);
  return out;
}

/**
 * The most this user could honestly hold: every deposit that really arrived at THEIR address (the address is
 * worked out from the user id, never read from the database), grown at the maximum reward rate since the first one.
 */
export async function honestCeiling(pool, providers, cfg, userId, now = Date.now()) {
  const mine = depositAddress(userId, cfg.factory, cfg.initCodeHash).toLowerCase();
  const { rows } = await pool.query("select tx_hash, log_index, amount from stake_deposits where user_id = $1 and status = 'credited' order by block_number limit 2000", [userId]);
  let deposited = 0n, first = now;
  for (const d of rows) {
    const t = await onChain(providers, cfg.token, d.tx_hash, d.log_index);
    if (!t || t.to !== mine || t.amount.toString() !== String(d.amount)) continue; // not real: counts for nothing
    deposited += t.amount;
    if (t.time < first) first = t.time;
  }
  const days = Math.max(0, (now - first) / dayMs()) + 2;
  const growth = Math.pow(1 + Number(MAX_APY_BP) / 10000 / DAYS_PER_YEAR, days);
  return { deposited, ceiling: (deposited * BigInt(Math.ceil(growth * 1e9))) / 1_000_000_000n };
}

/** Checks every waiting withdrawal that has no check yet. A failed check pauses staking: something invented a balance. */
export async function proveWithdrawals(pool, providers, cfg, sign) {
  const { rows } = await pool.query("select id, user_id, to_address, amount from stake_withdrawals where status = 'review' and proof is null order by id limit 20");
  let ok = 0, failed = 0;
  for (const w of rows) {
    const { deposited, ceiling } = await honestCeiling(pool, providers, cfg, w.user_id);
    // what already left, or is asking to leave ahead of this one
    const out = await pool.query("select coalesce(sum(amount), 0) as s from stake_withdrawals where user_id = $1 and id <> $2 and (status in ('sent', 'sending', 'queued') or (status = 'review' and id < $2))", [w.user_id, w.id]);
    const good = BigInt(w.amount) + BigInt(out.rows[0].s) <= ceiling;
    const at = Date.now(), result = good ? 'ok' : 'fail';
    const note = good ? null : `asks for more than this account could hold (verified deposits ${deposited})`;
    await pool.query("update stake_withdrawals set proof = $2, proof_note = $3, proof_sig = $4, proof_at = to_timestamp($5 / 1000.0) where id = $1 and status = 'review'", [w.id, result, note, sign(proofText(w, result, at)), at]);
    if (good) ok++; else {
      failed++;
      await raise(pool, 'critical', `DO NOT PAY withdrawal ${w.id}: it ${note}`);
      await withTx(pool, (c) => pause(c, `withdrawal ${w.id} is not backed by real deposits`));
    }
  }
  return { ok, failed };
}
