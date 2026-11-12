// Chain helpers shared by the worker parts.
import { JsonRpcProvider, FetchRequest, Interface, Wallet, id as topicId, zeroPadValue, getAddress } from 'ethers';

export const ERC20 = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 value) returns (bool)',
]);
export const FACTORY = new Interface(['function sweep(bytes32 salt, address token)', 'function predict(bytes32 salt) view returns (address)', 'function vault() view returns (address)']);
export const TRANSFER_TOPIC = topicId('Transfer(address,address,uint256)');
export const topicOf = (addr) => zeroPadValue(addr, 32);

/** Several RPC providers for one chain: reads use the first that answers, and receipts are cross-checked on all. */
export function makeProviders(urls, chainId, timeoutMs = 10_000) {
  return urls.map((u) => {
    const req = new FetchRequest(u.trim());
    req.timeout = timeoutMs;
    return new JsonRpcProvider(req, chainId, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 }); // no caching: a stale nonce or block number is dangerous here
  });
}
/** Keeps only the providers that answer AND are really on our chain (a wrong or hijacked endpoint is dropped). */
export async function healthy(providers, chainId) {
  const ok = [];
  await Promise.all(providers.map(async (p) => {
    try { if (Number(BigInt(await p.send('eth_chainId', []))) === chainId) ok.push(p); } catch { /* down */ }
  }));
  return providers.filter((p) => ok.includes(p)); // keep the configured order
}
export async function firstOk(providers, fn) {
  let last = new Error('no provider available');
  for (const p of providers) {
    try { return await fn(p); } catch (e) { last = e; }
  }
  throw last;
}
/** The newest block the chain itself calls final, or null if the provider cannot say. */
export async function finalizedHead(providers) {
  try { return await firstOk(providers, async (p) => { const b = await p.getBlock('finalized'); if (!b) throw new Error('none'); return b.number; }); } catch { return null; }
}
export const tokenBalance = (providers, token, holder) =>
  firstOk(providers, async (p) => BigInt(await p.call({ to: token, data: ERC20.encodeFunctionData('balanceOf', [holder]) })));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { Wallet, getAddress };
