// Live voice rooms (party rooms, live sessions) run on LiveKit.
// The server signs a short-lived pass; the LiveKit secret never leaves the server.
import { sql } from './db.js';
import crypto from 'node:crypto';
import { fail, limit, readBody, requireUser, str } from './core.js';

const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

export function livekitToken({ key, secret, identity, name, room, host, ttl = 2 * 3600 }) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u({ alg: 'HS256', typ: 'JWT' });
  const body = b64u({
    iss: key,
    sub: identity,
    name,
    nbf: now - 10,
    exp: now + ttl,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: !!host },
    metadata: JSON.stringify({ host: !!host }),
  });
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** POST /rooms/token {room, host} → {url, token} */
export async function roomToken(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const room = str(b.room, { min: 3, max: 64, name: 'room' });
  if (!/^[a-z0-9._-]+$/i.test(room)) fail(400, 'Check the room');
  const { LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = process.env;
  if (!url || !key || !secret) fail(503, 'Live voice is not switched on yet. Please try again later.');
  await limit(`room:${u.id}`, 120, 3600);
  // Hosts are identified by the room name the app creates: "<kind>-<host username>-<id>".
  const host = room.split('-')[1] === u.username;
  // Party rooms on the server: only the host and people who joined can get in.
  const pm = /^party-[a-z0-9._]+-(\d{1,15})$/i.exec(room);
  if (pm && !host) {
    const [ok] = await sql`select 1 from party_members where room_id = ${Number(pm[1])} and user_id = ${u.id}`;
    if (!ok) fail(403, 'Join the room first');
  }
  return { url, token: livekitToken({ key, secret, identity: u.username, name: u.name || u.username, room, host }) };
}
