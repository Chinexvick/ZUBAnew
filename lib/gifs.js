// GIF search goes through the server so the GIPHY key never ships inside the app.
import { fail, limit, requireUser } from './core.js';

const clean = (u) => (typeof u === 'string' && /^https:\/\/(media\d?|i)\.giphy\.com\//.test(u) ? u.split('?')[0] : null);

/** GET /gifs?q= — trending when q is empty. */
export async function search(req) {
  const u = await requireUser(req);
  await limit(`gifs:${u.id}`, 300, 3600);
  const key = process.env.GIPHY_API_KEY;
  if (!key) fail(503, 'GIF search is not switched on yet');
  const q = String(new URL(req.url, 'http://x').searchParams.get('q') || '').trim().slice(0, 50);
  const url = new URL(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}`);
  url.search = new URLSearchParams({ api_key: key, limit: '30', rating: 'pg-13', ...(q ? { q } : {}) }).toString();
  let r;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    fail(503, 'GIFs are taking a moment. Try again.');
  }
  if (!r.ok) fail(503, 'GIFs are taking a moment. Try again.');
  const data = (await r.json()).data || [];
  return {
    gifs: data
      .map((g) => ({ p: clean(g.images?.fixed_width_small?.url || g.images?.fixed_width?.url), f: clean(g.images?.fixed_width?.url) }))
      .filter((g) => g.p && g.f),
  };
}
