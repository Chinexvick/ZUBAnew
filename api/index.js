// AfriT Hub API. One function, explicit routes, JSON only, no browser CORS.
import { HttpError, send } from '../lib/core.js';
import * as h from '../lib/handlers.js';
import * as ai from '../lib/ai.js';
import { roomToken } from '../lib/rooms.js';
import * as live from '../lib/live.js';
import * as so from '../lib/social.js';
import * as ledger from '../lib/ledger.js';
import * as party from '../lib/party.js';
import * as gifs from '../lib/gifs.js';
import * as food from '../lib/food.js';
import * as gc from '../lib/groupchat.js';

const routes = {
  'POST /auth/signup': h.signup,
  'POST /auth/verify': h.verifyEmail,
  'POST /auth/resend': h.resendCode,
  'POST /auth/login': h.login,
  'POST /auth/refresh': h.refresh,
  'POST /auth/logout': h.logout,
  'POST /auth/forgot': h.forgot,
  'POST /auth/reset': h.reset,
  'GET /me': h.me,
  'PATCH /me': h.updateMe,
  'POST /wallet/challenge': h.walletChallenge,
  'POST /wallet/link': h.walletLink,
  'GET /price': h.price,
  'POST /pay/invoice': h.createInvoice,
  'POST /pay/verify': h.verifyInvoice,
  'POST /pay/check': h.checkMyPayments,
  'GET /cron/payments': h.reconcileAll,
  'GET /notifications': h.notifications,
  'POST /notifications/read': h.readNotifications,
  'GET /referrals': h.referrals,
  'GET /admin/referrals': h.adminReferrals,
  'POST /admin/referrals/paid': h.adminReferralsPaid,
  'POST /ai/speak': ai.speak,
  'POST /ai/talk': ai.talk,
  'POST /ai/lesson': ai.lesson,
  'POST /ai/report': ai.report,
  'POST /rooms/token': roomToken,
  'POST /live/start': live.start,
  'GET /live': live.list,
  'POST /live/end': live.end,
  'POST /auth/logout-all': h.logoutAll,
  'POST /me/delete': h.deleteMe,
  'POST /media': so.upload,
  'GET /gifs': gifs.search,
  'GET /groups/chat': gc.list,
  'POST /groups/chat': gc.send,
  'POST /groups/chat/react': gc.react,
  'POST /groups/chat/delete': gc.remove,
  'POST /groups/chat/pin': gc.pin,
  'POST /groups/chat/vote': gc.vote,
  'POST /groups/chat/typing': gc.typing,
  'POST /groups/chat/read': gc.read,
  'POST /groups/chat/tip': gc.tip,
  'POST /groups/chat/task/done': gc.taskDone,
  'POST /groups/chat/task/review': gc.taskReview,
  'GET /groups/unread': gc.unread,
  'GET /groups/media': gc.media,
  'POST /groups/settings': gc.settings,
  'POST /groups/mute': gc.mute,
  'POST /groups/invite': gc.invite,
  'POST /groups/join-link': gc.joinByLink,
  'GET /food': food.list,
  'GET /food/place': food.place,
  'GET /food/mine': food.mine,
  'GET /food/orders': food.myOrders,
  'POST /food/restaurant': food.saveRestaurant,
  'POST /food/item': food.saveItem,
  'POST /food/item/delete': food.deleteItem,
  'POST /food/order': food.order,
  'POST /food/order/paid': food.paid,
  'POST /food/order/status': food.setStatus,
  'GET /me/state': so.getState,
  'POST /me/state': so.putState,
  'POST /wallet/tx': ledger.record,
  'GET /wallet/txs': ledger.list,
  'GET /party': party.list,
  'POST /party': party.create,
  'POST /party/join': party.join,
  'POST /party/end': party.end,
  'POST /party/paid': party.paid,
  'POST /admin/voice-check': ai.voiceCheck,
  'POST /ai/live': ai.live,
  'POST /ai/translate': ai.translate,
  'GET /feed': so.feed,
  'GET /post': so.post,
  'POST /posts': so.createPost,
  'POST /posts/edit': so.editPost,
  'POST /posts/delete': so.deletePost,
  'POST /posts/react': so.react,
  'POST /posts/save': so.save,
  'POST /posts/share': so.share,
  'POST /comments': so.comment,
  'POST /comments/delete': so.deleteComment,
  'POST /comments/like': so.likeComment,
  'GET /users': so.search,
  'GET /user': so.profile,
  'GET /friends': so.friends,
  'POST /friends/request': so.friendRequest,
  'POST /friends/accept': so.friendAccept,
  'POST /friends/decline': so.friendDecline,
  'POST /friends/remove': so.friendRemove,
  'POST /block': so.block,
  'GET /blocks': so.blocks,
  'POST /report': so.report,
  'GET /groups': so.groups,
  'POST /groups': so.createGroup,
  'POST /groups/join': so.joinGroup,
  'POST /groups/leave': so.leaveGroup,
  'GET /groups/members': so.groupMembers,
  'POST /groups/admin': so.setAdmin,
  'POST /groups/approve': so.approve,
  'POST /groups/remove': so.removeMember,
  'POST /groups/delete': so.deleteGroup,
  'GET /chats': so.chats,
  'GET /chat': so.thread,
  'POST /chat': so.sendMessage,
  'GET /stories': so.stories,
  'POST /stories': so.addStory,
  'POST /stories/delete': so.deleteStory,
  'GET /locals': so.locals,
  'POST /locals/questions': so.ask,
  'POST /locals/answers': so.answer,
  'POST /locals/vote': so.vote,
  'POST /locals/delete': so.deleteLocal,
};

/** A small page for group invite links shared outside the app. */
function invitePage(res, code) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Join a group on AfriT Hub</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#10331f;color:#fff;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box;text-align:center}
.c{max-width:360px}h1{font-size:24px;margin:0 0 8px}p{color:#cfe3d3;line-height:1.5}code{display:block;background:#fff;color:#10331f;font-size:22px;font-weight:800;padding:14px;border-radius:14px;margin:18px 0;letter-spacing:1px;word-break:break-all}
a{display:inline-block;background:#f5c518;color:#10331f;font-weight:800;padding:14px 22px;border-radius:30px;text-decoration:none}</style></head>
<body><div class="c"><h1>You're invited to a group</h1><p>Open AfriT Hub, go to Connect &rarr; Groups &rarr; Join with link, and paste this code:</p><code>${code}</code>
<p>Don't have the app yet? Ask the person who invited you for the AfriT Hub download link.</p></div></body></html>`);
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return send(res, 405, { error: 'Not allowed' });
    const m = path.match(/^\/users\/([^/]+)\/wallet$/);
    if (req.method === 'GET' && m) return send(res, 200, await h.walletOf(req, decodeURIComponent(m[1])));
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
    const inv = path.match(/^\/g\/([A-Za-z0-9_-]{8,20})$/);
    if (req.method === 'GET' && inv) return invitePage(res, inv[1]);
    const fn = routes[`${req.method} ${path}`];
    if (!fn) return send(res, 404, { error: 'Not found' });
    return send(res, 200, await fn(req));
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
    console.error('api error', e?.message);
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
