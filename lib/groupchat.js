// Group chat rooms: messages, replies, reactions, polls, pinned messages, read receipts,
// typing, topics, slow mode, mutes, invite links, ZUBA tips and raid tasks.
// Tips and task rewards are paid from the sender's own wallet and checked on the blockchain.
import crypto from 'node:crypto';
import { sql } from './db.js';
import { fail, limit, readBody, requireUser, str } from './core.js';
import { mediaUrl, role, who } from './social.js';
import { checkPayment } from './chain.js';

const isAdmin = (r) => r === 'owner' || r === 'admin';
const sid = (n) => (n == null ? null : 'srv:' + n);
const num = (v, name = 'id') => {
  const m = /^(?:srv:)?(\d{1,15})$/.exec(String(v ?? ''));
  if (!m) fail(400, `Check the ${name}`);
  return Number(m[1]);
};
const q = (req) => new URL(req.url, 'http://x').searchParams;
const GIF = /^https:\/\/(media\d?|i)\.giphy\.com\/[\w./-]+$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const EMOJI = ['❤️', '😂', '😮', '😢', '🙏', '🔥', '👍', '🎉'];
function body(v, max, name) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string') fail(400, `Check your ${name}`);
  const s = v.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (s.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)) fail(400, `Check your ${name}`);
  return s;
}

async function group(id) {
  const [g] = await sql`select * from groups where id = ${id}`;
  if (!g) fail(404, 'That group is no longer available');
  return g;
}
/** Members only (not people still waiting for approval). */
async function member(req, id) {
  const u = await requireUser(req);
  const g = await group(id);
  const r = await role(g.id, u.id);
  if (!r || r === 'pending') fail(403, 'Join the group to see the chat');
  return { u, g, r };
}

async function msgJson(rows, me, groupId) {
  if (!rows.length) return { messages: [], who: {} };
  const ids = rows.map((m) => Number(m.id));
  const [reacts, votes, claims, reads] = await Promise.all([
    sql`select msg_id, emoji, count(*)::int as n, bool_or(user_id = ${me}) as mine from group_msg_reactions where msg_id = any(${ids}::bigint[]) group by msg_id, emoji`,
    sql`select msg_id, option, count(*)::int as n, bool_or(user_id = ${me}) as mine from poll_votes where msg_id = any(${ids}::bigint[]) group by msg_id, option`,
    sql`select c.msg_id, c.status, c.proof, c.paid_tx, x.username from task_claims c join users x on x.id = c.user_id where c.msg_id = any(${ids}::bigint[]) order by c.created_at`,
    sql`select last_read from group_reads where group_id = ${groupId} and user_id <> ${me}`,
  ]);
  const userIds = [...new Set(rows.map((m) => Number(m.user_id)))];
  const users = await sql`select * from users where id = any(${userIds}::bigint[])`;
  const names = Object.fromEntries(users.map((x) => [x.id, x.username]));
  const replyIds = rows.map((m) => m.reply_to).filter(Boolean).map(Number);
  const replies = replyIds.length ? await sql`select m.id, m.text, m.kind, x.username from group_messages m join users x on x.id = m.user_id where m.id = any(${replyIds}::bigint[])` : [];
  return {
    messages: rows.map((m) => {
      const id = Number(m.id);
      const r = replies.find((x) => Number(x.id) === Number(m.reply_to));
      return {
        id, u: names[m.user_id], k: m.kind, t: m.deleted ? null : m.text, g: m.deleted ? null : m.gif, i: m.deleted ? null : m.image, v: m.deleted ? null : m.voice, vs: m.voice_secs,
        topic: m.topic, del: m.deleted, at: new Date(m.created_at).getTime(), data: m.deleted ? null : m.data,
        re: r ? { id: Number(r.id), u: r.username, t: r.kind === 'text' ? (r.text || '').slice(0, 120) : r.kind } : null,
        r: Object.fromEntries(reacts.filter((x) => Number(x.msg_id) === id).map((x) => [x.emoji, x.n])),
        mr: reacts.find((x) => Number(x.msg_id) === id && x.mine)?.emoji ?? null,
        poll: m.kind === 'poll' ? { counts: (m.data?.options || []).map((_, i) => votes.find((v) => Number(v.msg_id) === id && v.option === i)?.n ?? 0), mine: votes.find((v) => Number(v.msg_id) === id && v.mine)?.option ?? null } : undefined,
        claims: m.kind === 'task' ? claims.filter((c) => Number(c.msg_id) === id).map((c) => ({ u: c.username, s: c.status, p: c.proof, tx: c.paid_tx })) : undefined,
        seen: Number(m.user_id) === Number(me) ? reads.filter((x) => Number(x.last_read) >= id).length : undefined,
      };
    }),
    who: Object.fromEntries(users.map((x) => [x.username, who(x)])),
  };
}

/** GET /groups/chat?id=&after=&before=&topic= — newest 80 messages, or the ones after a known id. */
export async function list(req) {
  const p = q(req);
  const { u, g, r } = await member(req, num(p.get('id'), 'group'));
  const after = Number(p.get('after')) || 0;
  const before = Number(p.get('before')) || 0;
  const topic = p.get('topic') ? body(p.get('topic'), 30, 'topic') : null;
  // Newer messages read forwards from a known id; otherwise the latest 80 (or 80 before an id).
  const rows = after
    ? await sql`select * from group_messages where group_id = ${g.id} and (${topic}::text is null or topic = ${topic}) and id > ${after} order by id limit 80`
    : await sql`select * from (select * from group_messages where group_id = ${g.id} and (${topic}::text is null or topic = ${topic})
        and (${before} = 0 or id < ${before}) order by id desc limit 80) x order by id`;
  const out = await msgJson(rows, u.id, g.id);
  const typing = await sql`select x.username from group_typing t join users x on x.id = t.user_id
    where t.group_id = ${g.id} and t.user_id <> ${u.id} and t.at > now() - interval '6 seconds' limit 5`;
  const pinned = g.pinned_msg ? (await msgJson(await sql`select * from group_messages where id = ${g.pinned_msg} and not deleted`, u.id, g.id)).messages[0] ?? null : null;
  const [mute] = await sql`select until from group_mutes where group_id = ${g.id} and user_id = ${u.id} and until > now()`;
  return {
    ...out, typing: typing.map((x) => x.username), pinned, role: r,
    settings: { slow: g.slow_secs, posting: g.posting, topics: g.topics || [] }, mutedUntil: mute ? new Date(mute.until).getTime() : null,
  };
}

const notify = (userId, text, data) => sql`insert into notifications (user_id, kind, text, data) values (${userId}, 'group', ${text}, ${JSON.stringify(data)})`;

/** POST /groups/chat {id, text?, gif?, image?, voice?, voiceSecs?, replyTo?, topic?, poll?, task?} */
export async function send(req) {
  const b = await readBody(req, 16 * 1024);
  const { u, g, r } = await member(req, num(b.id, 'group'));
  await limit(`gchat:${u.id}`, 1500, 86400);
  await limit(`gchatmin:${u.id}`, 30, 60);
  const [mute] = await sql`select 1 from group_mutes where group_id = ${g.id} and user_id = ${u.id} and until > now()`;
  if (mute) fail(403, 'An admin has muted you in this group for a while');
  if (g.posting === 'admins' && !isAdmin(r)) fail(403, 'Only admins can post in this group');
  if (g.slow_secs > 0 && !isAdmin(r)) {
    const [last] = await sql`select created_at from group_messages where group_id = ${g.id} and user_id = ${u.id} order by id desc limit 1`;
    const wait = last ? g.slow_secs - (Date.now() - new Date(last.created_at).getTime()) / 1000 : 0;
    if (wait > 0) fail(429, `Slow mode is on. You can send again in ${Math.ceil(wait)}s`);
  }
  const topics = g.topics || [];
  const topic = b.topic ? body(b.topic, 30, 'topic') : 'General';
  if (topic !== 'General' && !topics.includes(topic)) fail(400, 'Pick a topic from the list');
  let kind = 'text';
  let data = null;
  const text = body(b.text, 4000, 'message') || null;
  const gif = b.gif ? str(b.gif, { max: 400, name: 'GIF' }) : null;
  if (gif && !GIF.test(gif)) fail(400, 'Pick a GIF from the list');
  const image = b.image ? mediaUrl(b.image) : null;
  const voice = b.voice ? mediaUrl(b.voice, 'voice note') : null;
  if (b.poll) {
    const question = body(b.poll.question, 200, 'question');
    const options = Array.isArray(b.poll.options) ? b.poll.options.map((o) => body(o, 80, 'option')).filter(Boolean) : [];
    if (!question || options.length < 2 || options.length > 8) fail(400, 'A poll needs a question and 2 to 8 options');
    kind = 'poll';
    data = { question, options, multi: false };
  } else if (b.task) {
    if (!isAdmin(r)) fail(403, 'Only admins can post tasks');
    const title = body(b.task.title, 200, 'task');
    const link = b.task.link ? str(b.task.link, { max: 300, name: 'link' }) : '';
    if (link && !/^https:\/\/[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(link)) fail(400, 'Check the link');
    const reward = Number(b.task.reward);
    if (!title || !Number.isFinite(reward) || reward < 0 || reward > 1e12) fail(400, 'Give the task a title and a reward');
    const slots = Math.max(1, Math.min(500, Number(b.task.slots) || 50));
    kind = 'task';
    data = { title, link, reward, slots };
  } else if (!text && !gif && !image && !voice) fail(400, 'Write a message');
  const replyTo = b.replyTo ? num(b.replyTo, 'message') : null;
  if (replyTo) {
    const [x] = await sql`select 1 from group_messages where id = ${replyTo} and group_id = ${g.id}`;
    if (!x) fail(400, 'That message is no longer here');
  }
  const [m] = await sql`insert into group_messages (group_id, user_id, kind, text, gif, image, voice, voice_secs, reply_to, topic, data)
    values (${g.id}, ${u.id}, ${kind}, ${text}, ${gif}, ${image}, ${voice}, ${Math.max(0, Math.min(Number(b.voiceSecs) || 0, 600)) | 0}, ${replyTo}, ${topic}, ${data ? JSON.stringify(data) : null}) returning *`;
  await sql`insert into group_reads (group_id, user_id, last_read) values (${g.id}, ${u.id}, ${m.id}) on conflict (group_id, user_id) do update set last_read = greatest(group_reads.last_read, excluded.last_read)`;
  await sql`delete from group_typing where group_id = ${g.id} and user_id = ${u.id}`;
  // @mentions and replies notify; ordinary messages do not, so big groups stay quiet.
  const mentioned = [...new Set(String(text || '').match(/@([a-z0-9._]{3,30})/gi)?.map((x) => x.slice(1).toLowerCase()) || [])].slice(0, 10);
  const targets = mentioned.length
    ? await sql`select u.id from users u join group_members gm on gm.user_id = u.id and gm.group_id = ${g.id} and gm.role <> 'pending' where u.username = any(${mentioned}::text[]) and u.id <> ${u.id}`
    : [];
  for (const t of targets) await notify(t.id, `${u.name || u.username} mentioned you in ${g.name}`, { group: sid(g.id), msg: Number(m.id) });
  if (replyTo) {
    const [o] = await sql`select user_id from group_messages where id = ${replyTo}`;
    if (o && Number(o.user_id) !== Number(u.id) && !targets.some((t) => Number(t.id) === Number(o.user_id))) await notify(o.user_id, `${u.name || u.username} replied to you in ${g.name}`, { group: sid(g.id), msg: Number(m.id) });
  }
  return (await msgJson([m], u.id, g.id)).messages[0];
}

async function msgFor(req, msgId) {
  const u = await requireUser(req);
  const [m] = await sql`select * from group_messages where id = ${msgId}`;
  if (!m) fail(404, 'That message is no longer here');
  const r = await role(m.group_id, u.id);
  if (!r || r === 'pending') fail(403, 'Join the group first');
  return { u, m, r };
}

/** POST /groups/chat/react {msg, emoji|null} */
export async function react(req) {
  const b = await readBody(req);
  const { u, m } = await msgFor(req, num(b.msg, 'message'));
  await limit(`greact:${u.id}`, 1000, 3600);
  if (!b.emoji) await sql`delete from group_msg_reactions where msg_id = ${m.id} and user_id = ${u.id}`;
  else {
    if (!EMOJI.includes(b.emoji)) fail(400, 'Pick a reaction from the list');
    await sql`insert into group_msg_reactions (msg_id, user_id, emoji) values (${m.id}, ${u.id}, ${b.emoji}) on conflict (msg_id, user_id) do update set emoji = excluded.emoji`;
  }
  return { ok: true };
}

/** POST /groups/chat/delete {msg} — your own, or anyone's if you are an admin. */
export async function remove(req) {
  const b = await readBody(req);
  const { u, m, r } = await msgFor(req, num(b.msg, 'message'));
  if (Number(m.user_id) !== Number(u.id) && !isAdmin(r)) fail(403, 'You can only delete your own messages');
  await sql`update group_messages set deleted = true, text = null, gif = null, image = null, voice = null, data = null where id = ${m.id}`;
  await sql`update groups set pinned_msg = null where pinned_msg = ${m.id}`;
  return { ok: true };
}

/** POST /groups/chat/pin {id, msg|null} — admins pin one message to the top. */
export async function pin(req) {
  const b = await readBody(req);
  const { g, r } = await member(req, num(b.id, 'group'));
  if (!isAdmin(r)) fail(403, 'Only admins can pin messages');
  let msg = null;
  if (b.msg) {
    msg = num(b.msg, 'message');
    const [x] = await sql`select 1 from group_messages where id = ${msg} and group_id = ${g.id} and not deleted`;
    if (!x) fail(404, 'That message is no longer here');
  }
  await sql`update groups set pinned_msg = ${msg} where id = ${g.id}`;
  return { ok: true };
}

/** POST /groups/chat/vote {msg, option} — one vote per person; voting again changes it. */
export async function vote(req) {
  const b = await readBody(req);
  const { u, m } = await msgFor(req, num(b.msg, 'message'));
  if (m.kind !== 'poll' || m.deleted) fail(400, 'That is not a poll');
  const o = Number(b.option);
  if (!Number.isInteger(o) || o < 0 || o >= (m.data?.options || []).length) fail(400, 'Pick an option');
  await sql`insert into poll_votes (msg_id, user_id, option) values (${m.id}, ${u.id}, ${o}) on conflict (msg_id, user_id) do update set option = excluded.option`;
  return { ok: true };
}

/** POST /groups/chat/typing {id} */
export async function typing(req) {
  const b = await readBody(req);
  const { u, g } = await member(req, num(b.id, 'group'));
  await sql`insert into group_typing (group_id, user_id, at) values (${g.id}, ${u.id}, now()) on conflict (group_id, user_id) do update set at = now()`;
  return { ok: true };
}

/** POST /groups/chat/read {id, last} */
export async function read(req) {
  const b = await readBody(req);
  const { u, g } = await member(req, num(b.id, 'group'));
  const last = Number(b.last) || 0;
  await sql`insert into group_reads (group_id, user_id, last_read) values (${g.id}, ${u.id}, ${last}) on conflict (group_id, user_id) do update set last_read = greatest(group_reads.last_read, excluded.last_read)`;
  return { ok: true };
}

/** GET /groups/unread — unread counts for your groups, for the chat list. */
export async function unread(req) {
  const u = await requireUser(req);
  const rows = await sql`select gm.group_id,
      (select count(*)::int from group_messages m where m.group_id = gm.group_id and m.user_id <> ${u.id} and not m.deleted and m.id > coalesce(r.last_read, 0)) as n,
      (select max(id) from group_messages m where m.group_id = gm.group_id) as last
    from group_members gm left join group_reads r on r.group_id = gm.group_id and r.user_id = gm.user_id
    where gm.user_id = ${u.id} and gm.role <> 'pending'`;
  return { unread: Object.fromEntries(rows.map((r) => [sid(r.group_id), { n: Math.min(r.n, 999), last: Number(r.last) || 0 }])) };
}

/** POST /groups/settings {id, slow?, posting?, topics?} — admins. */
export async function settings(req) {
  const b = await readBody(req);
  const { g, r } = await member(req, num(b.id, 'group'));
  if (!isAdmin(r)) fail(403, 'Only admins can change group settings');
  const slow = b.slow === undefined ? g.slow_secs : Number(b.slow);
  if (![0, 10, 30, 60, 300, 900].includes(slow)) fail(400, 'Check slow mode');
  const posting = b.posting === undefined ? g.posting : b.posting;
  if (!['all', 'admins'].includes(posting)) fail(400, 'Check who can post');
  let topics = g.topics || [];
  if (b.topics !== undefined) {
    if (!Array.isArray(b.topics) || b.topics.length > 12) fail(400, 'Up to 12 topics');
    topics = [...new Set(b.topics.map((t) => body(t, 30, 'topic')).filter((t) => t && t !== 'General'))];
  }
  await sql`update groups set slow_secs = ${slow}, posting = ${posting}, topics = ${JSON.stringify(topics)} where id = ${g.id}`;
  return { settings: { slow, posting, topics } };
}

/** POST /groups/mute {id, u, minutes} — admins mute a member (0 unmutes). */
export async function mute(req) {
  const b = await readBody(req);
  const { g, r } = await member(req, num(b.id, 'group'));
  if (!isAdmin(r)) fail(403, 'Only admins can mute people');
  const [o] = await sql`select id from users where username = ${String(b.u || '')}`;
  if (!o) fail(404, 'We could not find that person');
  const theirs = await role(g.id, o.id);
  if (isAdmin(theirs) && r !== 'owner') fail(403, 'Only the owner can mute admins');
  if (theirs === 'owner') fail(403, 'Nobody can mute the owner');
  const minutes = Number(b.minutes);
  if (![0, 60, 480, 1440, 10080].includes(minutes)) fail(400, 'Check how long');
  if (!minutes) await sql`delete from group_mutes where group_id = ${g.id} and user_id = ${o.id}`;
  else await sql`insert into group_mutes (group_id, user_id, until) values (${g.id}, ${o.id}, now() + make_interval(mins => ${minutes}::int))
    on conflict (group_id, user_id) do update set until = excluded.until`;
  return { ok: true };
}

/** POST /groups/invite {id, reset?} — a link anyone can use to join, even a private group. Admins only. */
export async function invite(req) {
  const b = await readBody(req);
  const { g, r } = await member(req, num(b.id, 'group'));
  if (!isAdmin(r)) fail(403, 'Only admins can share invite links');
  let code = g.invite_code;
  if (!code || b.reset) {
    code = crypto.randomBytes(9).toString('base64url');
    await sql`update groups set invite_code = ${code} where id = ${g.id}`;
  }
  return { code, link: `https://afrit-api.vercel.app/g/${code}` };
}

/** POST /groups/join-link {code} */
export async function joinByLink(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  await limit(`glink:${u.id}`, 30, 3600);
  const code = String(b.code || '').trim().split('/').pop();
  if (!/^[A-Za-z0-9_-]{8,20}$/.test(code)) fail(400, 'Check the invite link');
  const [g] = await sql`select * from groups where invite_code = ${code}`;
  if (!g) fail(404, 'That invite link has expired');
  await sql`insert into group_members (group_id, user_id, role) values (${g.id}, ${u.id}, 'member')
    on conflict (group_id, user_id) do update set role = case when group_members.role = 'pending' then 'member' else group_members.role end`;
  return { id: sid(g.id), name: g.name };
}

/** POST /groups/chat/tip {msg, hash} — after sending ZUBA to the author, shows the tip in the chat. */
export async function tip(req) {
  const b = await readBody(req);
  const { u, m } = await msgFor(req, num(b.msg, 'message'));
  await limit(`gtip:${u.id}`, 200, 86400);
  const hash = String(b.hash || '').toLowerCase();
  if (!HASH.test(hash)) fail(400, 'Check the transaction hash');
  const [used] = await sql`select 1 from group_messages where kind = 'tip' and data->>'hash' = ${hash} limit 1`;
  if (used) return { ok: true };
  const [from] = await sql`select lower(address::text) as a from wallets where user_id = ${u.id}`;
  const [to] = await sql`select lower(address::text) as a, x.username, x.name from wallets w join users x on x.id = w.user_id where w.user_id = ${m.user_id}`;
  if (!from || !to) fail(400, 'Both of you need a wallet for tips');
  const c = await checkPayment(hash, from.a, new Date(Date.now() - 3600000).getTime(), 1, null, to.a);
  if (c.status === 'pending') return { status: 'pending' };
  if (c.status === 'bad') fail(400, c.reason);
  const zubaAmount = (c.received / 10n ** 9n).toString();
  await sql`insert into group_messages (group_id, user_id, kind, reply_to, topic, data)
    values (${m.group_id}, ${u.id}, 'tip', ${m.id}, ${m.topic}, ${JSON.stringify({ hash, to: to.username, amount: zubaAmount })})`;
  await notify(m.user_id, `${u.name || u.username} tipped you ${Number(zubaAmount).toLocaleString('en-US')} ZUBA`, { msg: Number(m.id) });
  return { ok: true, amount: zubaAmount };
}

/** POST /groups/chat/task/done {msg, proof} — a member says they did a task. */
export async function taskDone(req) {
  const b = await readBody(req);
  const { u, m } = await msgFor(req, num(b.msg, 'message'));
  if (m.kind !== 'task' || m.deleted) fail(400, 'That is not a task');
  const proof = body(b.proof, 300, 'proof');
  const [n] = await sql`select count(*)::int as n from task_claims where msg_id = ${m.id} and status <> 'rejected'`;
  if (n.n >= (m.data?.slots || 50)) fail(400, 'This task is full');
  await sql`insert into task_claims (msg_id, user_id, proof) values (${m.id}, ${u.id}, ${proof}) on conflict (msg_id, user_id) do nothing`;
  return { ok: true };
}

/** POST /groups/chat/task/review {msg, u, approve, hash?} — admins approve (and record the reward payment) or reject. */
export async function taskReview(req) {
  const b = await readBody(req);
  const { u, m, r } = await msgFor(req, num(b.msg, 'message'));
  if (!isAdmin(r)) fail(403, 'Only admins can review tasks');
  const [o] = await sql`select id from users where username = ${String(b.u || '')}`;
  if (!o) fail(404, 'We could not find that person');
  if (b.hash && !HASH.test(String(b.hash))) fail(400, 'Check the transaction hash');
  const status = b.approve === false ? 'rejected' : 'approved';
  const [c] = await sql`update task_claims set status = ${status}, paid_tx = ${b.hash ? String(b.hash).toLowerCase() : null}
    where msg_id = ${m.id} and user_id = ${o.id} and status = 'done' returning 1`;
  if (!c) fail(400, 'Nothing to review for that person');
  if (b.hash) await sql`insert into wallet_tx_pending (hash, user_id) values (${String(b.hash).toLowerCase()}, ${u.id}) on conflict do nothing`;
  await notify(o.id, status === 'approved' ? `Task approved: "${m.data?.title}". Your reward is on its way.` : `Task not approved: "${m.data?.title}"`, { msg: Number(m.id) });
  return { ok: true };
}
