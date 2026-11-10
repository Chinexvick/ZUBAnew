// The payout signer: sends approved withdrawals from a small hot wallet, one at a time.
// Crash-safe: every signed transaction is saved BEFORE it is sent, and all transactions of one withdrawal
// share ONE nonce, so the chain itself makes sure a withdrawal can never be paid twice.
import { keccak256, Transaction } from 'ethers';
import { withTx, claimWithdrawal, unclaimWithdrawal, saveSignedTx, payoutTxs, finishWithdrawal, failWithdrawal, state, pause } from '../lib/db.js';
import { ERC20, firstOk, tokenBalance, sleep } from './chain.js';
import { raise, raiseOnce } from './alerts.js';
import { reconcile } from './reconcile.js';

/**
 * cfg = { token, chainId, holders, hotCapPerDay (bigint), maxSingle (bigint), neverSendTo: [addresses],
 *         payoutConfirmations, waitMs, pollMs, bumpAfterMs, maxBumps }
 */
export async function payoutOnce(pool, providers, wallet, cfg) {
  const st = await withTx(pool, (c) => state(c));
  if (st.paused) return { idle: 'paused' };
  const next = await pool.query("select id, amount, status from stake_withdrawals where status in ('sending', 'queued') order by (status = 'sending') desc, id limit 1");
  if (!next.rows[0]) return { idle: 'nothing to pay' };
  const resuming = next.rows[0].status === 'sending';
  if (!resuming) {
    // the hot wallet's own limit, counted from the database: even a hacked website cannot make it send more than this per day
    const sent = await pool.query("select coalesce(sum(amount), 0) as s from stake_withdrawals where status in ('sending', 'sent') and coalesce(sent_at, approved_at, created_at) > now() - interval '24 hours'");
    if (BigInt(sent.rows[0].s) + BigInt(next.rows[0].amount) > cfg.hotCapPerDay) {
      await raiseOnce(pool, 'warning', 'The hot wallet reached its daily limit; remaining withdrawals wait for tomorrow or an admin');
      return { idle: 'daily limit' };
    }
  }
  const w = await withTx(pool, (c) => claimWithdrawal(c));
  if (!w) return { idle: 'nothing to pay' };
  const to = w.to_address;
  let txs = await withTx(pool, (c) => payoutTxs(c, w.id));

  if (!txs.length) {
    // ---- nothing signed yet: every check happens now, before the first signature ----
    if (w.amount > cfg.maxSingle || cfg.neverSendTo.some((a) => a.toLowerCase() === to.toLowerCase())) {
      await withTx(pool, (c) => failWithdrawal(c, w.id, 'blocked by payout policy'));
      await raise(pool, 'critical', `Withdrawal ${w.id} blocked by the payout policy`);
      return { blocked: w.id };
    }
    // the books must balance and the wallets must cover everything owed, checked against the chain itself
    const rec = await reconcile(pool, providers, cfg);
    if (rec.problems.length) { await withTx(pool, (c) => unclaimWithdrawal(c, w.id)); return { idle: 'paused' }; }
    const back = async (why, level, msg) => { await raiseOnce(pool, level, msg); await withTx(pool, (c) => unclaimWithdrawal(c, w.id)); return { idle: why }; };
    if ((await tokenBalance(providers, cfg.token, wallet.address)) < w.amount) return back('hot wallet low', 'critical', `The hot wallet is too low to pay withdrawal ${w.id}. Refill it from the vault.`);
    const data = ERC20.encodeFunctionData('transfer', [to, w.amount]);
    const gasPrice = await price(providers);
    let gasLimit;
    try { gasLimit = ((await firstOk(providers, (p) => p.estimateGas({ from: wallet.address, to: cfg.token, data }))) * 15n) / 10n; } catch (e) {
      // the token itself refuses this transfer (for example a blocked address): give the user their tokens back
      await withTx(pool, (c) => failWithdrawal(c, w.id, 'the token refused this transfer'));
      await raise(pool, 'warning', `Withdrawal ${w.id} cannot be sent: ${String(e.shortMessage || e.message).slice(0, 120)}`);
      return { failed: w.id };
    }
    if (gasLimit < 60_000n) gasLimit = 60_000n;
    if ((await firstOk(providers, (p) => p.getBalance(wallet.address))) < gasPrice * gasLimit * 3n) return back('out of gas', 'critical', `The payout wallet ${wallet.address} is almost out of BNB for fees. Top it up.`);
    const [mined, pending] = await Promise.all([
      firstOk(providers, (p) => p.getTransactionCount(wallet.address, 'latest')),
      firstOk(providers, (p) => p.getTransactionCount(wallet.address, 'pending')),
    ]);
    if (pending > mined) return back('nonce busy', 'critical', 'The payout wallet has a pending transaction that this system did not send. Check the wallet.');
    const tx = await sign(wallet, cfg, to, w.amount, mined, gasLimit, gasPrice);
    await withTx(pool, (c) => saveSignedTx(c, w.id, tx.hash, tx.raw, mined, gasPrice)); // saved first
    txs = [{ ...tx, nonce: mined, gasPrice, at: Date.now(), gasLimit }];
  }

  const nonce = txs[0].nonce;
  const latest = txs[txs.length - 1];
  await send(providers, latest.raw);
  const until = Date.now() + (cfg.waitMs ?? 12_000);
  for (;;) {
    for (const t of txs) {
      const rc = await firstOk(providers, (p) => p.getTransactionReceipt(t.hash)).catch(() => null);
      if (!rc) continue;
      const head = await firstOk(providers, (p) => p.getBlockNumber());
      if (head - rc.blockNumber + 1 < (cfg.payoutConfirmations ?? 3)) break; // mined, not deep enough yet
      if (rc.status === 1) { await withTx(pool, (c) => finishWithdrawal(c, w.id, t.hash)); return { paid: w.id, hash: t.hash }; }
      await withTx(pool, (c) => failWithdrawal(c, w.id, 'transaction reverted', t.hash));
      await raise(pool, 'critical', `Withdrawal ${w.id} reverted on-chain (${t.hash})`);
      return { failed: w.id };
    }
    if (Date.now() >= until) break;
    await sleep(cfg.pollMs ?? 700);
  }

  // not mined yet. Was our nonce used by a transaction that is not ours? Then the key is in someone else's hands.
  const mined = await firstOk(providers, (p) => p.getTransactionCount(wallet.address, 'latest'));
  if (mined > nonce) {
    for (let i = 0; i < 5; i++) { // look again, on every provider, before believing it
      await sleep(cfg.pollMs ?? 700);
      for (const t of txs) for (const p of providers) if (await p.getTransactionReceipt(t.hash).catch(() => null)) return { pending: w.id }; // ours after all; the next pass finishes it
    }
    await withTx(pool, (c) => pause(c, `payout nonce ${nonce} was used by a transaction this system did not send (withdrawal ${w.id})`));
    return { idle: 'paused' };
  }
  // stuck with too low a fee? sign it again with the SAME nonce and a higher fee (only one of them can ever be mined)
  if (Date.now() - latest.at > (cfg.bumpAfterMs ?? 120_000) && txs.length <= (cfg.maxBumps ?? 5)) {
    const now = await price(providers);
    const gasPrice = now > (latest.gasPrice * 115n) / 100n ? now : (latest.gasPrice * 115n) / 100n + 1n;
    const tx = await sign(wallet, cfg, to, w.amount, nonce, Transaction.from(latest.raw).gasLimit, gasPrice);
    await withTx(pool, (c) => saveSignedTx(c, w.id, tx.hash, tx.raw, nonce, gasPrice));
    await send(providers, tx.raw);
    await raiseOnce(pool, 'warning', `Withdrawal ${w.id} was slow to confirm; re-sent with a higher fee`);
  }
  return { pending: w.id };
}

const price = async (providers) => (((await firstOk(providers, (p) => p.getFeeData())).gasPrice ?? 1_000_000_000n) * 12n) / 10n;
async function sign(wallet, cfg, to, amount, nonce, gasLimit, gasPrice) {
  const raw = await wallet.signTransaction({ to: cfg.token, data: ERC20.encodeFunctionData('transfer', [to, amount]), nonce, gasLimit, gasPrice, chainId: cfg.chainId, type: 0, value: 0n });
  return { raw, hash: keccak256(raw) };
}
/** Sends to every provider. "already known" / "nonce too low" mean it went out before: the receipt decides, not this. */
async function send(providers, raw) {
  await Promise.all(providers.map((p) => p.broadcastTransaction(raw).catch((e) => { if (process.env.STAKE_DEBUG) console.error('broadcast:', e.shortMessage || e.message); })));
}
