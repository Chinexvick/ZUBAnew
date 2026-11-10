// The self-check: the books balance, and the real tokens on-chain cover everything owed. Any gap pauses staking.
import { withTx, checkBooks, liabilities, pause } from '../lib/db.js';
import { tokenBalance } from './chain.js';

/**
 * Do the wallets really hold what the books say? cfg = { token, holders: [vault, hot wallet, ...] }
 * Counted: the holders, plus deposit addresses whose credited deposits have not been moved to the vault yet.
 * Needed:  everything owed to users (minus withdrawals already signed and on their way) + the unspent reward budget.
 */
export async function solvency(pool, providers, cfg) {
  let onchain = 0n;
  for (const h of cfg.holders) onchain += await tokenBalance(providers, cfg.token, h);
  const unswept = await pool.query("select distinct to_address from stake_deposits where status = 'credited' and (swept_tx is null or swept_tx like 'pending:%')");
  for (const r of unswept.rows) onchain += await tokenBalance(providers, cfg.token, r.to_address);
  const l = await withTx(pool, (c) => liabilities(c));
  const need = l.owed - l.inFlight + l.rewardBudgetLeft;
  return { ok: onchain >= need, onchain, need, ...l };
}

export async function reconcile(pool, providers, cfg) {
  const problems = await withTx(pool, (c) => checkBooks(c));
  const s = await solvency(pool, providers, cfg);
  if (!s.ok) problems.push(`the wallets hold ${s.onchain} but ${s.need} is needed`);
  if (problems.length) await withTx(pool, (c) => pause(c, problems.join('; ')));
  return { problems, onchain: s.onchain, need: s.need };
}
