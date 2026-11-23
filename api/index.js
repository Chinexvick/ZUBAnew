// AfriT Hub API. One function, explicit routes, JSON only, no browser CORS.
import { HttpError, send } from '../lib/core.js';
import * as h from '../lib/handlers.js';
import * as ai from '../lib/ai.js';
import { roomToken } from '../lib/rooms.js';
import * as live from '../lib/live.js';
import * as so from '../lib/social.js';

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

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return send(res, 405, { error: 'Not allowed' });
    const m = path.match(/^\/users\/([^/]+)\/wallet$/);
    if (req.method === 'GET' && m) return send(res, 200, await h.walletOf(req, decodeURIComponent(m[1])));
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
    const fn = routes[`${req.method} ${path}`];
    if (!fn) return send(res, 404, { error: 'Not found' });
    return send(res, 200, await fn(req));
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
    console.error('api error', e?.message);
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
