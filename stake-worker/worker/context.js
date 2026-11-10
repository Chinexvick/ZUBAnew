// Builds everything the worker needs from its environment and the stake_config table.
import { Wallet } from 'ethers';
import { makeProviders, healthy } from './chain.js';
import { ERC20, firstOk } from './chain.js';
import { assertSafeConfig, tokens, dayMs, MAINNET_CHAIN_ID } from '../lib/core.js';
import { limits } from '../lib/db.js';
import { open, pemFromEnv } from '../lib/seal.js';

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
  const payer = new Wallet(need('payout_key'));
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
    neverSendTo: [token, factory, vault, payer.address, sweeper.address, ...(faucet ? [faucet.address] : [])],
    holders: [...new Set([vault, payer.address, ...list(env.HOLDERS)])],
  };
  const requests = {
    openSecret: (sealed) => open(sealPriv, sealed),
    factory, initCodeHash: need('init_code_hash'),
    forbidden: cfg.neverSendTo,
    adminIds: list(env.ADMIN_IDS), adminSecret: env.ADMIN_TOTP || '',
    testFaucet: null,
  };
  const ctx = { pool, cfg, chainReady, all, payer, sweeper, faucet, requests, testMode, tg: { telegramToken: env.TELEGRAM_TOKEN, telegramChat: env.TELEGRAM_CHAT } };
  ctx.providers = async () => {
    const ok = await healthy(all, chainId);
    if (!ok.length) throw new Error('no chain provider is reachable');
    return ok;
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
  const pub = JSON.stringify({ minStake: L.minStake.toString(), minWithdraw: L.minWithdraw.toString(), autoLimit: L.autoLimit.toString(), userDaily: L.userDaily.toString(), whitelistDelayMs: L.whitelistDelayMs, confirmations: L.confirmations, maxAddresses: L.maxAddresses, dayMs: dayMs(), testMode, faucetAmount: faucet && chainReady ? tokens(env.FAUCET_AMOUNT || 100_000).toString() : null, payout: payer.address });
  if (conf.public !== pub) await pool.query("insert into stake_config (key, value) values ('public', $1) on conflict (key) do update set value = excluded.value", [pub]);
  return ctx;
}
