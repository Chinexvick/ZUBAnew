import fs from 'node:fs';
const titles = JSON.parse(fs.readFileSync('titles.json', 'utf8'));
const UA = 'AfriTHubDataBuilder/1.0 (https://zubatoken.com; one-off dataset build)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STOP = /\n(See also|References|Notes|Further reading|External links|Gallery|Bibliography|Sources|Citations)\n/;
function clean(t) {
  t = t.split(STOP)[0].replace(/\s*\([^)]*listen[^)]*\)/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length > 3500) { const c = t.slice(0, 3500); t = c.slice(0, c.lastIndexOf('. ') + 1); }
  return t;
}
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.ok) return r.json();
    await sleep(3000 * (i + 1));
  }
  return null;
}
const out = {};
let ok = 0;
// Batch of up to 20 titles per request (extracts allows exlimit=20 with exintro off only one; so go one by one)
for (const [id, title] of titles) {
  const t = decodeURIComponent(title).replace(/_/g, ' ');
  const j = await get('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&formatversion=2&titles=' + encodeURIComponent(t));
  let text = j?.query?.pages?.[0]?.extract || '';
  if (!text) {
    const s = await get('https://en.wikipedia.org/api/rest_v1/page/summary/' + title);
    text = s?.extract || '';
  }
  out[id] = clean(text);
  if (out[id]) ok++;
  await sleep(250);
}
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/hist.json', JSON.stringify(out));
fs.writeFileSync('public/index.html', `<p>${ok} / ${titles.length}</p>`);
console.log('done', ok, titles.length);
