// Party rooms: a host puts ZUBA in a pot, people join, and the host's own wallet pays
// each person their share when the room ends. The server keeps the list and the receipts;
// it never holds or moves the pot.
import crypto from 'node:crypto';
import { sql } from './db.js';
import { fail, limit, readBody, requireUser, str } from './core.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HOURS = [1, 6, 24, 72];
const HASH = /^0x[0-9a-fA-F]{64}$/;
const sid = (n) => 'srv:' + n;
const num = (v) => {
  const m = /^(?:srv:)?(\d{1,15})$/.exec(String(v ?? ''));
  if (!m) fail(400, 'Check the room');
  return Number(m[1]);
};

async function json(rooms, me) {
  if (!rooms.length) return [];
  const ids = rooms.map((r) => Number(r.id));
  const members = await sql`select m.room_id, m.paid_tx, x.username from party_members m join users x on x.id = m.user_id
    where m.room_id = any(${ids}::bigint[]) order by m.joined_at`;
  return rooms.map((r) => {
    const mm = members.filter((m) => Number(m.room_id) === Number(r.id));
    const host = Number(r.host_id) === Number(me);
    return {
      id: sid(r.id), name: r.name, host: r.host, pot: Number(r.pot_usd), max: r.max_people, private: r.private,
      code: host ? r.code : '', ends: new Date(r.ends_at).getTime(), ended: !!r.ended_at,
      joined: mm.map((m) => m.username), paid: mm.filter((m) => m.paid_tx).map((m) => m.username),
    };
  });
}

/** GET /party — open public rooms, plus rooms you host or joined. */
export async function list(req) {
  const u = await requireUser(req);
  const rows = await sql`select r.*, x.username as host from party_rooms r join users x on x.id = r.host_id
    where (r.ended_at is null and r.ends_at > now() - interval '1 day' and not r.private)
       or r.host_id = ${u.id}
       or exists (select 1 from party_members m where m.room_id = r.id and m.user_id = ${u.id})
    order by r.id desc limit 100`;
  return { rooms: await json(rows, u.id) };
}

/** POST /party {name, pot, max, hours, private} */
export async function create(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`party:${u.id}`, 10, 86400);
  const name = str(b.name, { min: 3, max: 60, name: 'room name' });
  const pot = Number(b.pot);
  if (!Number.isFinite(pot) || pot <= 0 || pot > 100000) fail(400, 'Check the pot');
  const max = Number(b.max);
  if (!Number.isInteger(max) || max < 2 || max > 500) fail(400, 'Check how many people');
  const hours = Number(b.hours);
  if (!HOURS.includes(hours)) fail(400, 'Check how long the room is open');
  const priv = b.private === true;
  const code = priv ? Array.from(crypto.randomBytes(6), (x) => CODE_CHARS[x % 32]).join('') : '';
  const [r] = await sql`insert into party_rooms (host_id, name, pot_usd, max_people, private, code, ends_at)
    values (${u.id}, ${name}, ${pot}, ${max}, ${priv}, ${code}, now() + make_interval(hours => ${hours}::int)) returning *`;
  return { room: (await json([{ ...r, host: u.username }], u.id))[0] };
}

/** POST /party/join {id?, code?} — needs a linked wallet so your share has somewhere to go. */
export async function join(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`pjoin:${u.id}`, 60, 3600);
  const code = String(b.code || '').trim().toUpperCase();
  const [r] = code
    ? await sql`select r.*, x.username as host from party_rooms r join users x on x.id = r.host_id where r.private and r.code = ${code} and ${/^[A-Z2-9]{6}$/.test(code)}`
    : await sql`select r.*, x.username as host from party_rooms r join users x on x.id = r.host_id where r.id = ${num(b.id)} and not r.private`;
  if (!r) fail(404, code ? 'No room with that code' : 'That room is no longer open');
  if (r.ended_at || new Date(r.ends_at) < new Date()) fail(400, 'This room has closed');
  if (Number(r.host_id) === Number(u.id)) fail(400, 'You are hosting this room');
  const [w] = await sql`select 1 from wallets where user_id = ${u.id}`;
  if (!w) fail(400, 'Link your wallet first so your share has somewhere to go');
  const [n] = await sql`select count(*)::int as n from party_members where room_id = ${r.id}`;
  if (n.n >= r.max_people) fail(400, 'This room is full');
  await sql`insert into party_members (room_id, user_id) values (${r.id}, ${u.id}) on conflict do nothing`;
  return { room: (await json([r], u.id))[0] };
}

/** POST /party/end {id} — host only. Returns where each share goes. */
export async function end(req) {
  const u = await requireUser(req);
  const [r] = await sql`select r.*, x.username as host from party_rooms r join users x on x.id = r.host_id where r.id = ${num((await readBody(req)).id)}`;
  if (!r || Number(r.host_id) !== Number(u.id)) fail(403, 'Only the host can end this room');
  await sql`update party_rooms set ended_at = coalesce(ended_at, now()) where id = ${r.id}`;
  const payees = await sql`select x.username, lower(w.address::text) as wallet, m.paid_tx from party_members m
    join users x on x.id = m.user_id join wallets w on w.user_id = m.user_id where m.room_id = ${r.id} order by m.joined_at`;
  return { room: (await json([{ ...r, ended_at: new Date() }], u.id))[0], payees: payees.map((p) => ({ u: p.username, wallet: p.wallet, paid: !!p.paid_tx })) };
}

/** POST /party/paid {id, u, hash} — host records the payout transaction for one person. */
export async function paid(req) {
  const me = await requireUser(req);
  const b = await readBody(req);
  const id = num(b.id);
  if (!HASH.test(String(b.hash || ''))) fail(400, 'Check the transaction hash');
  const [r] = await sql`select host_id, name from party_rooms where id = ${id}`;
  if (!r || Number(r.host_id) !== Number(me.id)) fail(403, 'Only the host can do that');
  const [x] = await sql`update party_members m set paid_tx = ${String(b.hash).toLowerCase()}
    from users u where m.room_id = ${id} and m.user_id = u.id and u.username = ${String(b.u || '')} and m.paid_tx is null returning m.user_id`;
  if (x) {
    await sql`insert into wallet_tx_pending (hash, user_id) values (${String(b.hash).toLowerCase()}, ${me.id}) on conflict do nothing`;
    await sql`insert into notifications (user_id, kind, text, data) values (${x.user_id}, 'party', ${`Your share from "${r.name}" is on its way`}, ${JSON.stringify({ hash: b.hash })})`;
  }
  return { ok: true };
}
