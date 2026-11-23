// Wallet activity: transactions made from the app, checked on the blockchain and
// shown per token with their hash. The server only reads the chain; it never moves funds.
import { sql } from './db.js';
import { fail, limit, readBody, requireUser } from './core.js';
import { rpc, TRANSFER } from './chain.js';

const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const topicAddr = (t) => '0x' + String(t).slice(-40).toLowerCase();

async function walletOf(userId) {
  const [w] = await sql`select lower(address::text) as address from wallets where user_id = ${userId}`;
  return w?.address ?? null;
}

/** Reads a transaction from the chain and stores each transfer in it. Returns false while pending. */
async function resolve(hash) {
  const receipt = await rpc('eth_getTransactionReceipt', [hash]);
  if (!receipt) return false;
  const tx = await rpc('eth_getTransactionByHash', [hash]);
  const ok = receipt.status === '0x1';
  const block = Number(BigInt(receipt.blockNumber));
  const from = String(tx.from).toLowerCase();
  const rows = [];
  if (tx.value && BigInt(tx.value) > 0n) rows.push({ i: -1, token: 'bnb', from, to: String(tx.to).toLowerCase(), amount: BigInt(tx.value).toString() });
  for (const log of receipt.logs || []) {
    if (log.topics?.[0] !== TRANSFER || log.topics.length !== 3) continue;
    rows.push({ i: Number(BigInt(log.logIndex)), token: String(log.address).toLowerCase(), from: topicAddr(log.topics[1]), to: topicAddr(log.topics[2]), amount: BigInt(log.data).toString() });
  }
  for (const r of rows) {
    await sql`insert into wallet_txs (hash, idx, token, from_addr, to_addr, amount, block, ok)
      values (${hash}, ${r.i}, ${r.token}, ${r.from}, ${r.to}, ${r.amount}, ${block}, ${ok}) on conflict (hash, idx) do nothing`;
  }
  await sql`update wallet_tx_pending set done = true where hash = ${hash}`;
  return true;
}

/** POST /wallet/tx {hash} — the app reports a transaction it just sent from your linked wallet. */
export async function record(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`wtx:${u.id}`, 300, 86400);
  const hash = String(b.hash || '');
  if (!HASH.test(hash)) fail(400, 'Check the transaction hash');
  if (!(await walletOf(u.id))) fail(400, 'Link your wallet first');
  await sql`insert into wallet_tx_pending (hash, user_id) values (${hash.toLowerCase()}, ${u.id}) on conflict (hash) do nothing`;
  try {
    await resolve(hash.toLowerCase());
  } catch {}
  return { ok: true };
}

/** GET /wallet/txs?token=0x…|bnb — your transfers of one token, newest first. */
export async function list(req) {
  const u = await requireUser(req);
  await limit(`wtxl:${u.id}`, 600, 3600);
  const q = new URL(req.url, 'http://x').searchParams;
  const token = String(q.get('token') || '').toLowerCase();
  if (token !== 'bnb' && !ADDR.test(token)) fail(400, 'Check the token');
  const me = await walletOf(u.id);
  if (!me) return { txs: [], wallet: null };
  // Finish anything still pending (a few at a time, so the request stays quick).
  const pending = await sql`select hash from wallet_tx_pending where user_id = ${u.id} and not done and created_at > now() - interval '2 days' order by created_at desc limit 5`;
  for (const p of pending) {
    try {
      await resolve(p.hash);
    } catch {}
  }
  const rows = await sql`select hash, token, from_addr, to_addr, amount, block, ok, created_at from wallet_txs
    where token = ${token} and (from_addr = ${me} or to_addr = ${me}) order by block desc, idx desc limit 100`;
  const waiting = await sql`select hash, created_at from wallet_tx_pending where user_id = ${u.id} and not done and created_at > now() - interval '2 days' order by created_at desc limit 10`;
  return {
    wallet: me,
    txs: rows.map((r) => ({ hash: r.hash, dir: r.from_addr === me ? 'out' : 'in', other: r.from_addr === me ? r.to_addr : r.from_addr, amount: r.amount, ok: r.ok, at: new Date(r.created_at).getTime() })),
    pending: waiting.map((w) => ({ hash: w.hash, at: new Date(w.created_at).getTime() })),
  };
}
