// AfriT Hub API. One function, explicit routes, JSON only, no browser CORS.
import { HttpError, send } from '../lib/core.js';
import * as h from '../lib/handlers.js';

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
