// Social: posts, comments, friends, groups, chats, stories and Ask a local.
// Everything here is shared between phones. The phone is never trusted:
// every id, URL, permission and limit is checked on the server.
import { sql } from './db.js';
import { fail, limit, readBody, requireUser, str } from './core.js';

export const REACTIONS = ['❤️', '😍', '😂', '😮', '🔥', '👏'];
const BLOB_HOST = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[\w./-]+$/i;
const OUR_MEDIA = /^https:\/\/afrit-(media|gallery)\.vercel\.app\/[\w./-]+$/;
const GIF = /^https:\/\/(media\d?|i)\.giphy\.com\/[\w./-]+$/;

// ---------------- small helpers ----------------
const ms = (d) => new Date(d).getTime();
const sid = (n) => (n == null ? null : 'srv:' + n);
function num(v, name = 'id') {
  const m = /^(?:srv:)?(\d{1,15})$/.exec(String(v ?? ''));
  if (!m) fail(400, `Check the ${name}`);
  return Number(m[1]);
}
export function mediaUrl(v, name = 'photo') {
  const s = str(v, { min: 10, max: 400, name });
  if (!BLOB_HOST.test(s) && !OUR_MEDIA.test(s)) fail(400, `Upload the ${name} first`);
  return s;
}
const optText = (v, max, name) => (v == null || v === '' ? '' : str(v, { max, name }));
// Long text may contain new lines and tabs, nothing else from the control range.
function body(v, max, name) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string') fail(400, `Check your ${name}`);
  const s = v.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (s.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)) fail(400, `Check your ${name}`);
  return s;
}
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

/** The short card the app shows next to a name: photo, tick, plan. */
export function who(u) {
  const premium = !!u.premium_until && new Date(u.premium_until) > new Date();
  return {
    u: u.username, n: u.name || u.username, ph: u.photo_url || null, bio: u.bio || '', pr: premium, bz: u.kind === 'business',
    bc: u.biz_category || '', bn: u.biz_name || '', hc: u.home_country || '', lh: !!u.local_helper,
  };
}
async function whoMap(ids) {
  const list = [...new Set(ids.filter(Boolean).map(Number))];
  if (!list.length) return {};
  const rows = await sql`select * from users where id = any(${list}::bigint[])`;
  return Object.fromEntries(rows.map((r) => [r.username, who(r)]));
}
async function userByName(username) {
  const name = str(username, { min: 1, max: 40, name: 'username' }).replace(/^@/, '');
  const [u] = await sql`select * from users where username = ${name} and email_verified`;
  if (!u) fail(404, 'We could not find that person');
  return u;
}
async function blockedBetween(a, b) {
  const [r] = await sql`select 1 from blocks where (user_id = ${a} and blocked_id = ${b}) or (user_id = ${b} and blocked_id = ${a}) limit 1`;
  return !!r;
}
async function areFriends(a, b) {
  const [x, y] = pair(Number(a), Number(b));
  const [r] = await sql`select 1 from friendships where a = ${x} and b = ${y}`;
  return !!r;
}
async function notify(userId, kind, text, data = {}) {
  await sql`insert into notifications (user_id, kind, text, data) values (${userId}, ${kind}, ${text}, ${JSON.stringify(data)})`;
}
export async function role(groupId, userId) {
  const [r] = await sql`select role from group_members where group_id = ${groupId} and user_id = ${userId}`;
  return r?.role ?? null;
}
const isAdminRole = (r) => r === 'owner' || r === 'admin';

// ---------------- media upload ----------------
let putImpl = null;
/** Tests swap the Blob upload for a fake. */
export function useBlob(fn) {
  putImpl = fn;
}
async function put(path, buf, contentType) {
  if (putImpl) return putImpl(path, buf, contentType);
  if (!process.env.BLOB_READ_WRITE_TOKEN) fail(503, 'Uploads are not switched on yet');
  const { put: blobPut } = await import('@vercel/blob');
  const r = await blobPut(path, buf, { access: 'public', contentType, addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN });
  return r.url;
}
function sniff(b) {
  const hex = b.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return ['image', 'image/jpeg', 'jpg'];
  if (hex.startsWith('89504e470d0a1a0a')) return ['image', 'image/png', 'png'];
  if (hex.startsWith('52494646') && b.subarray(8, 12).toString() === 'WEBP') return ['image', 'image/webp', 'webp'];
  if (hex.startsWith('474946383')) return ['image', 'image/gif', 'gif'];
  if (b.subarray(4, 8).toString() === 'ftyp') {
    const brand = b.subarray(8, 12).toString();
    if (/^(heic|heix|mif1|avif)/.test(brand)) return ['image', brand === 'avif' ? 'image/avif' : 'image/heic', brand === 'avif' ? 'avif' : 'heic'];
    return ['audio', 'audio/mp4', 'm4a'];
  }
  if (hex.startsWith('4f676753')) return ['audio', 'audio/ogg', 'ogg'];
  if (hex.startsWith('1a45dfa3')) return ['audio', 'audio/webm', 'webm'];
  if (hex.startsWith('494433') || /^fff[23ab]/.test(hex)) return ['audio', 'audio/mpeg', 'mp3'];
  if (hex.startsWith('52494646') && b.subarray(8, 12).toString() === 'WAVE') return ['audio', 'audio/wav', 'wav'];
  return null;
}

/** POST /media {data: base64} → {url}. Photos up to 3 MB, voice notes up to 2 MB. */
export async function upload(req) {
  const u = await requireUser(req);
  const b = await readBody(req, 4_300_000);
  await limit(`media:${u.id}`, 300, 86400);
  if (typeof b.data !== 'string' || b.data.length < 20) fail(400, 'Choose a file to upload');
  const buf = Buffer.from(b.data.replace(/^data:[^,]*,/, ''), 'base64');
  const t = sniff(buf);
  if (!t) fail(415, 'That file type is not supported');
  const [kind, type, ext] = t;
  if (b.kind && b.kind !== kind) fail(415, 'That file type is not supported');
  if (buf.length > (kind === 'image' ? 3_200_000 : 2_100_000)) fail(413, kind === 'image' ? 'That photo is too large' : 'That voice note is too long');
  const url = await put(`${kind === 'image' ? 'i' : 'a'}/${u.id}/${Date.now().toString(36)}.${ext}`, buf, type);
  return { url, kind };
}

// ---------------- posts ----------------
async function hydrate(rows, me) {
  if (!rows.length) return { posts: [], who: {} };
  const ids = rows.map((r) => Number(r.id));
  const [reacts, mine, saves, comments] = await Promise.all([
    sql`select post_id, emoji, count(*)::int as n from post_reactions where post_id = any(${ids}::bigint[]) group by post_id, emoji`,
    sql`select post_id, emoji from post_reactions where post_id = any(${ids}::bigint[]) and user_id = ${me}`,
    sql`select post_id from post_saves where post_id = any(${ids}::bigint[]) and user_id = ${me}`,
    sql`select x.*, (select count(*)::int from comment_likes l where l.comment_id = x.id) as likes,
          exists(select 1 from comment_likes l where l.comment_id = x.id and l.user_id = ${me}) as liked
        from (select c.*, row_number() over (partition by c.post_id order by c.id desc) as rn from comments c
              where c.post_id = any(${ids}::bigint[])
                and not exists (select 1 from blocks b where (b.user_id = ${me} and b.blocked_id = c.user_id) or (b.user_id = c.user_id and b.blocked_id = ${me}))) x
        where x.rn <= 40 order by x.id`,
  ]);
  const people = await whoMap([...rows.map((r) => r.user_id), ...comments.map((c) => c.user_id)]);
  const nameOf = {};
  for (const r of await sql`select id, username from users where id = any(${[...new Set([...rows.map((r) => Number(r.user_id)), ...comments.map((c) => Number(c.user_id))])]}::bigint[])`) nameOf[r.id] = r.username;
  const posts = rows.map((r) => {
    const reactions = {};
    for (const x of reacts) if (Number(x.post_id) === Number(r.id)) reactions[x.emoji] = x.n;
    return {
      id: sid(r.id), a: nameOf[r.user_id], t: r.text, i: r.images || [], p: r.place_id, g: sid(r.group_id), at: ms(r.created_at),
      r: reactions, m: mine.find((x) => Number(x.post_id) === Number(r.id))?.emoji ?? null,
      c: comments.filter((c) => Number(c.post_id) === Number(r.id)).map((c) => ({
        id: sid(c.id), a: nameOf[c.user_id], t: c.text, g: c.gif, v: c.voice, vs: c.voice_secs, at: ms(c.created_at), l: c.likes, lk: c.liked,
      })),
      s: r.shares, sv: saves.some((x) => Number(x.post_id) === Number(r.id)), e: r.edited,
    };
  });
  return { posts, who: people };
}

// One query decides what a person may see: blocks, private accounts and private groups.
async function visiblePosts(me, { before = null, user = null, place = null, group = null, saved = false, one = null, n = 30 }) {
  return sql`select p.* from posts p join users u on u.id = p.user_id
    where u.email_verified
      and (${one}::bigint is null or p.id = ${one})
      and (${before}::bigint is null or p.id < ${before})
      and (${user}::bigint is null or p.user_id = ${user})
      and (${place}::text is null or p.place_id = ${place})
      and (case when ${group}::bigint is null then (${one}::bigint is not null or ${saved}::boolean or p.group_id is null) else p.group_id = ${group} end)
      and (not ${saved}::boolean or exists (select 1 from post_saves s where s.post_id = p.id and s.user_id = ${me}))
      and not exists (select 1 from blocks b where (b.user_id = ${me} and b.blocked_id = p.user_id) or (b.user_id = p.user_id and b.blocked_id = ${me}))
      and (not u.private or p.user_id = ${me} or exists (select 1 from friendships f where f.a = least(${me}::bigint, p.user_id) and f.b = greatest(${me}::bigint, p.user_id)))
      and (p.group_id is null or exists (select 1 from groups g where g.id = p.group_id and (not g.private
            or exists (select 1 from group_members m where m.group_id = g.id and m.user_id = ${me} and m.role <> 'pending'))))
    order by p.id desc limit ${n}`;
}
async function postFor(me, id) {
  const [p] = await visiblePosts(me, { one: id, n: 1 });
  if (!p) fail(404, 'That post is no longer available');
  return p;
}
function query(req) {
  return new URL(req.url, 'http://x').searchParams;
}
const placeId = (v) => {
  if (v == null || v === '') return null;
  const s = String(v);
  if (!/^Q\d{1,12}$/.test(s)) fail(400, 'Check the place');
  return s;
};

/** GET /feed?before=&user=&place=&group=&saved=1 */
export async function feed(req) {
  const u = await requireUser(req);
  const q = query(req);
  const user = q.get('user') ? Number((await userByName(q.get('user'))).id) : null;
  const group = q.get('group') ? num(q.get('group'), 'group') : null;
  if (group) {
    const [g] = await sql`select private from groups where id = ${group}`;
    if (!g) fail(404, 'That group is no longer available');
  }
  const rows = await visiblePosts(u.id, {
    before: q.get('before') ? num(q.get('before')) : null, user, place: placeId(q.get('place')), group, saved: q.get('saved') === '1',
    n: Math.min(Math.max(Number(q.get('n')) || 30, 1), 50),
  });
  return hydrate(rows, u.id);
}

/** GET /post?id= */
export async function post(req) {
  const u = await requireUser(req);
  const p = await postFor(u.id, num(query(req).get('id')));
  const out = await hydrate([p], u.id);
  return { post: out.posts[0], who: out.who };
}

/** POST /posts {text, images[], place?, group?} */
export async function createPost(req) {
  const u = await requireUser(req);
  const b = await readBody(req, 64 * 1024);
  await limit(`post:${u.id}`, 60, 86400);
  const text = body(b.text, 2000, 'post');
  const images = Array.isArray(b.images) ? b.images.map((x) => mediaUrl(x)) : [];
  if (images.length > 20) fail(400, 'You can add up to 20 photos');
  if (!text && !images.length) fail(400, 'Write something or add a photo');
  let group = null;
  if (b.group) {
    group = num(b.group, 'group');
    const r = await role(group, u.id);
    if (!r || r === 'pending') fail(403, 'Join the group to post in it');
  }
  const [p] = await sql`insert into posts (user_id, text, images, place_id, group_id) values (${u.id}, ${text}, ${JSON.stringify(images)}, ${placeId(b.place)}, ${group}) returning *`;
  const out = await hydrate([p], u.id);
  return { post: out.posts[0], who: out.who };
}

/** POST /posts/edit {id, text} — only the author. */
export async function editPost(req) {
  const u = await requireUser(req);
  const b = await readBody(req, 64 * 1024);
  const id = num(b.id);
  const text = body(b.text, 2000, 'post');
  const [p] = await sql`update posts set text = ${text}, edited = true where id = ${id} and user_id = ${u.id} and (${text} <> '' or images <> '[]'::jsonb) returning *`;
  if (!p) fail(404, 'You can only edit your own posts');
  const out = await hydrate([p], u.id);
  return { post: out.posts[0], who: out.who };
}

/** POST /posts/delete {id} — the author, or an admin of the group it was posted in. */
export async function deletePost(req) {
  const u = await requireUser(req);
  const id = num((await readBody(req)).id);
  const [p] = await sql`select user_id, group_id from posts where id = ${id}`;
  if (!p) return { ok: true };
  if (Number(p.user_id) !== Number(u.id) && !(p.group_id && isAdminRole(await role(p.group_id, u.id)))) fail(403, 'You can only delete your own posts');
  await sql`delete from posts where id = ${id}`;
  return { ok: true };
}

/** POST /posts/react {id, emoji|null} */
export async function react(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`react:${u.id}`, 600, 3600);
  const p = await postFor(u.id, num(b.id));
  if (b.emoji == null || b.emoji === '') {
    await sql`delete from post_reactions where post_id = ${p.id} and user_id = ${u.id}`;
  } else {
    if (!REACTIONS.includes(b.emoji)) fail(400, 'Pick a reaction from the list');
    const [r] = await sql`insert into post_reactions (post_id, user_id, emoji) values (${p.id}, ${u.id}, ${b.emoji})
      on conflict (post_id, user_id) do update set emoji = excluded.emoji returning (xmax = 0) as fresh`;
    if (r?.fresh && Number(p.user_id) !== Number(u.id)) await notify(p.user_id, 'social', `${u.name || u.username} reacted ${b.emoji} to your post`, { post: sid(p.id), u: u.username });
  }
  // The true counts after this change, so every phone shows the same number.
  const rows = await sql`select emoji, count(*)::int as n, bool_or(user_id = ${u.id}) as mine from post_reactions where post_id = ${p.id} group by emoji`;
  return { ok: true, r: Object.fromEntries(rows.map((x) => [x.emoji, x.n])), m: rows.find((x) => x.mine)?.emoji ?? null };
}

/** POST /posts/save {id, saved} */
export async function save(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const p = await postFor(u.id, num(b.id));
  if (b.saved === false) await sql`delete from post_saves where post_id = ${p.id} and user_id = ${u.id}`;
  else await sql`insert into post_saves (post_id, user_id) values (${p.id}, ${u.id}) on conflict do nothing`;
  return { ok: true };
}

/** POST /posts/share {id} — counted once per person per post. */
export async function share(req) {
  const u = await requireUser(req);
  const p = await postFor(u.id, num((await readBody(req)).id));
  const [r] = await sql`insert into rate_hits (key, bucket, hits) values (${`share:${u.id}:${p.id}`}, 0, 1) on conflict (key, bucket) do nothing returning hits`;
  if (r) await sql`update posts set shares = shares + 1 where id = ${p.id}`;
  return { ok: true };
}

// ---------------- comments ----------------
/** POST /comments {post, text?, gif?, voice?, voiceSecs?} */
export async function comment(req) {
  const u = await requireUser(req);
  const b = await readBody(req, 16 * 1024);
  await limit(`comment:${u.id}`, 300, 86400);
  const p = await postFor(u.id, num(b.post, 'post'));
  const text = body(b.text, 1000, 'comment') || null;
  const gif = b.gif ? str(b.gif, { max: 400, name: 'GIF' }) : null;
  if (gif && !GIF.test(gif)) fail(400, 'Pick a GIF from the list');
  const voice = b.voice ? mediaUrl(b.voice, 'voice note') : null;
  const secs = Math.max(0, Math.min(Number(b.voiceSecs) || 0, 300)) | 0;
  if (!text && !gif && !voice) fail(400, 'Write a comment');
  const [c] = await sql`insert into comments (post_id, user_id, text, gif, voice, voice_secs) values (${p.id}, ${u.id}, ${text}, ${gif}, ${voice}, ${secs}) returning *`;
  if (Number(p.user_id) !== Number(u.id)) await notify(p.user_id, 'social', `${u.name || u.username} commented on your post`, { post: sid(p.id), u: u.username });
  return { comment: { id: sid(c.id), a: u.username, t: c.text, g: c.gif, v: c.voice, vs: c.voice_secs, at: ms(c.created_at), l: 0, lk: false }, who: { [u.username]: who(u) } };
}

/** POST /comments/delete {id} — the comment's author or the post's author. */
export async function deleteComment(req) {
  const u = await requireUser(req);
  const id = num((await readBody(req)).id);
  const [c] = await sql`select c.user_id, p.user_id as owner from comments c join posts p on p.id = c.post_id where c.id = ${id}`;
  if (!c) return { ok: true };
  if (Number(c.user_id) !== Number(u.id) && Number(c.owner) !== Number(u.id)) fail(403, 'You can only delete your own comments');
  await sql`delete from comments where id = ${id}`;
  return { ok: true };
}

/** POST /comments/like {id, liked} */
export async function likeComment(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const id = num(b.id);
  const [c] = await sql`select post_id from comments where id = ${id}`;
  if (!c) fail(404, 'That comment is no longer available');
  await postFor(u.id, c.post_id);
  if (b.liked === false) await sql`delete from comment_likes where comment_id = ${id} and user_id = ${u.id}`;
  else await sql`insert into comment_likes (comment_id, user_id) values (${id}, ${u.id}) on conflict do nothing`;
  const [x] = await sql`select count(*)::int as n, bool_or(user_id = ${u.id}) as mine from comment_likes where comment_id = ${id}`;
  return { ok: true, likes: x.n, liked: !!x.mine };
}

// ---------------- people and friends ----------------
async function relation(me, other) {
  if (Number(me) === Number(other)) return 'me';
  if (await areFriends(me, other)) return 'friends';
  const [r] = await sql`select from_id from friend_requests where (from_id = ${me} and to_id = ${other}) or (from_id = ${other} and to_id = ${me}) limit 1`;
  if (!r) return 'none';
  return Number(r.from_id) === Number(me) ? 'sent' : 'received';
}

/** GET /users?q= — search by username or name. */
export async function search(req) {
  const u = await requireUser(req);
  await limit(`search:${u.id}`, 600, 3600);
  const q = String(query(req).get('q') || '').trim().replace(/^@/, '').slice(0, 40);
  const like = q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
  const rows = q
    ? await sql`select * from users where email_verified and username not like 'deleted\\_%' and id <> ${u.id}
        and (username ilike ${like} or name ilike ${like} or name ilike ${'% ' + like})
        and not exists (select 1 from blocks b where (b.user_id = ${u.id} and b.blocked_id = users.id) or (b.user_id = users.id and b.blocked_id = ${u.id}))
        order by (premium_until > now()) desc nulls last, id limit 25`
    : await sql`select * from users where email_verified and username not like 'deleted\\_%' and id <> ${u.id}
        and not exists (select 1 from blocks b where (b.user_id = ${u.id} and b.blocked_id = users.id) or (b.user_id = users.id and b.blocked_id = ${u.id}))
        order by id desc limit 40`;
  return { people: rows.map(who) };
}

/** GET /user?u= — a profile card with counts and how you are connected. */
export async function profile(req) {
  const me = await requireUser(req);
  const u = await userByName(query(req).get('u'));
  if (await blockedBetween(me.id, u.id)) fail(404, 'We could not find that person');
  const [[c], rel] = await Promise.all([
    sql`select (select count(*)::int from posts where user_id = ${u.id} and group_id is null) as posts,
               (select count(*)::int from friendships where a = ${u.id} or b = ${u.id}) as friends`,
    relation(me.id, u.id),
  ]);
  return { user: { ...who(u), private: u.private, dms: u.dms }, posts: c.posts, friends: c.friends, relation: rel };
}

/** GET /friends — friends, requests waiting for you, and requests you sent. */
export async function friends(req) {
  const u = await requireUser(req);
  const [fr, inc, out] = await Promise.all([
    sql`select x.* from friendships f join users x on x.id = case when f.a = ${u.id} then f.b else f.a end where (f.a = ${u.id} or f.b = ${u.id}) and x.email_verified order by f.created_at desc limit 2000`,
    sql`select x.* from friend_requests r join users x on x.id = r.from_id where r.to_id = ${u.id} and x.email_verified order by r.created_at desc limit 500`,
    sql`select x.* from friend_requests r join users x on x.id = r.to_id where r.from_id = ${u.id} and x.email_verified order by r.created_at desc limit 500`,
  ]);
  return { friends: fr.map(who), incoming: inc.map(who), outgoing: out.map(who) };
}

async function makeFriends(a, b) {
  const [x, y] = pair(Number(a), Number(b));
  await sql`insert into friendships (a, b) values (${x}, ${y}) on conflict do nothing`;
  await sql`delete from friend_requests where (from_id = ${a} and to_id = ${b}) or (from_id = ${b} and to_id = ${a})`;
}

/** POST /friends/request {u} — if they already asked you, you become friends. */
export async function friendRequest(req) {
  const me = await requireUser(req);
  const o = await userByName((await readBody(req)).u);
  if (Number(o.id) === Number(me.id)) fail(400, 'That is you');
  if (await blockedBetween(me.id, o.id)) fail(404, 'We could not find that person');
  await limit(`friend:${me.id}`, 100, 86400);
  const rel = await relation(me.id, o.id);
  if (rel === 'friends' || rel === 'sent') return { relation: rel };
  if (rel === 'received') {
    await makeFriends(me.id, o.id);
    await notify(o.id, 'social', `${me.name || me.username} accepted your friend request`, { u: me.username });
    return { relation: 'friends' };
  }
  await sql`insert into friend_requests (from_id, to_id) values (${me.id}, ${o.id}) on conflict do nothing`;
  await notify(o.id, 'social', `${me.name || me.username} sent you a friend request`, { u: me.username, request: true });
  return { relation: 'sent' };
}

/** POST /friends/accept {u} */
export async function friendAccept(req) {
  const me = await requireUser(req);
  const o = await userByName((await readBody(req)).u);
  const [r] = await sql`select 1 from friend_requests where from_id = ${o.id} and to_id = ${me.id}`;
  if (!r) fail(404, 'That request is no longer there');
  await makeFriends(me.id, o.id);
  await notify(o.id, 'social', `${me.name || me.username} accepted your friend request`, { u: me.username });
  return { relation: 'friends' };
}

/** POST /friends/decline {u} — also cancels a request you sent. */
export async function friendDecline(req) {
  const me = await requireUser(req);
  const o = await userByName((await readBody(req)).u);
  await sql`delete from friend_requests where (from_id = ${o.id} and to_id = ${me.id}) or (from_id = ${me.id} and to_id = ${o.id})`;
  return { relation: await relation(me.id, o.id) };
}

/** POST /friends/remove {u} */
export async function friendRemove(req) {
  const me = await requireUser(req);
  const o = await userByName((await readBody(req)).u);
  const [x, y] = pair(Number(me.id), Number(o.id));
  await sql`delete from friendships where a = ${x} and b = ${y}`;
  await sql`delete from friend_requests where (from_id = ${o.id} and to_id = ${me.id}) or (from_id = ${me.id} and to_id = ${o.id})`;
  return { relation: 'none' };
}

/** POST /block {u, blocked} — also ends the friendship and any requests. */
export async function block(req) {
  const me = await requireUser(req);
  const b = await readBody(req);
  const o = await userByName(b.u);
  if (Number(o.id) === Number(me.id)) fail(400, 'That is you');
  if (b.blocked === false) {
    await sql`delete from blocks where user_id = ${me.id} and blocked_id = ${o.id}`;
  } else {
    await sql`insert into blocks (user_id, blocked_id) values (${me.id}, ${o.id}) on conflict do nothing`;
    const [x, y] = pair(Number(me.id), Number(o.id));
    await sql`delete from friendships where a = ${x} and b = ${y}`;
    await sql`delete from friend_requests where (from_id = ${o.id} and to_id = ${me.id}) or (from_id = ${me.id} and to_id = ${o.id})`;
  }
  return { ok: true };
}

/** GET /blocks */
export async function blocks(req) {
  const me = await requireUser(req);
  const rows = await sql`select x.* from blocks b join users x on x.id = b.blocked_id where b.user_id = ${me.id}`;
  return { people: rows.map(who) };
}

/** POST /report {kind, id, reason} — sends content to the review queue. */
export async function report(req) {
  const me = await requireUser(req);
  const b = await readBody(req);
  await limit(`report:${me.id}`, 50, 86400);
  const kind = ['post', 'comment', 'user', 'question', 'answer', 'message', 'story', 'group'].includes(b.kind) ? b.kind : fail(400, 'Check what you are reporting');
  const id = kind === 'user' ? Number((await userByName(b.id)).id) : num(b.id);
  await sql`insert into content_reports (user_id, kind, target_id, reason) values (${me.id}, ${kind}, ${id}, ${optText(b.reason, 300, 'reason')}) on conflict do nothing`;
  return { ok: true };
}

// ---------------- groups ----------------
async function groupJson(rows, me) {
  if (!rows.length) return [];
  const ids = rows.map((g) => Number(g.id));
  const members = await sql`select m.group_id, m.role, x.username from group_members m join users x on x.id = m.user_id
    where m.group_id = any(${ids}::bigint[]) and m.role <> 'pending' order by (m.role = 'member'), m.joined_at limit 5000`;
  const counts = await sql`select group_id, count(*)::int as n from group_members where group_id = any(${ids}::bigint[]) and role <> 'pending' group by group_id`;
  const mine = await sql`select group_id, role from group_members where group_id = any(${ids}::bigint[]) and user_id = ${me}`;
  return rows.map((g) => {
    const mm = members.filter((m) => Number(m.group_id) === Number(g.id));
    const my = mine.find((m) => Number(m.group_id) === Number(g.id))?.role;
    return {
      id: sid(g.id), n: g.name, ab: g.about, m: counts.find((c) => Number(c.group_id) === Number(g.id))?.n ?? 0, j: !!my && my !== 'pending', pend: my === 'pending',
      p: g.private, o: mm.find((m) => m.role === 'owner')?.username ?? '', ad: mm.filter((m) => m.role === 'admin').map((m) => m.username), pp: mm.slice(0, 60).map((m) => m.username),
    };
  });
}

/** GET /groups — yours first, then public groups to discover. */
export async function groups(req) {
  const u = await requireUser(req);
  const rows = await sql`select g.* from groups g
    where exists (select 1 from group_members m where m.group_id = g.id and m.user_id = ${u.id})
       or g.id in (select g2.id from groups g2 where not g2.private order by (select count(*) from group_members m2 where m2.group_id = g2.id) desc, g2.id desc limit 60)
    order by g.id desc limit 200`;
  return { groups: await groupJson(rows, u.id) };
}

/** POST /groups {name, about, private} — you become the owner. */
export async function createGroup(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`group:${u.id}`, 10, 86400);
  const [g] = await sql`insert into groups (owner_id, name, about, private) values (${u.id}, ${str(b.name, { min: 3, max: 60, name: 'group name' })}, ${body(b.about, 500, 'description')}, ${b.private === true}) returning *`;
  await sql`insert into group_members (group_id, user_id, role) values (${g.id}, ${u.id}, 'owner')`;
  return { group: (await groupJson([g], u.id))[0] };
}

async function groupOr404(id) {
  const [g] = await sql`select * from groups where id = ${id}`;
  if (!g) fail(404, 'That group is no longer available');
  return g;
}

/** POST /groups/join {id} — private groups wait for an admin to approve. */
export async function joinGroup(req) {
  const u = await requireUser(req);
  const g = await groupOr404(num((await readBody(req)).id, 'group'));
  await limit(`join:${u.id}`, 100, 86400);
  const r = await role(g.id, u.id);
  if (!r) {
    await sql`insert into group_members (group_id, user_id, role) values (${g.id}, ${u.id}, ${g.private ? 'pending' : 'member'}) on conflict do nothing`;
    if (g.private) {
      const admins = await sql`select user_id from group_members where group_id = ${g.id} and role in ('owner','admin') limit 20`;
      for (const a of admins) await notify(a.user_id, 'social', `${u.name || u.username} asked to join ${g.name}`, { group: sid(g.id), u: u.username });
    }
  }
  return { group: (await groupJson([g], u.id))[0] };
}

/** POST /groups/leave {id} — owners delete the group instead. */
export async function leaveGroup(req) {
  const u = await requireUser(req);
  const g = await groupOr404(num((await readBody(req)).id, 'group'));
  if ((await role(g.id, u.id)) === 'owner') fail(400, 'You own this group. Delete it instead, or make someone else the owner first.');
  await sql`delete from group_members where group_id = ${g.id} and user_id = ${u.id}`;
  return { group: (await groupJson([g], u.id))[0] };
}

/** GET /groups/members?id= */
export async function groupMembers(req) {
  const u = await requireUser(req);
  const g = await groupOr404(num(query(req).get('id'), 'group'));
  const mine = await role(g.id, u.id);
  if (g.private && (!mine || mine === 'pending')) fail(403, 'Only members can see who is in this group');
  const rows = await sql`select m.role, x.* from group_members m join users x on x.id = m.user_id where m.group_id = ${g.id}
    and (m.role <> 'pending' or ${isAdminRole(mine)}::boolean) order by case m.role when 'owner' then 0 when 'admin' then 1 when 'pending' then 2 else 3 end, m.joined_at limit 2000`;
  return { members: rows.map((r) => ({ ...who(r), role: r.role })) };
}

/** POST /groups/admin {id, u, admin} — owners and admins promote; only the owner demotes. */
export async function setAdmin(req) {
  const me = await requireUser(req);
  const b = await readBody(req);
  const g = await groupOr404(num(b.id, 'group'));
  const o = await userByName(b.u);
  const mine = await role(g.id, me.id);
  const theirs = await role(g.id, o.id);
  if (!isAdminRole(mine)) fail(403, 'Only group admins can do that');
  if (!theirs || theirs === 'pending') fail(400, 'They need to join the group first');
  if (theirs === 'owner') fail(400, 'The owner is always an admin');
  if (b.admin === false) {
    if (mine !== 'owner') fail(403, 'Only the owner can remove admins');
    await sql`update group_members set role = 'member' where group_id = ${g.id} and user_id = ${o.id}`;
  } else {
    await sql`update group_members set role = 'admin' where group_id = ${g.id} and user_id = ${o.id}`;
    await notify(o.id, 'social', `You are now an admin of ${g.name}`, { group: sid(g.id) });
  }
  return { group: (await groupJson([g], me.id))[0] };
}

/** POST /groups/approve {id, u, ok} — admins let people into private groups. */
export async function approve(req) {
  const me = await requireUser(req);
  const b = await readBody(req);
  const g = await groupOr404(num(b.id, 'group'));
  if (!isAdminRole(await role(g.id, me.id))) fail(403, 'Only group admins can do that');
  const o = await userByName(b.u);
  if (b.ok === false) await sql`delete from group_members where group_id = ${g.id} and user_id = ${o.id} and role = 'pending'`;
  else {
    const [r] = await sql`update group_members set role = 'member' where group_id = ${g.id} and user_id = ${o.id} and role = 'pending' returning 1`;
    if (r) await notify(o.id, 'social', `You're in! Welcome to ${g.name}`, { group: sid(g.id) });
  }
  return { ok: true };
}

/** POST /groups/remove {id, u} — admins remove members; only the owner removes admins. */
export async function removeMember(req) {
  const me = await requireUser(req);
  const b = await readBody(req);
  const g = await groupOr404(num(b.id, 'group'));
  const o = await userByName(b.u);
  const mine = await role(g.id, me.id);
  const theirs = await role(g.id, o.id);
  if (!isAdminRole(mine)) fail(403, 'Only group admins can do that');
  if (theirs === 'owner' || (theirs === 'admin' && mine !== 'owner')) fail(403, 'Only the owner can remove admins');
  await sql`delete from group_members where group_id = ${g.id} and user_id = ${o.id}`;
  return { ok: true };
}

/** POST /groups/delete {id} — owner only. */
export async function deleteGroup(req) {
  const me = await requireUser(req);
  const g = await groupOr404(num((await readBody(req)).id, 'group'));
  if ((await role(g.id, me.id)) !== 'owner') fail(403, 'Only the owner can delete the group');
  await sql`delete from groups where id = ${g.id}`;
  return { ok: true };
}

/** Used by live rooms: may this person host a voice room for this group? */
export async function canHostGroup(userId, groupId) {
  return isAdminRole(await role(groupId, userId));
}

// ---------------- chats ----------------
const msgJson = (m, names) => ({ id: Number(m.id), f: names[m.from_id], t: m.text, g: m.gif, at: ms(m.created_at), rd: m.read });

/** GET /chats — one row per conversation with the latest message and unread count. */
export async function chats(req) {
  const u = await requireUser(req);
  const last = await sql`select distinct on (least(from_id, to_id), greatest(from_id, to_id)) m.*
    from messages m where m.from_id = ${u.id} or m.to_id = ${u.id}
    order by least(from_id, to_id), greatest(from_id, to_id), id desc`;
  last.sort((a, b) => Number(b.id) - Number(a.id));
  const top = last.slice(0, 200);
  const other = top.map((m) => (Number(m.from_id) === Number(u.id) ? m.to_id : m.from_id));
  const unread = await sql`select from_id, count(*)::int as n from messages where to_id = ${u.id} and not read group by from_id`;
  const users = await sql`select * from users where id = any(${[...new Set(other.map(Number)), Number(u.id)]}::bigint[])`;
  const names = Object.fromEntries(users.map((x) => [x.id, x.username]));
  return {
    chats: top.map((m, i) => ({ u: names[other[i]], last: msgJson(m, names), unread: unread.find((x) => Number(x.from_id) === Number(other[i]))?.n ?? 0 })).filter((c) => c.u),
    who: Object.fromEntries(users.map((x) => [x.username, who(x)])),
  };
}

/** GET /chat?u=&after= — messages with one person; marks theirs as read. */
export async function thread(req) {
  const me = await requireUser(req);
  const q = query(req);
  const o = await userByName(q.get('u'));
  const after = q.get('after') ? Number(q.get('after')) || 0 : 0;
  const rows = await sql`select * from (select * from messages where ((from_id = ${me.id} and to_id = ${o.id}) or (from_id = ${o.id} and to_id = ${me.id})) and id > ${after}
    order by id desc limit 200) x order by id`;
  await sql`update messages set read = true where from_id = ${o.id} and to_id = ${me.id} and not read`;
  const names = { [me.id]: me.username, [o.id]: o.username };
  return { messages: rows.map((m) => msgJson(m, names)), who: { [o.username]: who(o) }, canMessage: await mayMessage(me, o) };
}

async function mayMessage(me, o) {
  if (Number(me.id) === Number(o.id) || (await blockedBetween(me.id, o.id))) return false;
  if (o.dms === 'everyone') return true;
  if (o.dms === 'friends' && (await areFriends(me.id, o.id))) return true;
  // People can always reply to someone who wrote to them first.
  const [r] = await sql`select 1 from messages where from_id = ${o.id} and to_id = ${me.id} limit 1`;
  return !!r;
}

/** POST /chat {u, text?, gif?} */
export async function sendMessage(req) {
  const me = await requireUser(req);
  const b = await readBody(req, 16 * 1024);
  const o = await userByName(b.u);
  await limit(`chat:${me.id}`, 600, 86400);
  await limit(`chatmin:${me.id}`, 40, 60);
  if (!(await mayMessage(me, o))) fail(403, o.dms === 'friends' ? `Only friends of @${o.username} can message them` : `@${o.username} isn't taking messages right now`);
  const text = body(b.text, 2000, 'message') || null;
  const gif = b.gif ? str(b.gif, { max: 400, name: 'GIF' }) : null;
  if (gif && !GIF.test(gif)) fail(400, 'Pick a GIF from the list');
  if (!text && !gif) fail(400, 'Write a message');
  const [waiting] = await sql`select 1 from messages where from_id = ${me.id} and to_id = ${o.id} and not read limit 1`;
  const [m] = await sql`insert into messages (from_id, to_id, text, gif) values (${me.id}, ${o.id}, ${text}, ${gif}) returning *`;
  if (!waiting) await notify(o.id, 'message', `${me.name || me.username} sent you a message`, { u: me.username });
  return { message: msgJson(m, { [me.id]: me.username, [o.id]: o.username }) };
}

// ---------------- stories ----------------
let delImpl = null;
export function useBlobDelete(fn) {
  delImpl = fn;
}
/** Removes uploaded files from storage. Best effort: a miss only leaves an unused file. */
async function removeFiles(urls) {
  const list = urls.filter((u) => BLOB_HOST.test(u));
  if (!list.length) return;
  try {
    if (delImpl) return await delImpl(list);
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    const { del } = await import('@vercel/blob');
    await del(list, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {}
}

/** Deletes stories whose timer has run out, photos included. */
export async function sweepStories() {
  const gone = await sql`delete from stories where id in (select id from stories where coalesce(expires_at, created_at + interval '24 hours') <= now() limit 200) returning image`;
  await removeFiles(gone.map((g) => g.image));
}

/** GET /stories — live stories from you, your friends and public accounts. */
export async function stories(req) {
  const u = await requireUser(req);
  await sweepStories();
  const rows = await sql`select s.*, x.username from stories s join users x on x.id = s.user_id
    where coalesce(s.expires_at, s.created_at + interval '24 hours') > now() and x.email_verified
      and not exists (select 1 from blocks b where (b.user_id = ${u.id} and b.blocked_id = s.user_id) or (b.user_id = s.user_id and b.blocked_id = ${u.id}))
      and (not x.private or s.user_id = ${u.id} or exists (select 1 from friendships f where f.a = least(${u.id}::bigint, s.user_id) and f.b = greatest(${u.id}::bigint, s.user_id)))
    order by s.id desc limit 300`;
  return {
    stories: rows.map((s) => ({ id: sid(s.id), u: s.username, i: s.image, c: s.caption, at: ms(s.created_at), until: ms(s.expires_at) })),
    who: await whoMap(rows.map((s) => s.user_id)),
  };
}

export const STORY_HOURS = [1, 3, 6, 12, 24, 48];

/** POST /stories {image, caption, hours} — the story and its photo are deleted when the timer ends. */
export async function addStory(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`story:${u.id}`, 30, 86400);
  const hours = b.hours == null ? 24 : Number(b.hours);
  if (!STORY_HOURS.includes(hours)) fail(400, 'Pick how long the story stays up');
  const [s] = await sql`insert into stories (user_id, image, caption, expires_at)
    values (${u.id}, ${mediaUrl(b.image)}, ${optText(b.caption, 200, 'caption')}, now() + make_interval(hours => ${hours}::int)) returning *`;
  return { story: { id: sid(s.id), u: u.username, i: s.image, c: s.caption, at: ms(s.created_at), until: ms(s.expires_at) } };
}

/** POST /stories/delete {id} */
export async function deleteStory(req) {
  const u = await requireUser(req);
  const gone = await sql`delete from stories where id = ${num((await readBody(req)).id)} and user_id = ${u.id} returning image`;
  await removeFiles(gone.map((g) => g.image));
  return { ok: true };
}

// ---------------- progress and settings ----------------
/** GET /me/state — learning progress and settings saved from your phones. */
export async function getState(req) {
  const u = await requireUser(req);
  const [r] = await sql`select data, updated_at from user_state where user_id = ${u.id}`;
  return { data: r?.data ?? null, at: r ? ms(r.updated_at) : 0 };
}

/** POST /me/state {data} — at most 64 KB. Never used for anything paid. */
export async function putState(req) {
  const u = await requireUser(req);
  const b = await readBody(req, 80 * 1024);
  await limit(`state:${u.id}`, 400, 86400);
  if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) fail(400, 'Bad request');
  const json = JSON.stringify(b.data);
  if (json.length > 64 * 1024) fail(413, 'Request too large');
  await sql`insert into user_state (user_id, data, updated_at) values (${u.id}, ${json}, now())
    on conflict (user_id) do update set data = excluded.data, updated_at = now()`;
  return { ok: true };
}

// ---------------- Ask a local ----------------
const country = (v) => {
  const s = str(v, { min: 2, max: 56, name: 'country' });
  if (!/^[\p{L} .'’()-]+$/u.test(s)) fail(400, 'Check the country');
  return s;
};

/** GET /locals?country= — questions with answers, and the locals ready to help. */
export async function locals(req) {
  const u = await requireUser(req);
  const c = country(query(req).get('country'));
  const qs = await sql`select q.*, x.username from local_questions q join users x on x.id = q.user_id
    where q.country = ${c} and x.email_verified
      and not exists (select 1 from blocks b where (b.user_id = ${u.id} and b.blocked_id = q.user_id) or (b.user_id = q.user_id and b.blocked_id = ${u.id}))
    order by q.id desc limit 100`;
  const ids = qs.map((q) => Number(q.id));
  const ans = ids.length
    ? await sql`select a.*, x.username, (select count(*)::int from answer_votes v where v.answer_id = a.id) as votes,
          exists(select 1 from answer_votes v where v.answer_id = a.id and v.user_id = ${u.id}) as mine
        from local_answers a join users x on x.id = a.user_id where a.question_id = any(${ids}::bigint[]) and x.email_verified
          and not exists (select 1 from blocks b where (b.user_id = ${u.id} and b.blocked_id = a.user_id) or (b.user_id = a.user_id and b.blocked_id = ${u.id}))
        order by a.id`
    : [];
  const helpers = await sql`select * from users where email_verified and local_helper and home_country = ${c} order by (premium_until > now()) desc nulls last, id desc limit 50`;
  return {
    questions: qs.map((q) => ({
      id: sid(q.id), by: q.username, c: q.country, t: q.topic, q: q.text, p: q.place_id, at: ms(q.created_at),
      a: ans.filter((a) => Number(a.question_id) === Number(q.id)).map((a) => ({ id: sid(a.id), by: a.username, x: a.text, at: ms(a.created_at), v: a.votes, mv: a.mine })),
    })),
    helpers: helpers.map(who),
    who: await whoMap([...qs.map((q) => q.user_id), ...ans.map((a) => a.user_id), ...helpers.map((h) => h.id)]),
  };
}

/** POST /locals/questions {country, topic, text, place?} — locals of that country are told. */
export async function ask(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`ask:${u.id}`, 20, 86400);
  const c = country(b.country);
  const [q] = await sql`insert into local_questions (user_id, country, topic, text, place_id)
    values (${u.id}, ${c}, ${optText(b.topic, 40, 'topic')}, ${body(b.text, 600, 'question') || fail(400, 'Write your question')}, ${placeId(b.place)}) returning *`;
  const helpers = await sql`select id from users where email_verified and local_helper and home_country = ${c} and id <> ${u.id} order by random() limit 30`;
  for (const h of helpers) await notify(h.id, 'social', `New question about ${c}: “${q.text.slice(0, 80)}”`, { question: sid(q.id), country: c });
  return { question: { id: sid(q.id), by: u.username, c, t: q.topic, q: q.text, p: q.place_id, at: ms(q.created_at), a: [] } };
}

/** POST /locals/answers {id, text} — locals of that country, and the person who asked. */
export async function answer(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`answer:${u.id}`, 100, 86400);
  const [q] = await sql`select * from local_questions where id = ${num(b.id, 'question')}`;
  if (!q) fail(404, 'That question is no longer available');
  if (await blockedBetween(u.id, q.user_id)) fail(404, 'That question is no longer available');
  const local = u.local_helper && u.home_country === q.country;
  if (!local && Number(q.user_id) !== Number(u.id)) fail(403, `Only locals who live in ${q.country} can answer. Set where you live in Edit profile.`);
  const text = body(b.text, 1500, 'answer') || fail(400, 'Write your answer');
  const [a] = await sql`insert into local_answers (question_id, user_id, text) values (${q.id}, ${u.id}, ${text}) returning *`;
  if (Number(q.user_id) !== Number(u.id)) await notify(q.user_id, 'social', `${u.name || u.username}, a local in ${q.country}, answered your question`, { question: sid(q.id) });
  return { answer: { id: sid(a.id), by: u.username, x: a.text, at: ms(a.created_at), v: 0, mv: false } };
}

/** POST /locals/vote {id, helpful} */
export async function vote(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const [a] = await sql`select user_id from local_answers where id = ${num(b.id, 'answer')}`;
  if (!a) fail(404, 'That answer is no longer available');
  if (Number(a.user_id) === Number(u.id)) fail(400, 'You cannot vote for your own answer');
  if (b.helpful === false) await sql`delete from answer_votes where answer_id = ${num(b.id)} and user_id = ${u.id}`;
  else await sql`insert into answer_votes (answer_id, user_id) values (${num(b.id)}, ${u.id}) on conflict do nothing`;
  return { ok: true };
}

/** POST /locals/delete {kind: question|answer, id} — your own only. */
export async function deleteLocal(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  if (b.kind === 'answer') await sql`delete from local_answers where id = ${num(b.id)} and user_id = ${u.id}`;
  else await sql`delete from local_questions where id = ${num(b.id)} and user_id = ${u.id}`;
  return { ok: true };
}

/** Called when an account is deleted: removes everything they shared. */
export async function wipe(userId) {
  await sql`delete from groups where owner_id = ${userId}`;
  await sql`delete from posts where user_id = ${userId}`;
  await sql`delete from comments where user_id = ${userId}`;
  const shots = await sql`delete from stories where user_id = ${userId} returning image`;
  await removeFiles(shots.map((g) => g.image));
  await sql`delete from user_state where user_id = ${userId}`;
  await sql`delete from local_questions where user_id = ${userId}`;
  await sql`delete from local_answers where user_id = ${userId}`;
  await sql`delete from messages where from_id = ${userId} or to_id = ${userId}`;
  await sql`delete from group_members where user_id = ${userId}`;
  await sql`delete from friendships where a = ${userId} or b = ${userId}`;
  await sql`delete from friend_requests where from_id = ${userId} or to_id = ${userId}`;
  await sql`delete from post_reactions where user_id = ${userId}`;
  await sql`delete from post_saves where user_id = ${userId}`;
  await sql`delete from comment_likes where user_id = ${userId}`;
  await sql`delete from answer_votes where user_id = ${userId}`;
}
