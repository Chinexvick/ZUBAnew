// Email templates in the ZUBA look: night-violet panels, rune lines, gold quest labels.
// Table layout + inline styles so they hold up in Gmail, Outlook and Apple Mail.
import type { DevNote } from "./content";
import { CONTRACT, site } from "./site";
import { siteUrl } from "./mailer";

const C = {
  night: "#0b0716",
  panel: "#140c26",
  panel2: "#1d1236",
  line: "#5b3a96",
  violet: "#b45cff",
  soft: "#e2b8ff",
  text: "#ece4fa",
  muted: "#a99bcc",
  gold: "#ffb627",
};
const TITLE = `'Josefin Sans','Futura','Trebuchet MS',Arial,sans-serif`;
const BODY = `'Raleway','Segoe UI',Helvetica,Arial,sans-serif`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* "ZUBA" → "ZUBΔ": the greatness symbol stands in for the letter A, as on the site. */
const delta = (s: string) => s.split(/(\s+)/).map((w) => (/zuba/i.test(w) ? w : w.replace(/(?<=[a-z])a|a(?=[a-z])/gi, "Δ"))).join("");

const runeLine = `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="width:70px;border-top:1px solid ${C.line};font-size:0;line-height:0">&nbsp;</td>
<td style="padding:0 10px;color:${C.violet};font-size:12px;line-height:12px">&#9670;</td>
<td style="width:70px;border-top:1px solid ${C.line};font-size:0;line-height:0">&nbsp;</td></tr></table>`;

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>
<td align="center" bgcolor="#6d28c9" style="border-radius:999px;border:1.5px solid #e3bcff;background:#6d28c9;background-image:linear-gradient(180deg,#9b46ff,#5a1eaa);box-shadow:0 0 18px rgba(180,80,255,.55)">
<a href="${href}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${TITLE};font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#ffffff;text-decoration:none;font-weight:700">${esc(label)}&nbsp;&#9656;</a>
</td></tr></table>`;
}

function label(text: string) {
  return `<div style="font-family:${TITLE};font-size:12px;letter-spacing:4px;text-transform:uppercase;color:${C.gold};font-weight:700">&#9670;&nbsp; ${esc(text)}</div>`;
}

function heading(text: string) {
  return `<h1 style="margin:14px 0 0;font-family:${TITLE};font-size:30px;line-height:1.2;letter-spacing:2px;text-transform:uppercase;color:#ffffff;font-weight:700;text-shadow:0 0 12px rgba(190,90,255,.8)">${esc(delta(text))}</h1>`;
}

function para(html: string) {
  return `<p style="margin:16px 0 0;font-family:${BODY};font-size:16px;line-height:1.7;color:${C.text}">${html}</p>`;
}

function list(items: string[], mark: string, color: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${items
    .map(
      (t) => `<tr><td valign="top" style="width:26px;padding:7px 0;color:${color};font-size:14px;font-family:${TITLE}">${mark}</td>
<td style="padding:7px 0;font-family:${BODY};font-size:15px;line-height:1.55;color:${C.text}">${esc(t)}</td></tr>`
    )
    .join("")}</table>`;
}

function panel(title: string, inner: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border:1px solid ${C.line};border-radius:12px;background:${C.panel2}">
<tr><td style="padding:18px 20px">
<div style="font-family:${TITLE};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.soft};font-weight:700;padding-bottom:6px">${esc(delta(title))}</div>
${inner}</td></tr></table>`;
}

function layout(opts: { preheader: string; banner: string; bannerAlt: string; body: string; unsubscribe?: string; reason?: string }) {
  const url = siteUrl();
  const socials = [
    ["X", site.socials.x.url],
    ["Telegram", site.socials.telegram.url],
    ["WhatsApp", site.socials.whatsapp.url],
  ]
    .map(([n, u]) => `<a href="${u}" style="color:${C.soft};text-decoration:none;font-family:${TITLE};font-size:12px;letter-spacing:2px;text-transform:uppercase">${n}</a>`)
    .join(`<span style="color:${C.line}">&nbsp;&nbsp;&#9670;&nbsp;&nbsp;</span>`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>ZUBA</title>
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600;700&family=Raleway:wght@400;600&display=swap" rel="stylesheet">
<style>
@media (max-width:620px){.wrap{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}h1{font-size:24px!important}}
a{color:${C.soft}}
</style></head>
<body style="margin:0;padding:0;background:${C.night}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.night}" style="background:${C.night};background-image:radial-gradient(ellipse at top,#2a1250 0%,${C.night} 60%)">
<tr><td align="center" style="padding:28px 12px 40px">

<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px">
<tr><td align="center" style="padding-bottom:18px">
<a href="${url}" style="text-decoration:none">
<img src="${url}/email/coin.png" width="56" height="56" alt="" style="display:block;margin:0 auto;border-radius:50%;border:2px solid ${C.gold}">
<div style="margin-top:10px;font-family:${TITLE};font-size:26px;letter-spacing:8px;color:#ffffff;font-weight:700;text-shadow:0 0 14px rgba(190,90,255,.9)">ZUBA</div>
</a>
<div style="margin-top:4px;font-family:${TITLE};font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${C.muted}">${esc(site.tagline)}</div>
</td></tr>

<tr><td style="border:1.5px solid ${C.line};border-radius:16px;background:${C.panel};overflow:hidden;box-shadow:0 0 30px rgba(140,40,255,.35)">
<img src="${url}/email/${opts.banner}" width="600" alt="${esc(opts.bannerAlt)}" style="display:block;width:100%;max-width:600px;height:auto;border-radius:15px 15px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="padding:30px 40px 36px">
${opts.body}
</td></tr></table>
</td></tr>

<tr><td align="center" style="padding:26px 10px 0">
${runeLine}
<div style="margin-top:16px">${socials}</div>
<div style="margin-top:16px;font-family:${BODY};font-size:12px;line-height:1.6;color:${C.muted}">
$ZUBA on BNB Smart Chain<br><span style="font-family:Consolas,Menlo,monospace;font-size:11px;color:${C.soft}">${CONTRACT}</span>
</div>
<div style="margin-top:14px;font-family:${BODY};font-size:12px;line-height:1.6;color:${C.muted}">
${opts.reason ?? `You're receiving this because you subscribed to ZUBA Dev Notes at <a href="${url}" style="color:${C.soft}">zubatoken.com</a>.`}
${opts.unsubscribe ? `<br><a href="${opts.unsubscribe}" style="color:${C.muted};text-decoration:underline">Unsubscribe</a>` : ""}
</div>
<div style="margin-top:10px;font-family:${BODY};font-size:11px;color:#6f6290">Nothing in this email is financial advice.</div>
</td></tr>
</table>

</td></tr></table>
</body></html>`;
}

export function welcomeEmail(unsubscribe: string) {
  const url = siteUrl();
  const html = layout({
    preheader: "Quest accepted. Every new ZUBA dev note now comes straight to you.",
    banner: "banner.jpg",
    bannerAlt: "The ZUBA world: floating islands over a violet African sky",
    unsubscribe,
    body: `${label("Quest accepted")}
${heading("Welcome to the Builders' Circle")}
${para("Welcome to the village, traveller. You are now subscribed to <strong style=\"color:#fff\">ZUBA Dev Notes</strong>.")}
${para("Each time the builders drop a new marker on the map, the griot carries it straight to your inbox: a feature shipped, a partner signed, a new frame of animation, a checkpoint cleared on the roadmap.")}
${panel(
  "What lands in your inbox",
  list(
    [
      "Real progress from the dev team. No hype, no noise.",
      "First looks at ZUBA art, games and animation.",
      "Roadmap checkpoints the moment they clear.",
    ],
    "&#9670;",
    C.violet
  )
)}
<div style="height:28px;line-height:28px">&nbsp;</div>
${button(`${url}/dev-notes`, "Open the Dev Notes map")}
<p style="margin:22px 0 0;text-align:center;font-family:${BODY};font-size:14px;color:${C.muted}">
New here? Start with the <a href="${url}/whitepaper" style="color:${C.soft}">whitepaper</a> or step into the <a href="${url}/theatre" style="color:${C.soft}">theatre</a>.
</p>`,
  });
  const text = `QUEST ACCEPTED: Welcome to the Builders' Circle

You are now subscribed to ZUBA Dev Notes. Each time the builders drop a new marker on the map, we'll send it straight to you.

What lands in your inbox:
- Real progress from the dev team. No hype, no noise.
- First looks at ZUBA art, games and animation.
- Roadmap checkpoints the moment they clear.

Open the Dev Notes map: ${url}/dev-notes
Whitepaper: ${url}/whitepaper

$ZUBA contract (BNB Smart Chain): ${CONTRACT}
Unsubscribe: ${unsubscribe}`;
  return { subject: "Quest accepted: you're in the ZUBA Builders' Circle", html, text };
}

export function noteEmail(note: DevNote, unsubscribe: string) {
  const url = siteUrl();
  const link = `${url}/dev-notes/${note.slug}`;
  const wins = note.achievements.filter(Boolean);
  const next = note.next.filter(Boolean);
  const where = [note.location, new Date(note.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })]
    .filter(Boolean)
    .join(" · ");
  const html = layout({
    preheader: note.summary || `New dev note: ${note.title}`,
    banner: "notes-banner.jpg",
    bannerAlt: "ZUBA dev notes",
    unsubscribe,
    body: `${label(`New marker on the map · Phase 0${note.phase}`)}
${heading(note.title)}
<div style="margin-top:8px;font-family:${TITLE};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.muted}">${esc(where)}</div>
${note.summary ? para(esc(note.summary)) : ""}
${wins.length ? panel("Achieved", list(wins, "&#10003;", C.gold)) : ""}
${next.length ? panel("Next on the trail", list(next, "&#9656;", C.violet)) : ""}
<div style="height:28px;line-height:28px">&nbsp;</div>
${button(link, "Read the full note")}
<p style="margin:22px 0 0;text-align:center;font-family:${BODY};font-size:14px;color:${C.muted}">
Or follow the whole trail on the <a href="${url}/dev-notes" style="color:${C.soft}">Dev Notes map</a>.
</p>`,
  });
  const text = `NEW MARKER ON THE MAP · PHASE 0${note.phase}
${note.title}
${where}

${note.summary}
${wins.length ? `\nAchieved:\n${wins.map((w) => `- ${w}`).join("\n")}\n` : ""}${next.length ? `\nNext on the trail:\n${next.map((w) => `- ${w}`).join("\n")}\n` : ""}
Read the full note: ${link}

Unsubscribe: ${unsubscribe}`;
  return { subject: `New ZUBA dev note: ${note.title}`, html, text };
}

export function loginEmail(link: string) {
  const html = layout({
    preheader: "Your sign-in link for the ZUBA Workbench. It works for 15 minutes.",
    banner: "notes-banner.jpg",
    bannerAlt: "ZUBA Workbench",
    body: `${label("Workbench")}
${heading("Your sign-in link")}
${para("Tap the button to open the ZUBA Workbench. The link expires in 15 minutes.")}
<div style="height:24px;line-height:24px">&nbsp;</div>
${button(link, "Enter the Workbench")}
${para(`<span style="color:${C.muted};font-size:14px">If you didn't ask for this, you can ignore this email.</span>`)}`,
  });
  return {
    subject: "Your ZUBA Workbench sign-in link",
    html,
    text: `Open the ZUBA Workbench (expires in 15 minutes): ${link}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

/* Invitation for people who applied to be testers: the new games are playable on the website. */
export function testerInviteEmail(name: string) {
  const url = siteUrl();
  const first = (name || "").trim().split(/\s+/)[0] || "tester";
  const html = layout({
    preheader: "Six ZUBA games are live on the website. Sign in and help us test them.",
    banner: "arcade.jpg",
    bannerAlt: "ZUBA Arcade: Zuba the pup leaping through six African game worlds",
    reason: `You're receiving this because you applied to be a ZUBA tester at <a href="${url}/partner" style="color:${C.soft}">zubatoken.com/partner</a>.`,
    body: `${label("Tester call")}
${heading("The games are ready for you")}
${para(`Hi ${esc(first)}, thank you for signing up to test ZUBA games. Your first test round is open: <strong style="color:#fff">six games you can play right now in your browser</strong>, no download needed.`)}
${panel(
  "What to test",
  list(
    [
      "Zuba Kingdom: build your village, grow your people, rise to Emperor.",
      "Ayo: the Yoruba seed game. Beat three elders or play live opponents from anywhere in the world.",
      "Zuba Run, Zuba Boom, Zuba Quiz and Kitendawili riddles.",
    ],
    "&#9670;",
    C.violet
  )
)}
${panel(
  "How to start",
  list(
    [
      "Open zubatoken.com/play on your phone or computer.",
      "Sign in with your Zualingo account, or create one in a minute. Your levels and ZUBA are the same on the web and in the app.",
      "Play, then reply to this email with anything that felt slow, broken or confusing. Screenshots help a lot.",
    ],
    "&#9656;",
    C.gold
  )
)}
<div style="height:28px;line-height:28px">&nbsp;</div>
${button(`${url}/play`, "Play the games")}
<p style="margin:22px 0 0;text-align:center;font-family:${BODY};font-size:14px;color:${C.muted}">
Testers who report bugs are rewarded in $ZUBA, as promised. Thank you for helping us build.
</p>`,
  });
  const text = `TESTER CALL: The games are ready for you

Hi ${first}, thank you for signing up to test ZUBA games. Your first test round is open: six games you can play right now in your browser.

What to test:
- Zuba Kingdom: build your village, grow your people, rise to Emperor.
- Ayo: the Yoruba seed game. Beat three elders or play live opponents from anywhere in the world.
- Zuba Run, Zuba Boom, Zuba Quiz and Kitendawili riddles.

How to start:
1. Open ${url}/play on your phone or computer.
2. Sign in with your Zualingo account, or create one in a minute.
3. Play, then reply to this email with anything that felt slow, broken or confusing.

Testers who report bugs are rewarded in $ZUBA. Thank you for helping us build.`;
  return { subject: "Tester call: six ZUBA games are live. Come play and test", html, text };
}
