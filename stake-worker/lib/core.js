// ZUBA staking: the pure rules (no database, no network). Every amount is a BigInt in the token's smallest unit.
import crypto from 'node:crypto';
import { keccak_256 } from '@noble/hashes/sha3.js';

export const DECIMALS = Number(process.env.STAKE_DECIMALS || 9);
export const UNIT = 10n ** BigInt(DECIMALS);
export const tokens = (n) => BigInt(n) * UNIT; // whole tokens -> base units

// ---- the reward budget: 5,000,000,000 ZUBA over one year (365 days), nothing more, ever ----------
// One entry per program year. The program ends when the list ends; extending it is a deliberate code change.
export const YEAR_POOLS = [5_000_000_000n].map(tokens);
export const TOTAL_BUDGET = YEAR_POOLS.reduce((a, b) => a + b, 0n); // 5B exactly
export const DAYS_PER_YEAR = 365;
export const PROGRAM_DAYS = DAYS_PER_YEAR * YEAR_POOLS.length;

/**
 * How long one program "day" lasts. Always 24 hours on the real network.
 * A test network may shorten it (STAKE_DAY_MS) so that rewards and locks can be watched in minutes;
 * assertSafeConfig() refuses to start with a shortened day on the real chain.
 */
export const REAL_DAY_MS = 86_400_000;
export const dayMs = () => Number(process.env.STAKE_DAY_MS || REAL_DAY_MS);
export const MAINNET_CHAIN_ID = 56;
export function assertSafeConfig(chainId) {
  if (!Number.isInteger(chainId) || chainId <= 0) throw new Error('chain id missing');
  const d = dayMs();
  if (!Number.isFinite(d) || d < 1000) throw new Error('STAKE_DAY_MS is not valid');
  if (chainId === MAINNET_CHAIN_ID) {
    if (d !== REAL_DAY_MS) throw new Error('a shortened day is not allowed on the real network');
    if (process.env.STAKE_TEST_MODE === '1') throw new Error('test mode is not allowed on the real network');
  }
}

/** What may be paid out in total on program day `day` (0 = the launch day). Rounds down, so it can never overspend. */
export function dailyPool(day) {
  if (!Number.isInteger(day) || day < 0 || day >= PROGRAM_DAYS) return 0n;
  return YEAR_POOLS[Math.floor(day / DAYS_PER_YEAR)] / BigInt(DAYS_PER_YEAR);
}

// ---- lock options: longer lock = bigger share of the day's pool --------------------------------------
export const LOCKS = { 0: 10000n, 30: 12500n, 90: 15000n, 180: 20000n }; // weight in basis points
export const MAX_APY_BP = BigInt(process.env.STAKE_MAX_APY_BP || 4000); // the longest lock never earns more than 40% a year
export const TOP_WEIGHT = 20000n; // the weight of the longest lock
/** The yearly ceiling of a lock, in basis points: 40% for the longest lock, less for the others in step with their weight
 *  (flexible 20%, 30 days 25%, 90 days 30%, 180 days 40%). So a fixed stake always earns more than a flexible one. */
export const capBp = (weightBp, maxApyBp = MAX_APY_BP) => (maxApyBp * BigInt(weightBp)) / TOP_WEIGHT;
export const lockWeight = (days) => LOCKS[days] ?? null;

/**
 * One day's rewards. `positions` = [{ id, amount, weightBp }].
 * Each gets pool * (amount*weight) / (sum of amount*weight), rounded down, and never more than its lock's yearly cap / 365.
 * Returns a Map id -> reward. The sum is always <= pool.
 */
export function dayRewards(positions, pool, maxApyBp = MAX_APY_BP) {
  const out = new Map();
  let total = 0n;
  for (const p of positions) total += p.amount * p.weightBp;
  if (total === 0n || pool <= 0n) return out;
  for (const p of positions) {
    const share = (pool * p.amount * p.weightBp) / total;
    const cap = (p.amount * capBp(p.weightBp, maxApyBp)) / 10000n / BigInt(DAYS_PER_YEAR);
    const r = share < cap ? share : cap;
    if (r > 0n) out.set(p.id, r);
  }
  return out;
}

/** Estimated yearly return in % for a lock, if the pool of `day` is shared by `totalWeighted` (sum of amount * weightBp). */
export function estimateApy(day, totalWeighted, weightBp) {
  const top = capBp(weightBp);
  if (dailyPool(day) <= 0n) return 0;
  if (totalWeighted <= 0n) return Number(top) / 100;
  const yearly = (dailyPool(day) * weightBp * BigInt(DAYS_PER_YEAR) * 10000n) / totalWeighted; // basis points, rounded down
  const capped = yearly > top ? top : yearly;
  return Number(capped) / 100;
}

// ---- amounts as text ----------------------------------------------------------------------------------
export function parseAmount(s, decimals = DECIMALS) {
  if (typeof s !== 'string' || !/^\d{1,30}(\.\d{1,18})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  if (f.length > decimals) return null;
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt(f.padEnd(decimals, '0') || '0');
}
export function formatAmount(v, decimals = DECIMALS) {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const w = a / 10n ** BigInt(decimals);
  const f = (a % 10n ** BigInt(decimals)).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + w.toString() + (f ? '.' + f : '');
}

// ---- addresses ----------------------------------------------------------------------------------------
const hex = (u8) => Buffer.from(u8).toString('hex');
export function toChecksum(addr) {
  const a = addr.toLowerCase().replace(/^0x/, '');
  const h = hex(keccak_256(Buffer.from(a, 'ascii')));
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? a[i].toUpperCase() : a[i];
  return out;
}
/** A well-formed EVM address (all-lowercase, all-uppercase, or a correct checksum); returns the checksummed form or null. */
export function cleanAddress(s) {
  if (typeof s !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(s)) return null;
  const body = s.slice(2);
  const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
  const cs = toChecksum(s);
  if (mixed && cs !== s) return null; // a typo in a mixed-case address
  if (/^0x0{40}$/.test(s) || /^0x0{36}dead$/i.test(s)) return null; // burn addresses: tokens sent there are gone for good
  return cs;
}

/** Each user's deposit address: an address with no private key, known before anything is deployed on-chain. */
export const userSalt = (userId) => '0x' + hex(keccak_256(Buffer.from(`zuba-stake:v1:${userId}`, 'utf8')));
export function create2Address(factory, salt, initCodeHash) {
  const b = Buffer.concat([Buffer.from('ff', 'hex'), Buffer.from(factory.slice(2), 'hex'), Buffer.from(salt.slice(2), 'hex'), Buffer.from(initCodeHash.slice(2), 'hex')]);
  return toChecksum('0x' + hex(keccak_256(b)).slice(-40));
}
export const depositAddress = (userId, factory, initCodeHash) => create2Address(factory, userSalt(userId), initCodeHash);

// ---- 2FA (RFC 6238, authenticator apps) -------------------------------------------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret() {
  const b = crypto.randomBytes(20);
  let bits = '', out = '';
  for (const x of b) bits += x.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function b32bytes(s) {
  let bits = '';
  for (const c of s.replace(/=+$/, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
export const totpStep = (now = Date.now()) => Math.floor(now / 30000);
export function totpCode(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', b32bytes(secret)).update(msg).digest();
  const o = h[19] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}
/** Returns the step that matched (so the caller can refuse a second use of the same code), or null. */
export function totpCheck(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return null;
  const s = totpStep(now);
  for (const d of [0, -1, 1]) {
    const want = Buffer.from(totpCode(secret, s + d)), got = Buffer.from(String(code));
    if (crypto.timingSafeEqual(want, got)) return s + d;
  }
  return null;
}
export const isTotpSecret = (s) => typeof s === 'string' && /^[A-Z2-7]{32}$/.test(s);
