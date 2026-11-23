// Live sessions: video lives and group voice rooms. The media itself runs on LiveKit;
// this registry lets people find what is live right now.
import crypto from 'node:crypto';
import { sql } from './db.js';
import { fail, limit, readBody, requireUser, str } from './core.js';

const row = (r) => ({
  id: r.id, host: r.username, hostName: r.name, title: r.title, about: r.about, place: r.place_id, voice: r.voice,
  group: r.group_name, room: r.room, startedAt: r.started_at,
});

/** POST /live/start {title, about?, place?, voice?, group?} */
export async function start(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`live:${u.id}`, 30, 86400);
  const title = str(b.title, { min: 2, max: 80, name: 'title' });
  const about = b.about ? str(b.about, { max: 300, name: 'description' }) : '';
  const place = b.place ? str(b.place, { max: 20, name: 'place' }) : null;
  if (place && !/^Q\d+$/.test(place)) fail(400, 'Check the place');
  const voice = b.voice === true;
  const group = voice ? str(b.group || '', { min: 2, max: 80, name: 'group' }) : null;
  await sql`update live_sessions set ended_at = now() where host_id = ${u.id} and ended_at is null`;
  const room = `${voice ? 'voice' : 'live'}-${u.username}-${crypto.randomBytes(4).toString('hex')}`;
  const [r] = await sql`insert into live_sessions (host_id, title, about, place_id, voice, group_name, room)
    values (${u.id}, ${title}, ${about}, ${place}, ${voice}, ${group}, ${room}) returning *`;
  return row({ ...r, username: u.username, name: u.name });
}

/** GET /live: what is live now */
export async function list(req) {
  await requireUser(req);
  const rows = await sql`select l.*, u.username, u.name from live_sessions l join users u on u.id = l.host_id
    where l.ended_at is null and l.started_at > now() - interval '8 hours' order by l.started_at desc limit 50`;
  return { live: rows.map(row) };
}

/** POST /live/end {id} */
export async function end(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await sql`update live_sessions set ended_at = now() where id = ${Number(b.id) || 0} and host_id = ${u.id} and ended_at is null`;
  return { ok: true };
}
