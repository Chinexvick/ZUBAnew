// Builds everything the worker needs from its environment and the stake_config table.
import { Wallet } from 'ethers';
import { makeProviders, healthy } from './chain.js';
import { ERC20, firstOk } from './chain.js';
import { assertSafeConfig, tokens, dayMs, MAINNET_CHAIN_ID } from '../lib/core.js';
import { limits } from '../lib/db.js';
import { open, pemFromEnv, signText } from '../lib/seal.js';
import { StakeError } from '../lib/db.js';
import { TRANSFER_TOPIC, finalizedHead } from './chain.js';

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export async function makeContext(pool, env = process.env) {
  const conf = Object.fromEntries((await pool.query('select key, value from stake_config')).rows.map((r) => [r.key, r.value]));
  const need = (k) => { const v = env[k.toUpperCase()] || conf[k]; if (!v) throw new Error(`missing setting ${k}`); return v; };
  const chainId = Number(need('chain_id'));
  // the length of a "day" is part of the deployment, written once at set-up; a test network may shorten it
  if (conf.day_ms) process.env.STAKE_DAY_MS = conf.day_ms;
  assertSafeConfig(chainId);
  const testMode = env.STAKE_TEST_MODE === '1' && chainId !== MAINNET_CHAIN_ID;
  const chainReady = conf.chain_ready !== '0'; // '0' until the contracts are deployed: accounts work, deposits do not yet

  const all = makeProviders(list(need('rpc_urls')), chainId);
  // the worker only gets a payout key in 'auto' mode. In manual mode nothing on this machine can send ZUBA.
  const manual = limits().manual;
  const payer = manual ? null : new Wallet(need('payout_key'));
  const payFrom = list(env.PAY_FROM); // manual mode: the founder's paying wallet(s)
  const sweeper = new Wallet(need('sweep_key'));
  const faucet = testMode && env.FAUCET_KEY ? new Wallet(env.FAUCET_KEY) : null;
  const token = need('token'), factory = need('factory'), vault = need('vault');
  const sealPriv = pemFromEnv(need('seal_priv_b64'));
  const cfg = {
    chainId, token, factory, vault,
    startBlock: Number(need('start_block')),
    confirmations: limits().confirmations,
    minProviders: Number(env.MIN_PROVIDERS || 1),
    maxRange: Number(env.MAX_LOG_RANGE || 20_000),
    hotCapPerDay: tokens(env.HOT_CAP_PER_DAY || 100_000_000),
    maxSingle: tokens(env.MAX_SINGLE || 50_000_000),
    minSweep: tokens(env.MIN_SWEEP || 0),
    payoutConfirmations: Number(env.PAYOUT_CONFIRMATIONS || 5),
    initCodeHash: need('init_code_hash'), manual,
    neverSendTo: [token, factory, vault, sweeper.address, ...(payer ? [payer.address] : []), ...payFrom, ...(faucet ? [faucet.address] : [])],
    holders: [...new Set([vault, ...(payer ? [payer.address] : []), ...payFrom, ...list(env.HOLDERS)])],
  };
  const requests = {
    openSecret: (sealed) => open(sealPriv, sealed),
    factory, initCodeHash: need('init_code_hash'),
    forbidden: cfg.neverSendTo,
    adminIds: list(env.ADMIN_IDS), adminSecret: env.ADMIN_TOTP || '',
    testFaucet: null,
    verifyPayment: null,
  };
  const ctx = { pool, cfg, chainReady, sign: (text) => signText(sealPriv, text), all, payer, sweeper, faucet, requests, testMode, tg: { telegramToken: env.TELEGRAM_TOKEN, telegramChat: env.TELEGRAM_CHAT } };
  ctx.providers = async () => {
    const ok = await healthy(all, chainId);
    if (!ok.length) throw new Error('no chain provider is reachable');
    return ok;
  };
  /**
   * Manual payouts. Is `tx` really a confirmed transfer of exactly `amount` ZUBA to `to`, sent after the withdrawal
   * was requested, (from one of the founder's wallets, if those are listed), and not used for another withdrawal?
   */
  requests.verifyPayment = async ({ tx, to, amount, createdAt }, c) => {
    const no = (msg) => { throw new StakeError(400, msg); };
    if (!chainReady) no('Deposits are not open yet');
    const providers = await ctx.providers();
    const answers = [];
    for (const p of providers) { try { answers.push(await p.getTransactionReceipt(tx)); } catch { /* down */ } }
    if (answers.length < cfg.minProviders || answers.some((a) => a === null)) no('That transaction is not on the chain yet. Wait a minute and try again.');
    const rc = answers[0];
    if (answers.some((a) => a.blockHash !== rc.blockHash || a.status !== rc.status)) no('The network has not settled on that transaction yet. Try again in a minute.');
    if (rc.status !== 1) no('That transaction failed on the chain');
    const head = await firstOk(providers, (p) => p.getBlockNumber());
    const fin = await finalizedHead(providers);
    if (head - rc.blockNumber + 1 < cfg.confirmations || (fin !== null && rc.blockNumber > fin)) no('That transaction is not confirmed yet. Try again in a minute.');
    const block = await firstOk(providers, (p) => p.getBlock(rc.blockNumber));
    if (Number(block.timestamp) * 1000 < createdAt - 60_000) no('That transaction is older than this withdrawal');
    const fits = rc.logs.filter((l) => {
      if (l.address.toLowerCase() !== token.toLowerCase() || l.topics[0] !== TRANSFER_TOPIC) return false;
      const ev = ERC20.parseLog(l);
      return ev && ev.args.to.toLowerCase() === to.toLowerCase() && ev.args.value === amount && (!payFrom.length || payFrom.some((a) => a.toLowerCase() === ev.args.from.toLowerCase()));
    });
    if (!fits.length) no('That transaction does not send exactly this amount of ZUBA to this address from your paying wallet');
    for (const l of fits) {
      const used = await c.query('select 1 from stake_settlements where tx_hash = $1 and log_index = $2', [tx, l.index]);
      if (!used.rowCount) return { logIndex: l.index };
    }
    return no('That transfer was already used for another withdrawal');
  };
  if (faucet && chainReady) {
    const amount = tokens(env.FAUCET_AMOUNT || 100_000);
    requests.testFaucet = async (address) => {
      const providers = await ctx.providers();
      const fee = await firstOk(providers, (p) => p.getFeeData());
      const nonce = await firstOk(providers, (p) => p.getTransactionCount(faucet.address, 'pending'));
      const raw = await faucet.signTransaction({ to: token, data: ERC20.encodeFunctionData('transfer', [address, amount]), nonce, gasLimit: 120_000n, gasPrice: ((fee.gasPrice ?? 1_000_000_000n) * 12n) / 10n, chainId, type: 0, value: 0n });
      const tx = await firstOk(providers, (p) => p.broadcastTransaction(raw));
      return { tx: tx.hash, amount: amount.toString() };
    };
  }
  // what the website shows about limits comes from here, so both always agree
  const L = limits();
  const pub = JSON.stringify({ minStake: L.minStake.toString(), minWithdraw: L.minWithdraw.toString(), autoLimit: L.autoLimit.toString(), userDaily: L.userDaily.toString(), whitelistDelayMs: L.whitelistDelayMs, confirmations: L.confirmations, maxAddresses: L.maxAddresses, dayMs: dayMs(), testMode, faucetAmount: faucet && chainReady ? tokens(env.FAUCET_AMOUNT || 100_000).toString() : null, manual, payout: payer ? payer.address : (payFrom[0] || '') });
  if (conf.public !== pub) await pool.query("insert into stake_config (key, value) values ('public', $1) on conflict (key) do update set value = excluded.value", [pub]);
  return ctx;
}
