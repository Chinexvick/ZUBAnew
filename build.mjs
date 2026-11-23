import fs from 'node:fs';
import sharp from 'sharp';
const titles = JSON.parse(fs.readFileSync('titles.json', 'utf8'));
const UA = 'AfriTHubDataBuilder/1.0 (https://zubatoken.com; one-off gallery build)';
const PER = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = /(map|flag|logo|locator|location|coat_of_arms|seal|icon|diagram|chart|plan|svg|signature|emblem|blank|relief|topographic)/i;
fs.mkdirSync('public/g', { recursive: true });
async function get(url, json = true) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      if (r.ok) return json ? r.json() : Buffer.from(await r.arrayBuffer());
      if (r.status === 404) return null;
    } catch {}
    await sleep(2000 * (i + 1));
  }
  return null;
}
const counts = {};
let done = 0, imgs = 0;
async function work([id, title]) {
  const j = await get('https://en.wikipedia.org/api/rest_v1/page/media-list/' + title);
  const items = (j?.items || []).filter((x) => x.type === 'image' && x.srcset?.length && !SKIP.test(x.title || ''));
  let n = 0;
  for (const it of items) {
    if (n >= PER) break;
    const best = it.srcset[it.srcset.length - 1].src;
    const url = best.startsWith('//') ? 'https:' + best : best;
    const buf = await get(url, false);
    if (!buf) continue;
    try {
      const img = sharp(buf);
      const m = await img.metadata();
      if ((m.width || 0) < 300 || (m.height || 0) < 200) continue;
      await img.rotate().resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 55 }).toFile(`public/g/${id}-${n}.webp`);
      n++; imgs++;
    } catch {}
    await sleep(150);
  }
  counts[id] = n;
  done++;
  if (done % 50 === 0) console.log('progress', done, imgs);
}
const queue = [...titles];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await work(queue.shift()); }));
fs.writeFileSync('public/gallery.json', JSON.stringify(counts));
fs.writeFileSync('public/index.html', `<p>${done} places, ${imgs} photos</p>`);
console.log('done', done, imgs);
