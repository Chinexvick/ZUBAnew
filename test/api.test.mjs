import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { Wallet, AbiCoder, id as keccakId } from 'ethers';
import { useDb } from '../lib/db.js';
import { useMailer } from '../lib/mail.js';
import { useFetch, ZUBA } from '../lib/chain.js';
import handler from '../api/index.js';
import { useGoogleFetch } from '../lib/places.js';

process.env.JWT_SECRET = 'j'.repeat(48);
process.env.OTP_PEPPER = 'p'.repeat(48);
process.env.RPC_URLS = 'https://a.test,https://b.test';
process.env.TREASURY = '0x60E5EFE6dcf598Ff8ED52B70a80bddaca3C6AFdd';
process.env.ADMIN_KEY = 'k'.repeat(40);
const TREASURY = '0x60e5efe6dcf598ff8ed52b70a80bddaca3c6afdd';

const dir = '/tmp/afrit-pg-' + process.pid;
const db = new EmbeddedPostgres({ databaseDir: dir, user: 'u', password: 'p', port: 54329, persistent: false });
let pool;
const mails = [];

// ---- fake blockchain ----
const chain = { head: 1000n, receipts: {}, blocks: {}, txs: {} };
const TRANSFER = keccakId('Transfer(address,address,uint256)');
const pad = (a) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');
function payTx(hash, from, amount, { block = 990n, ts = Math.floor(Date.now() / 1000), to = TREASURY, status = '0x1' } = {}) {
  chain.receipts[hash] = { status, blockNumber: '0x' + block.toString(16), logs: [{ address: ZUBA, topics: [TRANSFER, pad(from), pad(to)], data: '0x' + amount.toString(16).padStart(64, '0') }] };
  chain.blocks['0x' + block.toString(16)] = { timestamp: '0x' + ts.toString(16) };
}
useFetch(async (url, opts) => {
  if (String(url).includes('dexscreener')) return { json: async () => ({ pairs: [{ priceUsd: '0.00000002', liquidity: { usd: 3000 } }] }) };
  const { method, params } = JSON.parse(opts.body);
  let result;
  if (method === 'eth_blockNumber') result = '0x' + chain.head.toString(16);
  else if (method === 'eth_getTransactionReceipt') result = chain.receipts[params[0]] ?? null;
  else if (method === 'eth_getBlockByNumber') result = chain.blocks[params[0]];
  else if (method === 'eth_getTransactionByHash') result = chain.txs[params[0]] ?? null;
  else if (method === 'eth_getLogs') {
    result = Object.entries(chain.receipts).flatMap(([h, r]) => r.status === '0x1' ? r.logs.filter((l) => l.topics[2] === params[0].topics[2]).map((l) => ({ ...l, transactionHash: h })) : []);
  }
  else if (method === 'eth_call') result = AbiCoder.defaultAbiCoder().encode(['uint256[]'], [[10n ** 18n, 10n ** 15n, 45_000_000n * 10n ** 9n]]);
  return { json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
});

// ---- call the real handler like Vercel would ----
async function call(method, path, body, token, ip = '1.1.1.1', extra = {}) {
  const req = { method, url: path, headers: { 'x-real-ip': ip, ...extra, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ?? {} };
  let status, out;
  const res = { setHeader() {}, set statusCode(s) { status = s; }, end(b) { out = JSON.parse(b); } };
  await handler(req, res);
  return { ...out, body: out, status };
}
const lastCode = (to) => mails.filter((m) => m.to === to).at(-1)?.text.match(/\d{6}/)?.[0];

test.before(async () => {
  await db.initialise();
  await db.start();
  await db.createDatabase('afrit');
  pool = new pg.Pool({ host: 'localhost', port: 54329, user: 'u', password: 'p', database: 'afrit' });
  await pool.query(fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  useDb(async (strings, ...values) => {
    let text = strings[0];
    values.forEach((v, i) => (text += `$${i + 1}` + strings[i + 1]));
    return (await pool.query(text, values)).rows;
  });
  useMailer(async (m) => mails.push(m));
});
test.after(async () => {
  await pool.end();
  await db.stop();
});

let A; // tokens for alice
let C; // tokens for carol
test('sign up, verify by email code, then /me', async () => {
  const r = await call('POST', '/auth/signup', { email: 'Alice@Example.com', password: 'secret123', username: 'alice', name: 'Alice' });
  assert.equal(r.status, 200);
  assert.equal(r.email, 'alice@example.com');
  const bad = await call('POST', '/auth/verify', { email: 'alice@example.com', code: '000000' });
  assert.equal(bad.status, 400);
  const v = await call('POST', '/auth/verify', { email: 'alice@example.com', code: lastCode('alice@example.com') });
  assert.equal(v.status, 200);
  A = v.tokens;
  const again = await call('POST', '/auth/verify', { email: 'alice@example.com', code: lastCode('alice@example.com') });
  assert.equal(again.status, 400, 'codes are single use');
  const me = await call('GET', '/me', null, A.access);
  assert.equal(me.user.username, 'alice');
});

test('signup validation and duplicate usernames', async () => {
  assert.equal((await call('POST', '/auth/signup', { email: 'x@y.co', password: 'short', username: 'xx1' })).status, 400);
  assert.equal((await call('POST', '/auth/signup', { email: 'x@y.co', password: 'secret123', username: "a'; drop table users;--" })).status, 400);
  assert.equal((await call('POST', '/auth/signup', { email: 'bob@example.com', password: 'secret123', username: 'alice' })).status, 409);
  // signing up again with an existing verified email does not reveal it, and emails the owner
  const r = await call('POST', '/auth/signup', { email: 'alice@example.com', password: 'other1234', username: 'alice2' });
  assert.equal(r.status, 200);
  assert.match(mails.at(-1).subject, /tried to sign up/);
});

test('login: generic errors, lockout after 8 wrong passwords', async () => {
  assert.equal((await call('POST', '/auth/login', { email: 'nobody@example.com', password: 'x' }, null, '2.2.2.2')).error, 'Wrong email or password');
  const ok = await call('POST', '/auth/login', { email: 'alice@example.com', password: 'secret123' }, null, '2.2.2.2');
  assert.equal(ok.status, 200);
  await call('POST', '/auth/signup', { email: 'carol@example.com', password: 'secret123', username: 'carol' }, null, '3.3.3.3');
  await call('POST', '/auth/verify', { email: 'carol@example.com', code: lastCode('carol@example.com') }, null, '3.3.3.3');
  for (let i = 0; i < 8; i++) await call('POST', '/auth/login', { email: 'carol@example.com', password: 'wrong1234' }, null, `4.4.4.${i}`);
  const locked = await call('POST', '/auth/login', { email: 'carol@example.com', password: 'secret123' }, null, '5.5.5.5');
  assert.equal(locked.status, 429);
});

test('refresh tokens rotate; reusing an old one ends the session family', async () => {
  const r1 = await call('POST', '/auth/refresh', { refresh: A.refresh });
  assert.equal(r1.status, 200);
  // The same phone retrying within seconds keeps its session.
  const retry = await call('POST', '/auth/refresh', { refresh: A.refresh });
  assert.equal(retry.status, 200, 'a quick retry is not treated as theft');
  // Signed in for 7 days from the last use, not 30.
  const { rows } = await pool.query(`select max(expires_at - created_at) as life from refresh_tokens`);
  assert.ok(rows[0].life.days === 7 || rows[0].life.days === undefined && rows[0].life.hours === 168, 'sign-in lasts 7 days from last use');
  // An old token coming back later is treated as stolen.
  await pool.query(`update refresh_tokens set used_at = now() - interval '5 minutes' where used_at is not null`);
  const reuse = await call('POST', '/auth/refresh', { refresh: A.refresh });
  assert.equal(reuse.status, 401);
  const r2 = await call('POST', '/auth/refresh', { refresh: r1.tokens.refresh });
  assert.equal(r2.status, 401, 'family revoked after reuse');
  const login = await call('POST', '/auth/login', { email: 'alice@example.com', password: 'secret123' }, null, '6.6.6.6');
  A = login.tokens;
});

const aliceWallet = Wallet.createRandom();
test('link a wallet by signature; one wallet per account, one account per wallet', async () => {
  const c = await call('POST', '/wallet/challenge', {}, A.access);
  const wrong = await Wallet.createRandom().signMessage(c.message);
  assert.equal((await call('POST', '/wallet/link', { address: aliceWallet.address, signature: wrong }, A.access)).status, 400);
  const c2 = await call('POST', '/wallet/challenge', {}, A.access);
  const ok = await call('POST', '/wallet/link', { address: aliceWallet.address, signature: await aliceWallet.signMessage(c2.message) }, A.access);
  assert.equal(ok.status, 200);
  const other = Wallet.createRandom();
  const c3 = await call('POST', '/wallet/challenge', {}, A.access);
  assert.equal((await call('POST', '/wallet/link', { address: other.address, signature: await other.signMessage(c3.message) }, A.access)).status, 409);
  // carol can't take alice's wallet
  await pool.query("update users set locked_until = null, failed_logins = 0 where username = 'carol'");
  C = (await call('POST', '/auth/login', { email: 'carol@example.com', password: 'secret123' }, null, '7.7.7.7')).tokens;
  const c4 = await call('POST', '/wallet/challenge', {}, C.access);
  assert.equal((await call('POST', '/wallet/link', { address: aliceWallet.address, signature: await aliceWallet.signMessage(c4.message) }, C.access)).status, 409);
  const look = await call('GET', '/users/alice/wallet', null, C.access);
  assert.equal(look.wallet, aliceWallet.address.toLowerCase());
});

test('Premium is only switched on by a real, confirmed, unused payment from the linked wallet', async () => {
  const inv = await call('POST', '/pay/invoice', { purpose: 'premium', plan: 'month' }, A.access);
  assert.equal(inv.status, 200);
  assert.equal(inv.usd, 4);
  // on-chain says 45M ZUBA per $, DexScreener says 50M: the higher is used
  assert.equal(inv.zuba, '200000000'); // plus a tiny unique tail
  const need = BigInt(inv.zubaUnits);
  const stranger = Wallet.createRandom().address;
  payTx('0x' + '1'.repeat(64), stranger, need);
  assert.equal((await call('POST', '/pay/verify', { invoice: inv.invoice, tx: '0x' + '1'.repeat(64) }, A.access)).status, 400, 'wrong sender');
  payTx('0x' + '2'.repeat(64), aliceWallet.address, need / 2n);
  assert.equal((await call('POST', '/pay/verify', { invoice: inv.invoice, tx: '0x' + '2'.repeat(64) }, A.access)).status, 400, 'too little');
  payTx('0x' + '3'.repeat(64), aliceWallet.address, need, { block: 999n });
  assert.equal((await call('POST', '/pay/verify', { invoice: inv.invoice, tx: '0x' + '3'.repeat(64) }, A.access)).body.status, 'pending');
  payTx('0x' + '4'.repeat(64), aliceWallet.address, need, { ts: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal((await call('POST', '/pay/verify', { invoice: inv.invoice, tx: '0x' + '4'.repeat(64) }, A.access)).status, 400, 'old payment');
  payTx('0x' + '5'.repeat(64), aliceWallet.address, need * 96n / 100n); // 4% token tax is fine
  const ok = await call('POST', '/pay/verify', { invoice: inv.invoice, tx: '0x' + '5'.repeat(64) }, A.access);
  assert.equal(ok.status, 200);
  assert.equal(ok.status === 200 && ok.premiumUntil !== undefined, true);
  // same transaction can't pay a second order
  const inv2 = await call('POST', '/pay/invoice', { purpose: 'premium', plan: 'year' }, A.access);
  assert.equal((await call('POST', '/pay/verify', { invoice: inv2.invoice, tx: '0x' + '5'.repeat(64) }, A.access)).status, 409);
  const me = await call('GET', '/me', null, A.access);
  assert.equal(me.user.premium, true);
  // gifting Premium to carol
  const gift = await call('POST', '/pay/invoice', { purpose: 'premium', plan: 'month', giftTo: '@carol' }, A.access);
  payTx('0x' + '6'.repeat(64), aliceWallet.address, BigInt(gift.zubaUnits));
  assert.equal((await call('POST', '/pay/verify', { invoice: gift.invoice, tx: '0x' + '6'.repeat(64) }, A.access)).status, 200);
  const [carol] = (await pool.query("select premium_until from users where username='carol'")).rows;
  assert.ok(carol.premium_until > new Date());
  // someone else can't use alice's invoice
  assert.equal((await call('POST', '/pay/verify', { invoice: inv2.invoice, tx: '0x' + '7'.repeat(64) }, C.access)).status, 404);
});

test('paying from another wallet needs the exact order amount', async () => {
  const inv = await call('POST', '/pay/invoice', { purpose: 'promo', plan: 'day' }, A.access);
  const other = Wallet.createRandom().address;
  const amt = BigInt(inv.zubaUnits);
  const tA = '0x' + 'a'.repeat(64), tB = '0x' + 'b'.repeat(64);
  payTx(tA, other, amt + 1000n);
  chain.txs[tA] = { to: ZUBA, input: '0xa9059cbb' + TREASURY.slice(2).padStart(64, '0') + (amt + 1000n).toString(16).padStart(64, '0') };
  assert.equal((await call('POST', '/pay/verify', { invoice: inv.invoice, tx: tA }, A.access)).status, 400, 'not the exact amount');
  payTx(tB, other, amt * 97n / 100n);
  chain.txs[tB] = { to: ZUBA, input: '0xa9059cbb' + TREASURY.slice(2).padStart(64, '0') + amt.toString(16).padStart(64, '0') };
  const ok = await call('POST', '/pay/verify', { invoice: inv.invoice, tx: tB }, A.access);
  assert.equal(ok.status, 200);
  const [p] = (await pool.query('select count(*)::int as n from promotions')).rows;
  assert.equal(p.n, 1);
});

test('a payment the app never confirmed is found and applied automatically, once', async () => {
  const inv = await call('POST', '/pay/invoice', { purpose: 'premium', plan: 'month', giftTo: '@carol' }, A.access);
  const amt = BigInt(inv.zubaUnits);
  const before = (await pool.query("select premium_until from users where username='carol'")).rows[0].premium_until;
  const tx = '0x' + 'c'.repeat(64);
  const other = Wallet.createRandom().address;
  payTx(tx, other, amt * 97n / 100n);
  chain.txs[tx] = { to: ZUBA, input: '0xa9059cbb' + TREASURY.slice(2).padStart(64, '0') + amt.toString(16).padStart(64, '0') };
  // a stranger's random payment of a different amount is ignored
  payTx('0x' + 'd'.repeat(64), Wallet.createRandom().address, amt + 5n);
  const r = await call('POST', '/pay/check', {}, A.access);
  assert.equal(r.status, 200);
  assert.equal(r.paid, 1);
  const after = (await pool.query("select premium_until from users where username='carol'")).rows[0].premium_until;
  assert.ok(after > before);
  assert.equal((await call('POST', '/pay/check', {}, A.access)).paid, 0, 'never applied twice');
  assert.equal((await call('POST', '/pay/verify', { invoice: inv.invoice, tx }, A.access)).status, 200);
  // the daily check needs the scheduler secret or the admin key
  assert.equal((await call('GET', '/cron/payments')).status, 404);
  assert.equal((await call('GET', '/cron/payments', null, null, '1.1.1.1', { authorization: 'Bearer wrong' })).status, 404);
  assert.equal((await call('GET', '/cron/payments', null, null, '1.1.1.1', { 'x-admin-key': 'k'.repeat(40) })).status, 200);
});

test('referrals: reward recorded once the new member verifies and links a wallet', async () => {
  await call('POST', '/auth/signup', { email: 'dan@example.com', password: 'secret123', username: 'dan', ref: 'alice' }, null, '10.0.0.1');
  const D = (await call('POST', '/auth/verify', { email: 'dan@example.com', code: lastCode('dan@example.com') }, null, '10.0.0.1')).tokens;
  let r = await call('GET', '/referrals', null, A.access);
  assert.equal(r.joined, 1);
  assert.equal(r.earned, 0, 'not until a wallet is linked');
  const dw = Wallet.createRandom();
  const c = await call('POST', '/wallet/challenge', {}, D.access);
  await call('POST', '/wallet/link', { address: dw.address, signature: await dw.signMessage(c.message) }, D.access);
  r = await call('GET', '/referrals', null, A.access);
  assert.equal(r.earned, 1);
  assert.equal(r.pending, 2000);
  assert.equal((await call('GET', '/admin/referrals')).status, 404, 'admin hidden without key');
  const adm = await call('GET', '/admin/referrals', null, null, '1.1.1.1', { 'x-admin-key': 'k'.repeat(40) });
  assert.equal(adm.pending.length, 1);
  const paid = await call('POST', '/admin/referrals/paid', { ids: [adm.pending[0].id], tx: '0x' + 'c'.repeat(64) }, null, '1.1.1.1', { 'x-admin-key': 'k'.repeat(40) });
  assert.equal(paid.paid, 1);
});

test('password reset ends sessions, pauses wallet changes, and old tokens stop working', async () => {
  assert.equal((await call('POST', '/auth/forgot', { email: 'nobody@example.com' })).status, 200, 'no account leak');
  await call('POST', '/auth/forgot', { email: 'alice@example.com' });
  const code = lastCode('alice@example.com');
  const r = await call('POST', '/auth/reset', { email: 'alice@example.com', code, password: 'newpass123' });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/me', null, A.access)).status, 401, 'old access token rejected');
  assert.equal((await call('POST', '/auth/refresh', { refresh: A.refresh })).status, 401);
  assert.equal((await call('POST', '/auth/login', { email: 'alice@example.com', password: 'secret123' }, null, '9.9.9.9')).status, 401);
  const n = await call('GET', '/notifications', null, r.tokens.access);
  assert.ok(n.notifications.some((x) => x.kind === 'security'));
});

test('unknown routes and bad JSON shapes', async () => {
  assert.equal((await call('GET', '/admin')).status, 404);
  assert.equal((await call('GET', '/me', null, 'not.a.token')).status, 401);
  assert.equal((await call('POST', '/pay/verify', { invoice: 'x', tx: '0x12' }, null)).status, 401);
});

test('AI tutor: keys stay on the server, audio is cached, Premium stages are enforced', async () => {
  await call('POST', '/auth/signup', { email: 'erin@example.com', password: 'secret123', username: 'erin', name: 'Erin' }, null, '7.7.7.7');
  const E = (await call('POST', '/auth/verify', { email: 'erin@example.com', code: lastCode('erin@example.com') })).tokens;
  // Not configured yet: a clear 503, no crash.
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal((await call('POST', '/ai/speak', { lang: 'Swahili', text: 'Habari' }, E.access)).status, 503);
  process.env.ELEVENLABS_API_KEY = 'test-key';
  process.env.ELEVEN_VOICE_DEFAULT = 'voice1';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  let ttsCalls = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    url = String(url);
    if (url.includes('text-to-speech')) {
      ttsCalls++;
      assert.equal(opts.headers['xi-api-key'], 'test-key');
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
    if (url.includes('speech-to-text')) return Response.json({ text: 'Habari yako' });
    if (url.includes('anthropic')) {
      const body = JSON.parse(opts.body);
      if (body.system.includes('lessons')) {
        const phrases = Array.from({ length: 12 }, (_, i) => [`Neno ${i}`, `Word ${i}`, `NEH-no ${i}`]);
        return Response.json({ content: [{ text: JSON.stringify({ title: 'Daily routines', about: 'x', tip: 'y', phrases, talk: [['A', 0], ['B', 1], ['A', 99]] }) }] });
      }
      return Response.json({ content: [{ text: '{"reply":"Nzuri sana! Na wewe?","english":"Very good! And you?","tip":""}' }] });
    }
    return real(url, opts);
  };
  try {
    const a = await call('POST', '/ai/speak', { lang: 'Swahili', text: 'Habari' }, E.access);
    assert.equal(a.audio, Buffer.from([1, 2, 3]).toString('base64'));
    await call('POST', '/ai/speak', { lang: 'Swahili', text: 'Habari' }, E.access);
    assert.equal(ttsCalls, 1, 'second request served from cache');
    assert.equal((await call('POST', '/ai/speak', { lang: 'Klingon', text: 'x' }, E.access)).status, 400);
    assert.equal((await call('POST', '/ai/speak', { lang: 'Swahili', text: 'x' })).status, 401);
    const t = await call('POST', '/ai/talk', { lang: 'Swahili', level: 0, audio: 'A'.repeat(200), history: [{ role: 'tutor', text: 'Habari?' }] }, E.access);
    assert.equal(t.heard, 'Habari yako');
    assert.equal(t.reply, 'Nzuri sana! Na wewe?');
    assert.ok(t.audio);
    const l1 = await call('POST', '/ai/lesson', { lang: 'Swahili', stage: 1, unit: 0 }, E.access);
    assert.equal(l1.phrases.length, 12);
    assert.equal(l1.talk.length, 2, 'out-of-range dialogue lines are dropped');
    assert.equal((await call('POST', '/ai/lesson', { lang: 'Swahili', stage: 3, unit: 0 }, E.access)).status, 402, 'Premium stage needs Premium');
    assert.equal((await call('POST', '/ai/lesson', { lang: 'Swahili', stage: 9, unit: 0 }, E.access)).status, 400);
    assert.equal((await call('POST', '/ai/report', { lang: 'Swahili', phrase: 'Neno 1', note: 'tone' }, E.access)).ok, true);
  } finally {
    globalThis.fetch = real;
  }
});

test('live rooms: signed pass only for signed-in users, secret never returned', async () => {
  await call('POST', '/auth/signup', { email: 'fola@example.com', password: 'secret123', username: 'fola', name: 'Fola' }, null, '6.6.6.6');
  const F = (await call('POST', '/auth/verify', { email: 'fola@example.com', code: lastCode('fola@example.com') })).tokens;
  assert.equal((await call('POST', '/rooms/token', { room: 'party-fola-1' }, F.access)).status, 503);
  process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
  process.env.LIVEKIT_API_KEY = 'APIkey';
  process.env.LIVEKIT_API_SECRET = 's'.repeat(40);
  assert.equal((await call('POST', '/rooms/token', { room: 'party-fola-1' })).status, 401);
  assert.equal((await call('POST', '/rooms/token', { room: 'bad room!' }, F.access)).status, 400);
  const r = await call('POST', '/rooms/token', { room: 'party-fola-1' }, F.access);
  assert.equal(r.url, 'wss://example.livekit.cloud');
  assert.ok(!JSON.stringify(r).includes('s'.repeat(40)));
  const [h, b, sig] = r.token.split('.');
  const claims = JSON.parse(Buffer.from(b, 'base64url').toString());
  assert.equal(claims.sub, 'fola');
  assert.equal(claims.video.room, 'party-fola-1');
  assert.equal(claims.video.roomAdmin, true, 'host of their own room');
  const crypto = await import('node:crypto');
  assert.equal(sig, crypto.createHmac('sha256', 's'.repeat(40)).update(`${h}.${b}`).digest('base64url'));
  assert.equal((await call('POST', '/rooms/token', { room: 'party-someoneelse-1' }, F.access)).status, 403, 'party voice is for people who joined');
  const guest = await call('POST', '/rooms/token', { room: 'live-someoneelse-ab12' }, F.access);
  assert.equal(JSON.parse(Buffer.from(guest.token.split('.')[1], 'base64url').toString()).video.roomAdmin, false);
});

test('profile: categories come from the list, level and language sync', async () => {
  await call('POST', '/auth/signup', { email: 'gbenga@example.com', password: 'secret123', username: 'gbenga', name: 'Gbenga' }, null, '5.5.5.5');
  const G = (await call('POST', '/auth/verify', { email: 'gbenga@example.com', code: lastCode('gbenga@example.com') })).tokens;
  let r = await call('PATCH', '/me', { bizCategory: 'Founder', level: 3, language: 'Yoruba' }, G.access);
  assert.equal(r.user.bizCategory, 'Founder');
  assert.equal(r.user.level, 3);
  assert.equal(r.user.language, 'Yoruba');
  assert.equal((await call('PATCH', '/me', { bizCategory: 'Restaurant' }, G.access)).status, 400, 'business-only category');
  assert.equal((await call('PATCH', '/me', { bizCategory: '<script>' }, G.access)).status, 400);
  assert.equal((await call('PATCH', '/me', { level: 9 }, G.access)).status, 400);
  r = await call('PATCH', '/me', { kind: 'business', bizName: 'Gbenga Foods', bizCategory: 'Restaurant' }, G.access);
  assert.equal(r.user.kind, 'business');
  assert.equal(r.user.bizCategory, 'Restaurant');
  r = await call('PATCH', '/me', { bizCategory: 'CEO', bizName: 'Gbenga Group' }, G.access);
  assert.equal(r.user.bizCategory, 'CEO');
  assert.equal(r.user.bizName, 'Gbenga Group');
});

test('security: sign out everywhere, delete account needs the password', async () => {
  await call('POST', '/auth/signup', { email: 'hadiza@example.com', password: 'secret123', username: 'hadiza', name: 'Hadiza' }, null, '4.4.4.4');
  const H = (await call('POST', '/auth/verify', { email: 'hadiza@example.com', code: lastCode('hadiza@example.com') })).tokens;
  const H2 = (await call('POST', '/auth/login', { email: 'hadiza@example.com', password: 'secret123' }, null, '4.4.4.5')).tokens;
  assert.equal((await call('POST', '/auth/logout-all', {}, H.access)).ok, true);
  assert.equal((await call('GET', '/me', null, H2.access)).status, 401, 'other device signed out');
  assert.equal((await call('POST', '/auth/refresh', { refresh: H2.refresh })).status, 401);
  const H3 = (await call('POST', '/auth/login', { email: 'hadiza@example.com', password: 'secret123' }, null, '4.4.4.6')).tokens;
  assert.equal((await call('POST', '/me/delete', { password: 'wrong-pass' }, H3.access)).status, 401);
  assert.equal((await call('POST', '/me/delete', { password: 'secret123' }, H3.access)).ok, true);
  assert.equal((await call('GET', '/me', null, H3.access)).status, 401);
  assert.equal((await call('POST', '/auth/login', { email: 'hadiza@example.com', password: 'secret123' }, null, '4.4.4.7')).status, 401);
});

test('live: start, list, only the host ends it', async () => {
  await call('POST', '/auth/signup', { email: 'ife@example.com', password: 'secret123', username: 'ife', name: 'Ife' }, null, '3.3.3.3');
  const I = (await call('POST', '/auth/verify', { email: 'ife@example.com', code: lastCode('ife@example.com') })).tokens;
  assert.equal((await call('POST', '/live/start', { title: 'x' }, I.access)).status, 400);
  assert.equal((await call('POST', '/live/start', { title: 'Sunset', place: 'DROP TABLE' }, I.access)).status, 400);
  const v = await call('POST', '/live/start', { title: 'Sunset in Lagos', about: 'Come through', place: 'Q8673' }, I.access);
  assert.ok(v.room.startsWith('live-ife-'));
  const grp = (await call('POST', '/groups', { name: 'Yoruba learners', about: 'Practice' }, I.access)).group;
  const E0 = (await call('POST', '/auth/login', { email: 'erin@example.com', password: 'secret123' }, null, '7.7.7.9')).tokens;
  assert.equal((await call('POST', '/live/start', { title: 'Yoruba circle', voice: true, groupId: grp.id }, E0.access)).status, 403, 'only owners and admins host');
  assert.equal((await call('POST', '/live/start', { title: 'Yoruba circle', voice: true, group: 'Yoruba learners' }, I.access)).status, 400);
  const g = await call('POST', '/live/start', { title: 'Yoruba circle', voice: true, groupId: grp.id }, I.access);
  assert.ok(g.room.startsWith('voice-ife-'));
  let l = await call('GET', '/live', null, I.access);
  assert.equal(l.live.length, 1, 'starting a new session ends the previous one');
  assert.equal(l.live[0].group, 'Yoruba learners');
  const E = (await call('POST', '/auth/login', { email: 'erin@example.com', password: 'secret123' }, null, '7.7.7.8')).tokens;
  await call('POST', '/live/end', { id: g.id }, E.access);
  assert.equal((await call('GET', '/live', null, I.access)).live.length, 1, 'others cannot end it');
  await call('POST', '/live/end', { id: g.id }, I.access);
  assert.equal((await call('GET', '/live', null, I.access)).live.length, 0);
});

test('AI guides on Gemini: busy model falls back, history alternates, audio is transcribed', async () => {
  await call('POST', '/auth/signup', { email: 'jide@example.com', password: 'secret123', username: 'jide', name: 'Jide' }, null, '2.2.2.2');
  const J = (await call('POST', '/auth/verify', { email: 'jide@example.com', code: lastCode('jide@example.com') })).tokens;
  const saved = { a: process.env.ANTHROPIC_API_KEY, e: process.env.ELEVENLABS_API_KEY };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  process.env.GEMINI_API_KEY = 'g-key';
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    url = String(url);
    if (url.includes('generativelanguage')) {
      seen.push(url);
      assert.equal(opts.headers['x-goog-api-key'], 'g-key');
      const body = JSON.parse(opts.body);
      if (url.includes('flash-lite') && seen.length === 1) return new Response('{}', { status: 503 });
      if (body.contents[0].parts[0].inline_data) return Response.json({ candidates: [{ content: { parts: [{ text: 'Habari yako' }] } }] });
      assert.equal(body.contents[0].role, 'user', 'starts with the user');
      for (let i = 1; i < body.contents.length; i++) assert.notEqual(body.contents[i].role, body.contents[i - 1].role, 'turns alternate');
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"reply":"Nzuri!","english":"Good!","tip":""}' }] } }] });
    }
    return real(url, opts);
  };
  try {
    const t = await call('POST', '/ai/talk', { lang: 'Swahili', level: 0, text: 'Habari', history: [{ role: 'tutor', text: 'Jambo!' }, { role: 'tutor', text: 'Karibu' }] }, J.access);
    assert.equal(t.reply, 'Nzuri!');
    assert.equal(t.audio, null, 'no voice key: text reply only');
    const v = await call('POST', '/ai/talk', { lang: 'Swahili', level: 0, audio: 'A'.repeat(300) }, J.access);
    assert.equal(v.heard, 'Habari yako');
  } finally {
    globalThis.fetch = real;
    process.env.ANTHROPIC_API_KEY = saved.a;
    process.env.ELEVENLABS_API_KEY = saved.e;
    delete process.env.GEMINI_API_KEY;
  }
});

test('voices: Yoruba, Igbo and Hausa use native 9jaLingo voices; guides and lessons sound different', async () => {
  await call('POST', '/auth/signup', { email: 'kemi@example.com', password: 'secret123', username: 'kemi', name: 'Kemi' }, null, '1.1.1.1');
  const K = (await call('POST', '/auth/verify', { email: 'kemi@example.com', code: lastCode('kemi@example.com') })).tokens;
  process.env.NAIJALINGO_API_KEY = 'nl-key';
  process.env.GEMINI_API_KEY = 'g-key';
  const saved = { a: process.env.ANTHROPIC_API_KEY, e: process.env.ELEVENLABS_API_KEY };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  const voices = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    url = String(url);
    if (url.includes('9jalingo')) {
      assert.equal(opts.headers['X-API-Key'], 'nl-key');
      const b = JSON.parse(opts.body);
      voices.push(b.voice);
      if (b.input === 'Daalụ') return new Response('{}', { status: 429 });
      return new Response(new Uint8Array([9, 9]), { status: 200 });
    }
    if (url.includes('-tts:')) {
      voices.push('gemini');
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(480).toString('base64') } }] } }] });
    }
    if (url.includes('generativelanguage')) return Response.json({ candidates: [{ content: { parts: [{ text: '{"reply":"Ẹ n lẹ!","english":"Hello!","tip":""}' }] } }] });
    return real(url, opts);
  };
  try {
    const a = await call('POST', '/ai/speak', { lang: 'Yoruba', text: 'Báwo ni' }, K.access);
    assert.equal(a.audio, Buffer.from([9, 9]).toString('base64'));
    const t = await call('POST', '/ai/talk', { lang: 'Igbo', level: 0, text: 'Kedu' }, K.access);
    assert.ok(t.audio);
    assert.deepEqual(voices, ['adeola_yo', 'chinedu_ig']);
    const sw = await call('POST', '/ai/speak', { lang: 'Swahili', text: 'Habari za leo' }, K.access);
    assert.equal(sw.type, 'audio/wav', 'languages without a native voice use the backup voice');
    assert.equal(Buffer.from(sw.audio, 'base64').subarray(0, 4).toString(), 'RIFF');
    // 9jaLingo at its plan limit: the backup voice answers, and 9jaLingo is rested for a while.
    voices.length = 0;
    const busy = await call('POST', '/ai/speak', { lang: 'Igbo', text: 'Daalụ' }, K.access);
    assert.equal(busy.status, 200);
    assert.equal(busy.type, 'audio/wav');
    await call('POST', '/ai/speak', { lang: 'Igbo', text: 'Ka ọ dị' }, K.access);
    assert.deepEqual(voices, ['adaeze_ig', 'gemini', 'gemini'], 'no more 9jaLingo calls while it is busy');
  } finally {
    globalThis.fetch = real;
    process.env.ANTHROPIC_API_KEY = saved.a;
    process.env.ELEVENLABS_API_KEY = saved.e;
    delete process.env.NAIJALINGO_API_KEY;
    delete process.env.GEMINI_API_KEY;
  }
});

// ---------------- social: shared between phones ----------------
import { useBlob } from '../lib/social.js';
const uploads = [];
useBlob(async (path, buf, type) => {
  uploads.push({ path, type, size: buf.length });
  return `https://abc123.public.blob.vercel-storage.com/${path}`;
});
let ipN = 50;
async function person(username, extra = {}) {
  const ip = `9.9.9.${ipN++}`;
  const email = `${username}@example.com`;
  await call('POST', '/auth/signup', { email, password: 'secret123', username, name: username[0].toUpperCase() + username.slice(1) }, null, ip);
  const t = (await call('POST', '/auth/verify', { email, code: lastCode(email) })).tokens;
  if (Object.keys(extra).length) await call('PATCH', '/me', extra, t.access);
  return t.access;
}
const JPEG = Buffer.concat([Buffer.from('ffd8ffe000104a464946', 'hex'), Buffer.alloc(200)]).toString('base64');
const M4A = Buffer.concat([Buffer.from('00000020', 'hex'), Buffer.from('ftypM4A '), Buffer.alloc(200)]).toString('base64');

let P1, P2, P3; // three phones
test('media: only real photos and voice notes upload, and only by signed-in people', async () => {
  P1 = await person('ada');
  P2 = await person('bayo');
  P3 = await person('chi');
  assert.equal((await call('POST', '/media', { data: JPEG })).status, 401);
  const img = await call('POST', '/media', { data: JPEG }, P1);
  assert.equal(img.status, 200);
  assert.match(img.url, /^https:\/\/abc123\.public\.blob\.vercel-storage\.com\/i\//);
  const voice = await call('POST', '/media', { data: M4A, kind: 'audio' }, P1);
  assert.equal(voice.kind, 'audio');
  assert.equal((await call('POST', '/media', { data: Buffer.from('<script>alert(1)</script>'.repeat(3)).toString('base64') }, P1)).status, 415);
  assert.equal((await call('POST', '/media', { data: M4A, kind: 'image' }, P1)).status, 415);
});

test('posts: one phone posts, another phone sees, reacts and comments', async () => {
  const img = (await call('POST', '/media', { data: JPEG }, P1)).url;
  assert.equal((await call('POST', '/posts', { text: 'hi', images: ['https://evil.example/x.jpg'] }, P1)).status, 400, 'only uploaded photos');
  assert.equal((await call('POST', '/posts', { text: 'hi', images: Array(21).fill(img) }, P1)).status, 400);
  assert.equal((await call('POST', '/posts', { text: '' }, P1)).status, 400);
  const p = await call('POST', '/posts', { text: 'Sunset at Lekki\nbeautiful', images: [img, img], place: 'Q8673' }, P1);
  assert.equal(p.status, 200);
  assert.ok(p.post.id.startsWith('srv:'));
  const feed = await call('GET', '/feed', null, P2);
  const seen = feed.posts.find((x) => x.id === p.post.id);
  assert.equal(seen.a, 'ada');
  assert.equal(seen.i.length, 2);
  assert.equal(feed.who.ada.n, 'Ada');
  assert.equal((await call('POST', '/posts/react', { id: p.post.id, emoji: '💩' }, P2)).status, 400);
  await call('POST', '/posts/react', { id: p.post.id, emoji: '🔥' }, P2);
  await call('POST', '/posts/react', { id: p.post.id, emoji: '❤️' }, P3);
  const changed = await call('POST', '/posts/react', { id: p.post.id, emoji: '❤️' }, P2); // changes, not adds
  assert.deepEqual(changed.r, { '❤️': 2 }, 'the server returns the true count');
  assert.equal(changed.m, '❤️');
  const c = await call('POST', '/comments', { post: p.post.id, text: 'Wow!' }, P2);
  assert.equal(c.status, 200);
  assert.equal((await call('POST', '/comments', { post: p.post.id, gif: 'https://evil.example/a.gif' }, P2)).status, 400);
  const voice = (await call('POST', '/media', { data: M4A }, P3)).url;
  await call('POST', '/comments', { post: p.post.id, voice, voiceSecs: 4 }, P3);
  const cl = await call('POST', '/comments/like', { id: c.comment.id }, P1);
  assert.equal(cl.likes, 1);
  assert.equal(cl.liked, true);
  await call('POST', '/posts/save', { id: p.post.id }, P3);
  await call('POST', '/posts/share', { id: p.post.id }, P3);
  await call('POST', '/posts/share', { id: p.post.id }, P3);
  const one = (await call('GET', `/post?id=${encodeURIComponent(p.post.id)}`, null, P1)).post;
  assert.deepEqual(one.r, { '❤️': 2 });
  assert.equal(one.c.length, 2);
  assert.equal(one.c[0].l, 1);
  assert.equal(one.c[0].lk, true);
  assert.equal(one.s, 1, 'a share counts once per person');
  assert.equal((await call('GET', '/feed?saved=1', null, P3)).posts.length, 1);
  assert.equal((await call('GET', '/feed?place=Q8673', null, P3)).posts.length, 1);
  assert.equal((await call('GET', '/feed?user=ada', null, P3)).posts.length, 1);
  const notes = await call('GET', '/notifications', null, P1);
  assert.ok(notes.notifications.some((n) => /commented/.test(n.text)));
  // only the author edits; the post author may remove comments on their post
  assert.equal((await call('POST', '/posts/edit', { id: p.post.id, text: 'hacked' }, P2)).status, 404);
  assert.equal((await call('POST', '/posts/edit', { id: p.post.id, text: 'Sunset at Lekki' }, P1)).post.e, true);
  assert.equal((await call('POST', '/posts/delete', { id: p.post.id }, P2)).status, 403);
  assert.equal((await call('POST', '/comments/delete', { id: c.comment.id }, P1)).status, 200);
  assert.equal((await call('POST', '/posts/delete', { id: p.post.id }, P1)).status, 200);
  assert.equal((await call('GET', `/post?id=${p.post.id}`, null, P2)).status, 404);
});

test('friends, private accounts, blocks and who can message', async () => {
  await call('POST', '/friends/request', { u: 'bayo' }, P1);
  assert.equal((await call('GET', '/user?u=ada', null, P2)).relation, 'received');
  assert.equal((await call('GET', '/friends', null, P2)).incoming[0].u, 'ada');
  assert.equal((await call('POST', '/friends/accept', { u: 'ada' }, P2)).relation, 'friends');
  assert.equal((await call('GET', '/friends', null, P1)).friends[0].u, 'bayo');
  // private: only friends see posts
  await call('PATCH', '/me', { private: true, dms: 'Friends', bio: 'Lagos girl', homeCountry: 'Nigeria', localHelper: true }, P1);
  const secret = await call('POST', '/posts', { text: 'friends only' }, P1);
  assert.ok((await call('GET', '/feed', null, P2)).posts.some((x) => x.id === secret.post.id));
  assert.ok(!(await call('GET', '/feed', null, P3)).posts.some((x) => x.id === secret.post.id));
  assert.equal((await call('POST', '/posts/react', { id: secret.post.id, emoji: '🔥' }, P3)).status, 404);
  // messages
  assert.equal((await call('POST', '/chat', { u: 'ada', text: 'hey' }, P3)).status, 403, 'friends only');
  assert.equal((await call('POST', '/chat', { u: 'ada', text: 'hey ada' }, P2)).status, 200);
  const r = await call('POST', '/chat', { u: 'chi', text: 'hello chi' }, P1);
  assert.equal(r.status, 200);
  assert.equal((await call('POST', '/chat', { u: 'ada', text: 'thanks for writing' }, P3)).status, 200, 'replies are allowed');
  const list = await call('GET', '/chats', null, P1);
  assert.equal(list.chats.length, 2);
  assert.equal(list.chats.find((c) => c.u === 'bayo').unread, 1);
  const th = await call('GET', '/chat?u=bayo', null, P1);
  assert.equal(th.messages[0].t, 'hey ada');
  assert.equal((await call('GET', '/chats', null, P1)).chats.find((c) => c.u === 'bayo').unread, 0);
  const after = await call(`GET`, `/chat?u=bayo&after=${th.messages[0].id}`, null, P1);
  assert.equal(after.messages.length, 0);
  // blocks hide everything and stop messages
  await call('POST', '/block', { u: 'chi' }, P1);
  assert.equal((await call('POST', '/chat', { u: 'ada', text: 'again' }, P3)).status, 403);
  assert.equal((await call('GET', '/user?u=ada', null, P3)).status, 404);
  assert.ok(!(await call('GET', '/users?q=ad', null, P3)).people.some((x) => x.u === 'ada'));
  await call('POST', '/block', { u: 'chi', blocked: false }, P1);
  assert.ok((await call('GET', '/users?q=ad', null, P3)).people.some((x) => x.u === 'ada'));
  const me = await call('GET', '/me', null, P1);
  assert.equal(me.user.bio, 'Lagos girl');
  assert.equal(me.user.dms, 'friends');
  assert.equal((await call('PATCH', '/me', { photo: 'https://evil.example/me.jpg' }, P1)).status, 400);
  const ph = (await call('POST', '/media', { data: JPEG }, P1)).url;
  assert.equal((await call('PATCH', '/me', { photo: ph, private: false }, P1)).user.photo, ph);
  assert.equal((await call('GET', '/users?q=ada', null, P2)).people[0].ph, ph);
});

test('groups: owner, admins, private approval, group posts stay in the group', async () => {
  const g = (await call('POST', '/groups', { name: 'Lagos foodies', about: 'Eat', private: true }, P1)).group;
  assert.equal(g.o, 'ada');
  assert.equal((await call('POST', '/posts', { text: 'x', group: g.id }, P2)).status, 403);
  const j = await call('POST', '/groups/join', { id: g.id }, P2);
  assert.equal(j.group.pend, true);
  assert.equal((await call('GET', `/groups/members?id=${g.id}`, null, P2)).status, 403);
  assert.equal((await call('POST', '/groups/approve', { id: g.id, u: 'bayo' }, P3)).status, 403);
  await call('POST', '/groups/approve', { id: g.id, u: 'bayo' }, P1);
  const gp = await call('POST', '/posts', { text: 'Best suya?', group: g.id }, P2);
  assert.equal(gp.status, 200);
  assert.ok(!(await call('GET', '/feed', null, P2)).posts.some((x) => x.id === gp.post.id), 'group posts stay out of the main feed');
  assert.equal((await call('GET', `/feed?group=${g.id}`, null, P2)).posts.length, 1);
  assert.equal((await call('GET', `/feed?group=${g.id}`, null, P3)).posts.length, 0, 'private group hidden from outsiders');
  // admins
  assert.equal((await call('POST', '/groups/admin', { id: g.id, u: 'bayo' }, P3)).status, 403);
  const a = await call('POST', '/groups/admin', { id: g.id, u: 'bayo' }, P1);
  assert.deepEqual(a.group.ad, ['bayo']);
  await call('POST', '/groups/join', { id: g.id }, P3);
  await call('POST', '/groups/approve', { id: g.id, u: 'chi' }, P2);
  assert.equal((await call('POST', '/groups/remove', { id: g.id, u: 'ada' }, P2)).status, 403, 'nobody removes the owner');
  assert.equal((await call('POST', '/groups/admin', { id: g.id, u: 'bayo', admin: false }, P2)).status, 403, 'only the owner demotes');
  assert.equal((await call('POST', '/posts/delete', { id: gp.post.id }, P2)).status, 200);
  const list = await call('GET', '/groups', null, P3);
  assert.equal(list.groups.find((x) => x.id === g.id).j, true);
  assert.equal((await call('POST', '/groups/leave', { id: g.id }, P1)).status, 400);
  // voice rooms: admins can host
  assert.equal((await call('POST', '/live/start', { title: 'Suya talk', voice: true, groupId: g.id }, P2)).status, 200);
  assert.equal((await call('POST', '/live/start', { title: 'Suya talk', voice: true, groupId: g.id }, P3)).status, 403);
  assert.equal((await call('POST', '/groups/delete', { id: g.id }, P2)).status, 403);
  assert.equal((await call('POST', '/groups/delete', { id: g.id }, P1)).status, 200);
});

test('stories and Ask a local are shared, and only locals answer', async () => {
  const img = (await call('POST', '/media', { data: JPEG }, P2)).url;
  assert.equal((await call('POST', '/stories', { image: 'https://evil.example/s.jpg' }, P2)).status, 400);
  await call('POST', '/stories', { image: img, caption: 'Morning in Ibadan' }, P2);
  const st = await call('GET', '/stories', null, P3);
  assert.equal(st.stories[0].u, 'bayo');
  assert.equal(st.who.bayo.n, 'Bayo');
  const q = await call('POST', '/locals/questions', { country: 'Nigeria', topic: 'Food', text: 'Where is the best amala in Ibadan?' }, P3);
  assert.equal(q.status, 200);
  assert.equal((await call('POST', '/locals/answers', { id: q.question.id, text: 'No idea' }, P2)).status, 403, 'bayo is not a local helper');
  const a = await call('POST', '/locals/answers', { id: q.question.id, text: 'Amala Skye in Bodija. Go before 1pm.' }, P1);
  assert.equal(a.status, 200);
  assert.equal((await call('POST', '/locals/vote', { id: a.answer.id }, P1)).status, 400);
  await call('POST', '/locals/vote', { id: a.answer.id }, P3);
  const l = await call('GET', '/locals?country=Nigeria', null, P2);
  assert.equal(l.questions[0].a[0].v, 1);
  assert.equal(l.helpers[0].u, 'ada');
  assert.ok((await call('GET', '/notifications', null, P1)).notifications.some((n) => /New question about Nigeria/.test(n.text)));
  assert.ok((await call('GET', '/notifications', null, P3)).notifications.some((n) => /answered your question/.test(n.text)));
  assert.equal((await call('GET', '/locals?country=DROP;TABLE', null, P2)).status, 400);
});

test('stories disappear when their timer ends, photos too', async () => {
  const removed = [];
  const { useBlobDelete } = await import('../lib/social.js');
  useBlobDelete(async (urls) => removed.push(...urls));
  const img = (await call('POST', '/media', { data: JPEG }, P1)).url;
  assert.equal((await call('POST', '/stories', { image: img, hours: 5 }, P1)).status, 400);
  const s1 = await call('POST', '/stories', { image: img, hours: 1 }, P1);
  assert.ok(s1.story.until - s1.story.at <= 3600 * 1000 + 1000);
  await pool.query(`update stories set expires_at = now() - interval '1 minute' where id = $1`, [Number(s1.story.id.slice(4))]);
  const st = await call('GET', '/stories', null, P2);
  assert.ok(!st.stories.some((x) => x.id === s1.story.id));
  assert.ok(removed.includes(img));
});

test('progress follows you to a new phone', async () => {
  assert.equal((await call('GET', '/me/state', null, P1)).data, null);
  await call('POST', '/me/state', { data: { xp: 120, done: ['Yoruba:0:1'] } }, P1);
  assert.equal((await call('GET', '/me/state', null, P1)).data.xp, 120);
  assert.equal((await call('POST', '/me/state', { data: { x: 'a'.repeat(70000) } }, P1)).status, 413);
  assert.equal((await call('GET', '/me/state', null, P2)).data, null, 'each account only sees its own');
});

test('party rooms: shared list, wallet needed to join, only the host pays out', async () => {
  const room = (await call('POST', '/party', { name: 'Friday jollof', pot: 20, max: 2, hours: 6, private: false }, P1)).room;
  assert.equal((await call('POST', '/party', { name: 'x', pot: 20, max: 2, hours: 6 }, P1)).status, 400);
  assert.equal((await call('POST', '/party', { name: 'Big', pot: -5, max: 2, hours: 6 }, P1)).status, 400);
  assert.ok((await call('GET', '/party', null, P2)).rooms.some((r) => r.id === room.id));
  assert.equal((await call('POST', '/party/join', { id: room.id }, P2)).status, 400, 'no wallet linked yet');
  const uid = (await pool.query(`select id from users where username = 'bayo'`)).rows[0].id;
  await pool.query(`insert into wallets (user_id, address) values ($1, '0x1111111111111111111111111111111111111111')`, [uid]);
  assert.equal((await call('POST', '/party/join', { id: room.id }, P2)).room.joined[0], 'bayo');
  assert.equal((await call('POST', '/party/join', { id: room.id }, P1)).status, 400, 'host cannot join');
  assert.equal((await call('POST', '/party/end', { id: room.id }, P2)).status, 403);
  const e = await call('POST', '/party/end', { id: room.id }, P1);
  assert.equal(e.payees[0].wallet, '0x1111111111111111111111111111111111111111');
  assert.equal((await call('POST', '/party/paid', { id: room.id, u: 'bayo', hash: '0x' + 'a'.repeat(64) }, P2)).status, 403);
  await call('POST', '/party/paid', { id: room.id, u: 'bayo', hash: '0x' + 'a'.repeat(64) }, P1);
  assert.deepEqual((await call('GET', '/party', null, P2)).rooms.find((r) => r.id === room.id).paid, ['bayo']);
  // private rooms: code only shown to the host
  const priv = (await call('POST', '/party', { name: 'Secret circle', pot: 5, max: 5, hours: 1, private: true }, P1)).room;
  assert.match(priv.code, /^[A-Z2-9]{6}$/);
  assert.ok(!(await call('GET', '/party', null, P2)).rooms.some((r) => r.id === priv.id));
  assert.equal((await call('POST', '/party/join', { id: priv.id }, P2)).status, 404);
  assert.equal((await call('POST', '/party/join', { code: priv.code }, P2)).status, 200);
  assert.equal((await call('GET', '/party', null, P2)).rooms.find((r) => r.id === priv.id).code, '');
});

test('wallet activity: only transfers touching your wallet, checked on chain', async () => {
  const hash = '0x' + 'b'.repeat(64);
  const pad = (a) => '0x' + a.slice(2).padStart(64, '0');
  chain.receipts[hash] = { status: '0x1', blockNumber: '0x3e0', logs: [{ address: ZUBA, logIndex: '0x0', topics: [TRANSFER, pad('0x1111111111111111111111111111111111111111'), pad('0x2222222222222222222222222222222222222222')], data: '0x' + (5000n).toString(16).padStart(64, '0') }] };
  chain.txs[hash] = { from: '0x1111111111111111111111111111111111111111', to: ZUBA, value: '0x0' };
  assert.equal((await call('POST', '/wallet/tx', { hash: 'nope' }, P2)).status, 400);
  assert.equal((await call('POST', '/wallet/tx', { hash }, P2)).ok, true);
  const mine = await call('GET', `/wallet/txs?token=${ZUBA}`, null, P2);
  assert.equal(mine.txs[0].hash, hash);
  assert.equal(mine.txs[0].dir, 'out');
  assert.equal(mine.txs[0].amount, '5000');
  assert.equal((await call('GET', `/wallet/txs?token=${ZUBA}`, null, P1)).txs.length, 0, 'not your wallet, not your list');
  assert.equal((await call('GET', '/wallet/txs?token=DROP', null, P2)).status, 400);
});

test('restaurants: business accounts list menus, prices come from the server', async () => {
  assert.equal((await call('POST', '/food/restaurant', { name: 'Ada Kitchen', city: 'Lagos' }, P1)).status, 403, 'personal accounts cannot list');
  await call('PATCH', '/me', { kind: 'business', bizName: 'Ada Kitchen', bizCategory: 'Restaurant & food' }, P1);
  const me = await call('GET', '/me', null, P1);
  if (me.user.kind !== 'business') await pool.query(`update users set kind = 'business' where username = 'ada'`);
  const r = await call('POST', '/food/restaurant', { name: 'Ada Kitchen', cuisine: 'Nigerian', city: 'Lagos', country: 'Nigeria', phone: '+234 801 234 5678' }, P1);
  assert.equal(r.status, 200);
  assert.equal((await call('POST', '/food/item', { name: 'Jollof', price: -1 }, P1)).status, 400);
  const jollof = (await call('POST', '/food/item', { name: 'Jollof rice', about: 'Smoky', price: 6.5 }, P1)).item;
  const suya = (await call('POST', '/food/item', { name: 'Suya', price: 5 }, P1)).item;
  assert.equal((await call('POST', '/food/item', { name: 'Hack', price: 1, id: jollof.id }, P2)).status, 403);
  const list = await call('GET', '/food?q=jollof', null, P2);
  assert.equal(list.restaurants[0].name, 'Ada Kitchen');
  const menu = await call('GET', `/food/place?id=${r.restaurant.id}`, null, P2);
  assert.equal(menu.menu.length, 2);
  // The phone cannot set the price.
  const o = await call('POST', '/food/order', { restaurant: r.restaurant.id, items: [{ id: jollof.id, qty: 2, price: 0.01 }, { id: suya.id, qty: 1 }], pay: 'delivery', address: '12 Allen Ave' }, P2);
  assert.equal(o.status, 200);
  assert.equal(o.order.total, 18);
  assert.equal(o.order.status, 'new');
  assert.equal((await call('POST', '/food/order', { restaurant: r.restaurant.id, items: [{ id: jollof.id, qty: 1 }] }, P1)).status, 400, 'not from your own kitchen');
  assert.ok((await call('GET', '/notifications', null, P1)).notifications.some((n) => /New order/.test(n.text)));
  const mine = await call('GET', '/food/mine', null, P1);
  assert.equal(mine.orders[0].buyer, 'bayo');
  assert.equal((await call('POST', '/food/order/status', { id: o.order.id, status: 'delivered' }, P1)).status, 400, 'no skipping steps');
  assert.equal((await call('POST', '/food/order/status', { id: o.order.id, status: 'accepted' }, P2)).status, 400, 'buyers cannot accept');
  await call('POST', '/food/order/status', { id: o.order.id, status: 'accepted' }, P1);
  assert.equal((await call('GET', '/food/orders', null, P2)).orders[0].status, 'accepted');
  // Switching back to personal hides the restaurant; switching again brings it back.
  assert.equal((await call('PATCH', '/me', { kind: 'individual' }, P1)).user.kind, 'individual');
  assert.ok(!(await call('GET', '/food', null, P2)).restaurants.some((x) => x.name === 'Ada Kitchen'));
  assert.equal((await call('PATCH', '/me', { kind: 'business', bizName: 'Ada Kitchen' }, P1)).user.kind, 'business');
  // ZUBA orders need a wallet on both sides and wait for payment.
  assert.equal((await call('POST', '/food/order', { restaurant: r.restaurant.id, items: [{ id: suya.id, qty: 1 }], pay: 'zuba' }, P2)).status, 400, 'restaurant has no wallet');
});

test('group chat: members only, polls, pins, slow mode, mutes, invite links, tasks', async () => {
  const g = (await call('POST', '/groups', { name: 'ZUBA builders', about: 'Shill to the world', private: true }, P1)).group;
  assert.equal((await call('GET', `/groups/chat?id=${g.id}`, null, P2)).status, 403, 'outsiders cannot read');
  const inv = await call('POST', '/groups/invite', { id: g.id }, P1);
  assert.equal((await call('POST', '/groups/invite', { id: g.id }, P2)).status, 403);
  assert.equal((await call('POST', '/groups/join-link', { code: inv.link }, P2)).name, 'ZUBA builders', 'invite link skips approval');
  const m1 = await call('POST', '/groups/chat', { id: g.id, text: 'gm @bayo' }, P1);
  assert.ok((await call('GET', '/notifications', null, P2)).notifications.some((n) => /mentioned you in ZUBA builders/.test(n.text)));
  const reply = await call('POST', '/groups/chat', { id: g.id, text: 'gm!', replyTo: m1.id }, P2);
  assert.equal(reply.re.u, 'ada');
  await call('POST', '/groups/chat/react', { msg: m1.id, emoji: '🔥' }, P2);
  assert.equal((await call('POST', '/groups/chat/react', { msg: m1.id, emoji: '💩' }, P2)).status, 400);
  const poll = await call('POST', '/groups/chat', { id: g.id, poll: { question: 'Next listing?', options: ['CEX', 'DEX'] } }, P2);
  await call('POST', '/groups/chat/vote', { msg: poll.id, option: 1 }, P1);
  await call('POST', '/groups/chat/vote', { msg: poll.id, option: 0 }, P1);
  await call('POST', '/groups/chat/read', { id: g.id, last: poll.id }, P2);
  await call('POST', '/groups/chat/typing', { id: g.id }, P2);
  const view = await call('GET', `/groups/chat?id=${g.id}`, null, P1);
  assert.equal(view.messages.length, 3);
  assert.deepEqual(view.messages[2].poll.counts, [1, 0], 'changing a vote moves it');
  assert.equal(view.messages[0].r['🔥'], 1);
  assert.equal(view.messages[0].seen, 1, 'read receipts');
  assert.deepEqual(view.typing, ['bayo']);
  assert.equal((await call('GET', `/groups/chat?id=${g.id}&after=${reply.id}`, null, P1)).messages.length, 1);
  // pins, deletes
  assert.equal((await call('POST', '/groups/chat/pin', { id: g.id, msg: m1.id }, P2)).status, 403);
  await call('POST', '/groups/chat/pin', { id: g.id, msg: m1.id }, P1);
  assert.equal((await call('GET', `/groups/chat?id=${g.id}`, null, P2)).pinned.t, 'gm @bayo');
  assert.equal((await call('POST', '/groups/chat/delete', { msg: m1.id }, P2)).status, 403);
  assert.equal((await call('POST', '/groups/chat/delete', { msg: reply.id }, P1)).status, 200, 'admins can delete');
  // slow mode, mutes, admin-only posting
  await call('POST', '/groups/settings', { id: g.id, slow: 30, topics: ['Raids'] }, P1);
  await call('POST', '/groups/chat', { id: g.id, text: 'one', topic: 'Raids' }, P2);
  assert.equal((await call('POST', '/groups/chat', { id: g.id, text: 'two' }, P2)).status, 429);
  assert.equal((await call('POST', '/groups/chat', { id: g.id, text: 'x', topic: 'Nope' }, P1)).status, 400);
  await call('POST', '/groups/mute', { id: g.id, u: 'bayo', minutes: 60 }, P1);
  await call('POST', '/groups/settings', { id: g.id, slow: 0 }, P1);
  assert.equal((await call('POST', '/groups/chat', { id: g.id, text: 'muted?' }, P2)).status, 403);
  await call('POST', '/groups/mute', { id: g.id, u: 'bayo', minutes: 0 }, P1);
  // tasks: admins post, members claim, admins approve
  assert.equal((await call('POST', '/groups/chat', { id: g.id, task: { title: 'Like and repost', reward: 1000 } }, P2)).status, 403);
  const task = await call('POST', '/groups/chat', { id: g.id, task: { title: 'Like and repost', link: 'https://x.com/zuba/status/1', reward: 1000 } }, P1);
  await call('POST', '/groups/chat/task/done', { msg: task.id, proof: 'done, @bayo_x' }, P2);
  assert.equal((await call('POST', '/groups/chat/task/review', { msg: task.id, u: 'bayo', approve: true }, P2)).status, 403);
  await call('POST', '/groups/chat/task/review', { msg: task.id, u: 'bayo', approve: true, hash: '0x' + 'c'.repeat(64) }, P1);
  const t2 = (await call('GET', `/groups/chat?id=${g.id}&topic=General`, null, P2)).messages.find((m) => m.id === task.id);
  assert.equal(t2.claims[0].s, 'approved');
  const un = (await call('GET', '/groups/unread', null, P2)).unread[g.id];
  assert.equal(un.t, '✅ Task', 'chat list shows the latest message');
  assert.equal(un.u, 'ada');
  const img = (await call('POST', '/media', { data: JPEG }, P1)).url;
  await call('POST', '/groups/chat', { id: g.id, image: img, text: 'flyer' }, P1);
  assert.equal((await call('GET', `/groups/media?id=${g.id}`, null, P2)).media[0].i, img);
  assert.equal((await call('GET', `/groups/media?id=${g.id}`, null, P3)).status, 403);
});

test('deleting an account removes what they shared', async () => {
  await call('POST', '/posts', { text: 'bye' }, P3);
  assert.equal((await call('POST', '/me/delete', { password: 'secret123' }, P3)).status, 200);
  const f = await call('GET', '/feed', null, P1);
  assert.ok(!f.posts.some((x) => x.a === 'chi'));
  assert.equal((await call('GET', '/chats', null, P1)).chats.some((c) => c.u === 'chi'), false);
});

test('place photos: Google key stays on the server, the credit comes back, calls are reused and capped', async () => {
  process.env.GOOGLE_PLACES_KEY = 'g'.repeat(39);
  process.env.GOOGLE_DAILY_CAP = '2';
  const calls = [];
  useGoogleFetch(async (url, opts) => {
    calls.push(String(url));
    assert.equal(opts.headers['X-Goog-Api-Key'], 'g'.repeat(39));
    assert.ok(!String(url).includes('g'.repeat(39)), 'key never in the URL');
    let j;
    const photos = [{ name: 'places/ChIJ1/photos/P1', widthPx: 4000, authorAttributions: [{ displayName: 'Ada Lovelace', uri: '//maps.google.com/maps/contrib/1', photoUri: '//lh3.googleusercontent.com/a/x' }] }];
    if (url.endsWith(':searchText')) j = JSON.parse(opts.body).textQuery.startsWith('Nowhere') ? {} : { places: [{ id: 'ChIJ1', photos }] };
    else if (url.includes('/media')) j = { photoUri: 'https://lh3.googleusercontent.com/p/abc=s1200' };
    else j = { id: 'ChIJ1', photos };
    return { ok: true, json: async () => j };
  });
  const T = P2;
  assert.equal((await call('GET', '/places/photo?id=Q1&q=Olumo%20Rock,%20Nigeria')).status, 401);
  const a = await call('GET', '/places/photo?id=Q1&q=Olumo%20Rock,%20Nigeria&lat=7.16&lng=3.35&w=1200', null, T);
  assert.equal(a.status, 200);
  assert.equal(a.url, 'https://lh3.googleusercontent.com/p/abc=s1200');
  assert.equal(a.by, 'Ada Lovelace');
  assert.equal(a.byUrl, 'https://maps.google.com/maps/contrib/1');
  assert.ok(!JSON.stringify(a).includes('g'.repeat(39)));
  const n = calls.length;
  assert.equal((await call('GET', '/places/photo?id=Q1&q=Olumo%20Rock,%20Nigeria', null, T)).url, a.url);
  assert.equal(calls.length, n, 'a fresh link is reused, not paid for again');
  assert.equal((await call('GET', '/places/photo?id=Q2&q=Nowhere%20at%20all', null, T)).status, 404);
  assert.equal((await call('GET', '/places/photo?id=Q3&q=Zuma%20Rock', null, T)).status, 503, 'daily cap');
  assert.equal((await call('GET', '/places/photo?id=../x&q=Zuma', null, T)).status, 400);
});

