// One pass of each duty. The always-on worker calls these in a loop; a serverless host calls them on demand.
// Leases make sure only one pass of each kind runs at a time, wherever it is started from.
import { withLease, catchUpEpochs } from '../lib/db.js';
import { processRequests } from '../lib/requests.js';
import { scan, confirmDeposits, sweepDeposits, getCursor, setCursor } from './watcher.js';
import { payoutOnce } from './payout.js';
import { reconcile } from './reconcile.js';
import { flushAlerts, raiseOnce } from './alerts.js';
import { proveWithdrawals } from './prove.js';

/** The request desk: stake, unstake, withdrawal requests, two-factor... Fast (database only, except the test faucet). */
export function tickRequests(ctx) {
  return withLease(ctx.pool, 'requests', 20_000, () => processRequests(ctx.pool, ctx.requests));
}

/** Everything that talks to the chain: find deposits, credit them, move them to the vault, pay withdrawals, pay rewards, self-check. */
export function tickChain(ctx, { budgetMs = 25_000 } = {}) {
  const { pool, cfg } = ctx;
  if (!ctx.chainReady) return Promise.resolve({ skipped: 'contracts not deployed yet' });
  return withLease(pool, 'chain', budgetMs + 30_000, async () => {
    const t0 = Date.now(), left = () => budgetMs - (Date.now() - t0);
    const out = {};
    const step = async (name, fn) => {
      try { out[name] = await fn(); } catch (e) {
        out[name] = { error: String(e.shortMessage || e.message).slice(0, 200) };
        console.error(name, e);
        try { await raiseOnce(pool, 'warning', `${name} failed: ${out[name].error}`, 30); } catch { /* database down */ }
      }
    };
    const providers = await ctx.providers();
    await step('scan', () => scan(pool, providers, cfg, { deadline: t0 + budgetMs * 0.4 }));
    await step('confirm', () => confirmDeposits(pool, providers, cfg));
    await step('sweep', () => sweepDeposits(pool, providers, ctx.sweeper, cfg));
    await step('prove', () => proveWithdrawals(pool, providers, cfg, ctx.sign));
    if (ctx.payer) await step('payout', async () => {
      const done = [];
      while (left() > 14_000) {
        const r = await payoutOnce(pool, providers, ctx.payer, { ...cfg, waitMs: Math.min(12_000, left() - 6_000) });
        done.push(r);
        if (r.idle || r.pending) break;
      }
      return done;
    });
    await step('rewards', async () => (await catchUpEpochs(pool, Date.now(), { max: 200 })).length);
    if (Date.now() / 1000 - (await getCursor(pool, 'reconciled', 0)) > 300) {
      await step('reconcile', async () => { const r = await reconcile(pool, providers, cfg); await setCursor(pool, 'reconciled', Math.floor(Date.now() / 1000)); return r.problems; });
    }
    await step('alerts', () => flushAlerts(pool, ctx.tg));
    await pool.query("insert into stake_cursor (name, block) values ('heartbeat', extract(epoch from now())::bigint) on conflict (name) do update set block = excluded.block");
    out.ms = Date.now() - t0;
    return out;
  });
}
