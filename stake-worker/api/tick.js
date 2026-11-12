// Serverless entry for the worker (used by the TEST deployment, where there is no always-on machine).
//   POST /api/tick?mode=requests   handle waiting requests (fast)
//   POST /api/tick?mode=chain      one pass over the chain duties
// Needs the tick token. It takes no other input: it can only make the worker do its normal job sooner.
import crypto from 'node:crypto';
import pg from 'pg';
import { makeContext } from '../worker/context.js';
import { tickRequests, tickChain } from '../worker/tick.js';

let ready;
const context = () => (ready ??= (async () => {
  const pool = new pg.Pool({ connectionString: process.env.STAKE_DATABASE_URL || process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 20_000 });
  pool.on('error', () => {});
  return makeContext(pool);
})().catch((e) => { ready = undefined; throw e; }));

function allowed(req) {
  const got = String(req.headers.authorization || '').replace(/^Bearer /, '');
  return [process.env.TICK_TOKEN, process.env.CRON_SECRET].some((want) => want && want.length >= 32 && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want)));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!allowed(req)) { res.statusCode = 404; return res.end('{"error":"Not found"}'); }
  try {
    const ctx = await context();
    const mode = new URL(req.url, 'https://x').searchParams.get('mode') || 'all';
    const out = {};
    // when the worker was last told to run (lets the founder see that the every-minute trigger is alive)
    await ctx.pool.query("insert into stake_cursor (name, block) values ('called', extract(epoch from now())::bigint) on conflict (name) do update set block = excluded.block");
    if (mode === 'requests' || mode === 'all') out.requests = await tickRequests(ctx);
    if (mode === 'chain' || mode === 'all') out.chain = await tickChain(ctx, { budgetMs: 22_000 });
    res.statusCode = 200;
    res.end(JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end('{"error":"tick failed"}');
  }
}
