// The always-on staking worker (for example on Render). It accepts NO incoming connections:
// it only reads its database and the chain. Everything is idempotent, so a restart loses nothing.
import pg from 'pg';
import { makeContext } from './context.js';
import { tickRequests, tickChain } from './tick.js';

const pool = new pg.Pool({ connectionString: process.env.STAKE_DATABASE_URL || process.env.DATABASE_URL, max: 6 });
const ctx = await makeContext(pool);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const forever = async (name, ms, fn) => { for (;;) { try { await fn(); } catch (e) { console.error(name, e.message); } await sleep(ms); } };
console.log('staking worker running on chain', ctx.cfg.chainId);
forever('requests', 500, () => tickRequests(ctx));
forever('chain', 4_000, () => tickChain(ctx, { budgetMs: 40_000 }));
