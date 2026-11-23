// Read-only BNB Smart Chain access. The server never holds a key that can move funds.
import { AbiCoder, getAddress, id as keccakId, verifyMessage } from 'ethers';

export const ZUBA = '0x914f09c21c399837a3694d57260a71a27e9421ae';
export const ZUBA_DECIMALS = 9n;
export const USDT = '0x55d398326f99059ff775485246999027b3197955';
export const WBNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
export const ROUTER = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
export const TREASURY = () => (process.env.TREASURY || '0x60E5EFE6dcf598Ff8ED52B70a80bddaca3C6AFdd').toLowerCase();
const TRANSFER = keccakId('Transfer(address,address,uint256)');
const RPCS = () => (process.env.RPC_URLS || 'https://bsc-dataseed.bnbchain.org,https://bsc-rpc.publicnode.com,https://bsc-dataseed1.defibit.io').split(',').map((s) => s.trim()).filter(Boolean);

let fetchImpl = (...a) => fetch(...a);
export function useFetch(f) {
  fetchImpl = f;
}

async function rpcOne(url, method, params) {
  const r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result;
}

/** Asks two different providers and only accepts an answer they agree on. */
export async function rpc(method, params) {
  const urls = RPCS();
  const answers = [];
  for (const u of urls) {
    try {
      answers.push(JSON.stringify(await rpcOne(u, method, params)));
    } catch {}
    if (answers.length >= 2) break;
  }
  if (answers.length < 2) throw new Error('Not enough blockchain providers answered');
  if (answers[0] !== answers[1]) throw new Error('Blockchain providers disagree');
  return JSON.parse(answers[0]);
}

const coder = AbiCoder.defaultAbiCoder();

/** ZUBA per 1 US dollar from PancakeSwap (USDT → WBNB → ZUBA). */
export async function zubaPerUsdOnChain() {
  const data = '0xd06ca61f' + coder.encode(['uint256', 'address[]'], [10n ** 18n, [USDT, WBNB, ZUBA]]).slice(2);
  const out = await rpc('eth_call', [{ to: ROUTER, data }, 'latest']);
  const [amounts] = coder.decode(['uint256[]'], out);
  return amounts[2]; // ZUBA base units for 1 USDT
}

export async function zubaPerUsdDex() {
  const r = await fetchImpl('https://api.dexscreener.com/latest/dex/tokens/0x914F09c21C399837A3694d57260a71a27E9421aE', { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  const p = (j.pairs || []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  const usd = Number(p?.priceUsd);
  if (!(usd > 0)) throw new Error('no price');
  return BigInt(Math.round((1 / usd) * 1e9)); // base units of ZUBA per dollar
}

let cache = null;
/** Price used for invoices: whichever source gives MORE ZUBA per dollar (the safer side). */
export async function zubaPerUsd() {
  if (cache && Date.now() - cache.at < 60000) return cache.v;
  const results = await Promise.allSettled([zubaPerUsdOnChain(), zubaPerUsdDex()]);
  const vals = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!vals.length) throw new Error('ZUBA price unavailable');
  const v = vals.reduce((a, b) => (b > a ? b : a));
  cache = { v, at: Date.now() };
  return v;
}

/**
 * Checks a payment transaction. Returns { status: 'ok' | 'pending' | 'bad', received, reason }.
 * It must be a successful ZUBA transfer from `from` to the treasury, confirmed, and sent after `notBefore`.
 */
export async function checkPayment(tx, from, notBefore, minConfirmations = 5) {
  const receipt = await rpc('eth_getTransactionReceipt', [tx]);
  if (!receipt) return { status: 'pending', reason: 'Not found on the blockchain yet' };
  if (receipt.status !== '0x1') return { status: 'bad', reason: 'That transaction failed on the blockchain' };
  const head = BigInt(await rpc('eth_blockNumber', []));
  const blockNo = BigInt(receipt.blockNumber);
  if (head - blockNo + 1n < BigInt(minConfirmations)) return { status: 'pending', reason: 'Waiting for confirmations' };
  const block = await rpc('eth_getBlockByNumber', [receipt.blockNumber, false]);
  const when = Number(BigInt(block.timestamp)) * 1000;
  if (when < notBefore - 120000) return { status: 'bad', reason: 'That payment was made before this order' };
  const pad = (a) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');
  let received = 0n;
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== ZUBA) continue;
    if (log.topics?.[0] !== TRANSFER || log.topics.length !== 3) continue;
    if (log.topics[1].toLowerCase() !== pad(from) || log.topics[2].toLowerCase() !== pad(TREASURY())) continue;
    received += BigInt(log.data);
  }
  if (received === 0n) return { status: 'bad', reason: 'No ZUBA payment from your wallet to AfriT Hub in that transaction' };
  return { status: 'ok', received, when };
}

/** Recovers the signer of a wallet-link message. */
export function signerOf(message, signature) {
  try {
    return getAddress(verifyMessage(message, signature)).toLowerCase();
  } catch {
    return null;
  }
}
