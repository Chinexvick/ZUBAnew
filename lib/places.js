// Fresh, high-quality place photos from Google Places, with the photographer's credit.
// The key stays on the server. Costs are capped per day so there is never a surprise bill.
import { sql } from './db.js';
import { fail, limit, requireUser, safeEqual, str } from './core.js';

let gfetch = (...a) => fetch(...a);
export function useGoogleFetch(f) {
  gfetch = f;
}

const API = 'https://places.googleapis.com/v1';
const KEEP_HOURS = 24; // how long one photo link is reused before asking Google again
const dailyCap = () => Math.max(0, Number(process.env.GOOGLE_DAILY_CAP ?? 150));

function isAdmin(req) {
  const want = process.env.ADMIN_KEY || '';
  const got = String(req.headers['x-admin-key'] || '');
  return want.length >= 32 && got.length === want.length && safeEqual(got, want);
}

async function google(path, { method = 'GET', body, mask } = {}) {
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) fail(503, 'Place photos are not switched on');
  const headers = { 'X-Goog-Api-Key': key };
  if (mask) headers['X-Goog-FieldMask'] = mask;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await gfetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('google places', r.status, j?.error?.status || '');
    fail(502, 'Photo service is busy');
  }
  return j;
}

/** Finds the place on Google with its photos. Asks for the first few matches and keeps the first that has photos. */
async function search(q, lat, lng) {
  const body = { textQuery: q, pageSize: 3 };
  if (Number.isFinite(lat) && Number.isFinite(lng)) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 30000 } };
  const j = await google('/places:searchText', { method: 'POST', body, mask: 'places.id,places.displayName,places.photos' });
  const list = j.places || [];
  return list.find((x) => x.photos?.length) || list[0] || null;
}

/**
 * GET /places/photo?id=Q123&q=Name, Country&lat=&lng=&w=1200
 * → { url, by, byUrl, byPhoto } or 404 when Google has no photo.
 */
export async function photo(req) {
  const admin = isAdmin(req);
  const u = admin ? null : await requireUser(req);
  const p = new URL(req.url, 'http://x').searchParams;
  const id = str(p.get('id'), { min: 1, max: 40, name: 'place' });
  if (!/^[A-Za-z0-9_-]+$/.test(id)) fail(400, 'Bad place');
  const q = str(p.get('q'), { min: 2, max: 140, name: 'q' });
  const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
  const w = Math.min(1600, Math.max(200, Number(p.get('w')) || 1200));

  const [row] = await sql`select * from place_photos where place = ${id}`;
  const fresh = row?.uri && row.fetched_at && Date.now() - new Date(row.fetched_at).getTime() < KEEP_HOURS * 3600e3;
  if (fresh) return out(row);
  if (!(admin && p.get('debug') === '1') && row?.missing && row.fetched_at && Date.now() - new Date(row.fetched_at).getTime() < 7 * 86400e3) fail(404, 'No photo');

  if (u) await limit(`gphoto:${u.id}`, 300, 3600);
  // A hard daily ceiling on paid Google calls for the whole app.
  try {
    await limit('gphoto:all', dailyCap(), 86400);
  } catch {
    if (row?.uri) return out(row); // yesterday's link is better than none
    fail(503, 'Photo limit reached for today');
  }

  // A known place: ask for its photos directly. A new one: search, which returns photos too.
  let found = row?.gid ? await google(`/places/${encodeURIComponent(row.gid)}`, { mask: 'id,displayName,photos' }) : await search(q, lat, lng);
  if (row?.gid && !found?.photos?.length) found = (await search(q, lat, lng)) || found;
  if (admin && p.get('debug') === '1') {
    const raw = await google('/places:searchText', { method: 'POST', body: { textQuery: q, pageSize: 1 }, mask: 'places.id,places.photos,places.rating,places.googleMapsUri' });
    return { id: found?.id, name: found?.displayName?.text, photos: (found?.photos || []).length, raw: JSON.stringify(raw).slice(0, 600) };
  }
  const gid = found?.id || null;
  if (!gid) {
    await sql`insert into place_photos (place, missing, fetched_at) values (${id}, true, now())
      on conflict (place) do update set missing = true, fetched_at = now()`;
    fail(404, 'No photo');
  }
  const d = found;
  const ph = (d.photos || []).find((x) => (x.widthPx || 0) >= 600) || d.photos?.[0];
  if (!ph?.name) {
    await sql`insert into place_photos (place, gid, missing, fetched_at) values (${id}, ${gid}, true, now())
      on conflict (place) do update set gid = ${gid}, missing = true, fetched_at = now()`;
    fail(404, 'No photo');
  }
  const m = await google(`/${ph.name}/media?maxWidthPx=${w}&skipHttpRedirect=true`);
  const uri = String(m.photoUri || '');
  if (!/^https:\/\/[a-z0-9.-]+\.(googleusercontent|ggpht|google)\.com\//.test(uri)) fail(502, 'Photo service is busy');
  const a = ph.authorAttributions?.[0] || {};
  const httpsOrNull = (x) => (typeof x === 'string' && /^https:\/\//.test(x) ? x.slice(0, 500) : x && String(x).startsWith('//') ? 'https:' + String(x).slice(0, 500) : null);
  const [saved] = await sql`insert into place_photos (place, gid, uri, author, author_uri, author_photo, fetched_at, missing)
    values (${id}, ${gid}, ${uri}, ${String(a.displayName || '').slice(0, 80)}, ${httpsOrNull(a.uri)}, ${httpsOrNull(a.photoUri)}, now(), false)
    on conflict (place) do update set gid = excluded.gid, uri = excluded.uri, author = excluded.author, author_uri = excluded.author_uri,
      author_photo = excluded.author_photo, fetched_at = now(), missing = false
    returning *`;
  return out(saved);
}

const out = (r) => ({ url: r.uri, by: r.author || null, byUrl: r.author_uri || null, byPhoto: r.author_photo || null });
