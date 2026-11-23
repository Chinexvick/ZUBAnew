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
  const guest = await call('POST', '/rooms/token', { room: 'party-someoneelse-1' }, F.access);
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
