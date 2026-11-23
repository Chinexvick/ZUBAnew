// AI tutor: lesson voices, voice conversations and lesson generation.
// Every key stays on the server. The app only sends text or a short recording.
import { sql } from './db.js';
import { fail, limit, readBody, requireUser, sha256, str } from './core.js';

export const LANGS = {
  Yoruba: 'yor', Hausa: 'hau', Igbo: 'ibo', Swahili: 'swa', Zulu: 'zul', Twi: 'twi', Amharic: 'amh', Xhosa: 'xho',
  Shona: 'sna', Wolof: 'wol', Somali: 'som', Oromo: 'orm', Lingala: 'lin', Kinyarwanda: 'kin', Luganda: 'lug',
  Sesotho: 'sot', Afrikaans: 'afr', Setswana: 'tsn', Chichewa: 'nya', Malagasy: 'mlg',
};
export const STAGES = ['Beginner', 'Elementary', 'Intermediate', 'Upper intermediate', 'Professional'];
export const TOPICS = [
  null,
  ['Daily routines', 'Shopping and prices', 'Directions in town', 'Describing people', 'Past events', 'Health and the clinic', 'Phone calls', 'Invitations'],
  ['Telling stories', 'Plans and wishes', 'Work and studies', 'Celebrations', 'News and events', 'Feelings in depth', 'Travel problems', 'Food and recipes'],
  ['Proverbs and idioms', 'Debate and opinion', 'History and heritage', 'Music and art', 'Religion and belief', 'Politics and society', 'Literature', 'Humour'],
  ['Business meetings', 'Formal letters', 'Media and interviews', 'Public speaking', 'Law and government', 'Healthcare language', 'Translation practice', 'Teaching others'],
];
/** Stages from this index on need Premium. */
export const PREMIUM_FROM = 2;

const premium = (u) => !!u.premium_until && new Date(u.premium_until) > new Date();
const lang = (v) => {
  const l = str(v, { min: 1, max: 30, name: 'language' });
  if (!LANGS[l]) fail(400, 'Unknown language');
  return l;
};
function need(key, what) {
  if (!process.env[key]) fail(503, `${what} is not switched on yet. Please try again later.`);
  return process.env[key];
}

// ---------------------------------------------------------------- providers

function voiceFor(l) {
  try {
    const map = JSON.parse(process.env.ELEVEN_VOICES || '{}');
    if (map[l]) return map[l];
  } catch {}
  return need('ELEVEN_VOICE_DEFAULT', 'Voice');
}

async function tts(l, text) {
  const key = need('ELEVENLABS_API_KEY', 'Voice');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceFor(l))}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: process.env.ELEVEN_MODEL || 'eleven_v3' }),
  });
  if (!r.ok) {
    console.error('tts failed', r.status);
    fail(502, 'Could not create the audio right now.');
  }
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}

async function stt(l, audioB64) {
  const key = need('ELEVENLABS_API_KEY', 'Voice');
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  if (LANGS[l]) form.append('language_code', LANGS[l]);
  form.append('file', new Blob([Buffer.from(audioB64, 'base64')], { type: 'audio/mp4' }), 'speech.m4a');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!r.ok) {
    console.error('stt failed', r.status);
    fail(502, 'Could not hear that. Please try again.');
  }
  const j = await r.json();
  return String(j.text || '').trim().slice(0, 400);
}

/** Which AI writes replies and lessons: Anthropic or Gemini, by setting or by which key is present. */
function provider() {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'gemini' || p === 'anthropic') return p;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  fail(503, 'The AI tutor is not switched on yet. Please try again later.');
}

function parseJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) fail(502, 'The AI tutor gave an unexpected answer. Please try again.');
  try {
    return JSON.parse(m[0]);
  } catch {
    fail(502, 'The AI tutor gave an unexpected answer. Please try again.');
  }
}

async function anthropic(system, messages, maxTokens) {
  const key = need('ANTHROPIC_API_KEY', 'The AI tutor');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, system, messages }),
  });
  if (!r.ok) {
    console.error('llm failed', r.status);
    fail(502, 'The AI tutor is busy. Please try again.');
  }
  const j = await r.json();
  return (j.content || []).map((c) => c.text || '').join('');
}

const GEMINI_MODELS = () => [process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', 'gemini-flash-latest'];

/** Calls Gemini, moving to the next model when one is busy. */
async function geminiCall(body) {
  const key = need('GEMINI_API_KEY', 'The AI tutor');
  for (const model of GEMINI_MODELS()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        console.error('gemini timeout', model);
        break; // too slow: try the next model
      }
      if (r.ok) {
        const j = await r.json();
        return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      }
      console.error('gemini failed', model, r.status);
      if (r.status !== 503 && r.status !== 429 && r.status !== 500) break;
      await new Promise((res) => setTimeout(res, 600));
    }
  }
  fail(502, 'The AI tutor is busy. Please try again.');
}

async function gemini(system, messages, maxTokens) {
  // Gemini wants turns that alternate and start with the user.
  const contents = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (!contents.length && role === 'model') contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  return geminiCall({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8, responseMimeType: 'application/json' },
  });
}

async function llm(system, messages, maxTokens = 600) {
  const text = provider() === 'gemini' ? await gemini(system, messages, maxTokens * 2) : await anthropic(system, messages, maxTokens);
  return parseJson(text);
}

/** Speech to text with Gemini, used when no ElevenLabs key is set. */
async function geminiHear(l, audioB64) {
  const text = await geminiCall({
    contents: [{ role: 'user', parts: [
      { inline_data: { mime_type: 'audio/mp4', data: audioB64 } },
      { text: `Transcribe exactly what the speaker says. They are learning ${l}, so it may be ${l}, English or a mix. Reply with only the words spoken.` },
    ] }],
    generationConfig: { maxOutputTokens: 300, temperature: 0 },
  });
  return String(text || '').trim().slice(0, 400);
}

// ---------------------------------------------------------------- handlers

/** Pronunciation audio for a phrase. Cached, so each phrase is created once. */
export async function speak(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const l = lang(b.lang);
  const text = str(b.text, { min: 1, max: 300, name: 'text' });
  const key = sha256(`${l}|${process.env.ELEVEN_MODEL || 'eleven_v3'}|${text}`);
  const [hit] = await sql`select audio from tts_cache where key = ${key}`;
  if (hit) return { audio: hit.audio, type: 'audio/mpeg' };
  await limit(`speak:${u.id}`, premium(u) ? 600 : 150, 86400);
  const audio = await tts(l, text);
  await sql`insert into tts_cache (key, audio) values (${key}, ${audio}) on conflict (key) do nothing`;
  return { audio, type: 'audio/mpeg' };
}

/** One turn of a voice or text conversation with the AI tutor. */
export async function talk(req) {
  const u = await requireUser(req);
  const b = await readBody(req, 1_600_000);
  const l = lang(b.lang);
  const level = Math.max(0, Math.min(4, Number(b.level) || 0));
  await limit(`talk:${u.id}`, premium(u) ? 300 : 10, 86400);
  const history = (Array.isArray(b.history) ? b.history : []).slice(-12).map((m) => ({
    role: m?.role === 'tutor' ? 'assistant' : 'user',
    content: String(m?.text || '').slice(0, 400) || '…',
  }));
  let heard = typeof b.text === 'string' ? b.text.trim().slice(0, 400) : '';
  if (!heard && typeof b.audio === 'string' && b.audio.length > 100) {
    heard = process.env.ELEVENLABS_API_KEY || !process.env.GEMINI_API_KEY ? await stt(l, b.audio) : await geminiHear(l, b.audio);
  }
  if (!heard) fail(400, 'Say or type something first');
  const system = `You are an AfriT Hub language guide: a warm, funny native ${l} speaker chatting with a learner whose level is ${STAGES[level]}. Speak the everyday dialect people really use.
Reply in ${l} with standard spelling (keep all tone marks and accents), in 1 or 2 short sentences that fit their level, and keep the conversation going with a simple question.
If the learner's sentence could sound more natural, show them the better way in a short, encouraging tip in English. Speak like a real person from where ${l} is spoken: everyday words, local warmth.
Answer only with JSON: {"reply":"<${l}>","english":"<English meaning of your reply>","tip":"<short correction or tip in English, or empty>"}`;
  const out = await llm(system, [...history, { role: 'user', content: heard }], 400);
  const reply = String(out.reply || '').slice(0, 500);
  if (!reply) fail(502, 'The AI tutor gave an unexpected answer. Please try again.');
  let audio = null;
  try {
    audio = await tts(l, reply);
  } catch {}
  return { heard, reply, english: String(out.english || '').slice(0, 500), tip: String(out.tip || '').slice(0, 300), audio };
}

function cleanLesson(x) {
  const s = (v, n) => String(v ?? '').trim().slice(0, n);
  const phrases = (Array.isArray(x?.phrases) ? x.phrases : [])
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .slice(0, 16)
    .map((p) => [s(p[0], 160), s(p[1], 160), s(p[2], 160)])
    .filter((p) => p[0] && p[1]);
  if (phrases.length < 6) fail(502, 'The lesson could not be prepared. Please try again.');
  const talk = (Array.isArray(x?.talk) ? x.talk : [])
    .filter((t) => Array.isArray(t) && (t[0] === 'A' || t[0] === 'B') && Number.isInteger(t[1]) && t[1] >= 0 && t[1] < phrases.length)
    .slice(0, 10);
  return { title: s(x?.title, 80), about: s(x?.about, 160), tip: s(x?.tip, 600), phrases, talk };
}

/** A unit for stages after Beginner. Created once by the AI tutor, then shared by everyone. */
export async function lesson(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const l = lang(b.lang);
  const stage = Number(b.stage);
  const unit = Number(b.unit);
  if (!Number.isInteger(stage) || stage < 1 || stage > 4 || !Number.isInteger(unit) || unit < 0 || unit > 7) fail(400, 'Unknown lesson');
  if (stage >= PREMIUM_FROM && !premium(u)) fail(402, 'This stage is part of Premium');
  const [hit] = await sql`select content from ai_lessons where lang = ${l} and stage = ${stage} and unit = ${unit}`;
  if (hit) return hit.content;
  await limit(`lesson:${u.id}`, 30, 86400);
  const topic = TOPICS[stage][unit];
  const system = `You write ${l} language lessons for AfriT Hub. Use correct, standard ${l} as spoken today, with full tone marks and accents.
Write for a ${STAGES[stage]} learner. Topic: "${topic}". Prefer natural phrases people really use.
Answer only with JSON: {"title":"<short English title>","about":"<one line in English>","tip":"<2-4 sentences in English on grammar or culture for this topic>",
"phrases":[["<${l}>","<English>","<simple pronunciation guide>"], ... 12 items, from easier to harder],
"talk":[["A",<phrase index>],["B",<phrase index>], ... 6 lines forming a short dialogue]}`;
  const content = cleanLesson(await llm(system, [{ role: 'user', content: `Write the "${topic}" unit.` }], 2500));
  content.topic = topic;
  content.ai = true;
  await sql`insert into ai_lessons (lang, stage, unit, content) values (${l}, ${stage}, ${unit}, ${JSON.stringify(content)}) on conflict do nothing`;
  return content;
}

/** Learners flag a wrong phrase; reports are reviewed by native speakers. */
export async function report(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const l = lang(b.lang);
  await limit(`report:${u.id}`, 30, 86400);
  await sql`insert into lesson_reports (user_id, lang, phrase, note) values (${u.id}, ${l}, ${str(b.phrase, { min: 1, max: 200, name: 'phrase' })}, ${String(b.note || '').slice(0, 500)})`;
  return { ok: true };
}
