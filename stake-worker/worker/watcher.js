// The watcher: reads the chain for ZUBA sent to users' deposit addresses, waits until the chain calls it final, credits once.
import { withTx, recordDeposit, creditDeposit, limits } from '../lib/db.js';
import { ERC20, TRANSFER_TOPIC, topicOf, firstOk, finalizedHead, tokenBalance, FACTORY } from './chain.js';
import { userSalt } from '../lib/core.js';
import { raiseOnce } from './alerts.js';

export const getCursor = async (pool, name, dflt) => {
  const r = await pool.query('select block from stake_cursor where name = $1', [name]);
  return r.rows[0] ? Number(r.rows[0].block) : dflt;
};
export const setCursor = (pool, name, block) => pool.query('insert into stake_cursor (name, block) values ($1, $2) on conflict (name) do update set block = excluded.block', [name, block]);

/**
 * Step 1: find new transfers. Every pass re-reads the last few blocks, so a chain re-organisation cannot hide a deposit.
 * After an outage it catches up in large steps until `deadline`. cfg = { token, startBlock, maxRange, lookback }
 */
export async function scan(pool, providers, cfg, { deadline = Infinity } = {}) {
  const head = await firstOk(providers, (p) => p.getBlockNumber());
  const lookback = cfg.lookback ?? 20;
  let cursor = await getCursor(pool, 'watch', cfg.startBlock - 1);
  const addrs = (await pool.query('select address from stake_addresses')).rows.map((r) => r.address);
  if (!addrs.length) {
    // nobody has a deposit address yet, so nothing can have been deposited: no need to read old blocks
    await setCursor(pool, 'watch', Math.max(cursor, head - lookback));
    return { head, found: 0, behind: 0 };
  }
  const mine = new Set(addrs.map((a) => a.toLowerCase()));
  const token = cfg.token.toLowerCase();
  let range = cfg.maxRange ?? 20_000, found = 0;
  const minDeposit = cfg.minDeposit ?? limits().minDeposit;
  do {
    const from = Math.max(cfg.startBlock, cursor + 1 - lookback);
    const to = Math.min(head, from + range - 1);
    if (to < from) break;
    let logs;
    try {
      // few users: ask only for transfers to them. Many users: read every transfer of the token and pick ours out.
      const topics = addrs.length <= 200 ? [TRANSFER_TOPIC, null, addrs.map(topicOf)] : [TRANSFER_TOPIC];
      logs = await firstOk(providers, (p) => p.getLogs({ address: cfg.token, topics, fromBlock: from, toBlock: to }));
    } catch (e) {
      if (range > 64) { range = Math.ceil(range / 4); continue; } // the provider wants smaller steps
      throw e;
    }
    for (const l of logs) {
      if (l.address.toLowerCase() !== token || l.removed) continue; // only the real token counts
      const ev = ERC20.parseLog(l);
      if (!ev || ev.name !== 'Transfer' || !mine.has(ev.args.to.toLowerCase()) || ev.args.value <= 0n || ev.args.value < minDeposit) continue; // dust is ignored
      const isNew = await withTx(pool, (c) => recordDeposit(c, { txHash: l.transactionHash, logIndex: l.index, block: l.blockNumber, blockHash: l.blockHash, to: ev.args.to, from: ev.args.from, amount: ev.args.value }));
      if (isNew) found++;
    }
    cursor = to;
    await setCursor(pool, 'watch', cursor);
  } while (cursor < head && Date.now() < deadline);
  return { head, found, behind: head - cursor };
}

/**
 * Step 2: credit deposits that are final. Before crediting, the receipt is fetched again from EVERY provider;
 * if they disagree, or the transfer has vanished (re-organisation), nothing is credited.
 * cfg = { token, confirmations, minProviders }
 */
export async function confirmDeposits(pool, providers, cfg) {
  const head = await firstOk(providers, (p) => p.getBlockNumber());
  const need = cfg.confirmations ?? limits().confirmations;
  const fin = await finalizedHead(providers);
  const safe = fin === null ? head - need + 1 : Math.min(fin, head - need + 1);
  const { rows } = await pool.query("select tx_hash, log_index, block_number, block_hash, to_address, amount from stake_deposits where status = 'pending' and block_number <= $1 order by block_number limit 50", [safe]);
  let credited = 0;
  for (const d of rows) {
    const answers = [];
    for (const p of providers) {
      try { answers.push(await p.getTransactionReceipt(d.tx_hash)); } catch { /* a provider that is down is skipped */ }
    }
    if (answers.length < (cfg.minProviders ?? 1)) continue; // not enough independent sources right now
    if (answers.some((a) => a === null)) {
      if (answers.every((a) => a === null)) {
        // gone from every provider: the block was replaced. Forget it; the next scan finds the real one if it exists.
        await pool.query("delete from stake_deposits where tx_hash = $1 and log_index = $2 and status = 'pending'", [d.tx_hash, d.log_index]);
      } else {
        await raiseOnce(pool, 'warning', `Providers disagree about transaction ${d.tx_hash}; not credited yet`);
      }
      continue;
    }
    const first = answers[0];
    if (answers.some((a) => a.blockHash !== first.blockHash || a.status !== first.status)) {
      await raiseOnce(pool, 'warning', `Providers disagree about transaction ${d.tx_hash}; not credited yet`);
      continue;
    }
    if (first.status !== 1 || first.blockNumber > safe) continue;
    // the transfer must still be in that receipt, same place, same size
    const log = first.logs.find((l) => l.index === d.log_index && l.address.toLowerCase() === cfg.token.toLowerCase() && l.topics[0] === TRANSFER_TOPIC);
    const ev = log && ERC20.parseLog(log);
    if (!ev || ev.args.to.toLowerCase() !== d.to_address.toLowerCase() || ev.args.value.toString() !== String(d.amount)) {
      await pool.query("delete from stake_deposits where tx_hash = $1 and log_index = $2 and status = 'pending'", [d.tx_hash, d.log_index]);
      continue;
    }
    if (first.blockHash.toLowerCase() !== d.block_hash) await pool.query("update stake_deposits set block_hash = $3, block_number = $4 where tx_hash = $1 and log_index = $2 and status = 'pending'", [d.tx_hash, d.log_index, first.blockHash.toLowerCase(), first.blockNumber]);
    if (await withTx(pool, (c) => creditDeposit(c, d.tx_hash, d.log_index))) credited++;
  }
  return { head, credited };
}

/**
 * Step 3: move credited deposits into the vault. Anyone can trigger a sweep; the tokens can only go to the vault.
 * One sweep transaction is in flight at a time. cfg = { token, factory, minSweep, sweepWaitMs }
 */
export async function sweepDeposits(pool, providers, signer, cfg) {
  const { rows } = await pool.query("select distinct d.user_id, d.to_address from stake_deposits d where d.status = 'credited' and (d.swept_tx is null or d.swept_tx like 'pending:%') and d.user_id is not null limit 10");
  if (!rows.length) return { swept: 0 };
  // still waiting for an earlier sweep to be mined? then do not send another yet
  const [mined, pending] = await Promise.all([
    firstOk(providers, (p) => p.getTransactionCount(signer.address, 'latest')),
    firstOk(providers, (p) => p.getTransactionCount(signer.address, 'pending')),
  ]);
  const inFlight = pending > mined;
  let swept = 0;
  for (const r of rows) {
    const bal = await tokenBalance(providers, cfg.token, r.to_address);
    if (bal === 0n) {
      // already in the vault (our sweep was mined, or someone else called sweep): keep the hash if we have one
      await pool.query("update stake_deposits set swept_tx = case when swept_tx like 'pending:%' then substr(swept_tx, 9) else 'none' end where to_address = $1 and status = 'credited' and (swept_tx is null or swept_tx like 'pending:%')", [r.to_address]);
      swept++;
      continue;
    }
    if (inFlight || bal < (cfg.minSweep ?? 0n)) continue;
    const fee = await firstOk(providers, (p) => p.getFeeData());
    const gasPrice = ((fee.gasPrice ?? 1_000_000_000n) * 12n) / 10n;
    const bnb = await firstOk(providers, (p) => p.getBalance(signer.address));
    if (bnb < gasPrice * 400_000n) { await raiseOnce(pool, 'warning', `The sweep wallet ${signer.address} is low on BNB for fees. Top it up.`); break; }
    const data = FACTORY.encodeFunctionData('sweep', [userSalt(r.user_id), cfg.token]);
    let gasLimit;
    try { gasLimit = ((await firstOk(providers, (p) => p.estimateGas({ from: signer.address, to: cfg.factory, data }))) * 13n) / 10n; } catch (e) {
      await raiseOnce(pool, 'warning', `Sweep for ${r.to_address} would fail: ${String(e.shortMessage || e.message).slice(0, 120)}`);
      continue;
    }
    const raw = await signer.signTransaction({ to: cfg.factory, data, nonce: pending, gasLimit, gasPrice, chainId: cfg.chainId, type: 0, value: 0n });
    const tx = await firstOk(providers, (p) => p.broadcastTransaction(raw));
    await pool.query("update stake_deposits set swept_tx = $2 where to_address = $1 and status = 'credited' and (swept_tx is null or swept_tx like 'pending:%')", [r.to_address, `pending:${tx.hash}`]);
    const until = Date.now() + (cfg.sweepWaitMs ?? 8000);
    while (Date.now() < until) {
      const rc = await firstOk(providers, (p) => p.getTransactionReceipt(tx.hash)).catch(() => null);
      if (rc) {
        if (rc.status === 1) { await pool.query('update stake_deposits set swept_tx = $2 where to_address = $1 and swept_tx = $3', [r.to_address, tx.hash, `pending:${tx.hash}`]); swept++; } else {
          await pool.query('update stake_deposits set swept_tx = null where to_address = $1 and swept_tx = $2', [r.to_address, `pending:${tx.hash}`]);
          await raiseOnce(pool, 'warning', `Sweep failed for ${r.to_address}`);
        }
        break;
      }
      await new Promise((res) => setTimeout(res, cfg.pollMs ?? 700));
    }
    break; // one sweep transaction per pass
  }
  return { swept };
}
