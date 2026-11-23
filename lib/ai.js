import crypto from 'node:crypto';
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

// Native Nigerian voices from 9jaLingo: lessons use one voice, the AI guides another.
const NAIJA = {
  Yoruba: { code: 'yo', lesson: 'adeola_yo', guide: 'babatunde_yo' },
  Igbo: { code: 'ig', lesson: 'adaeze_ig', guide: 'chinedu_ig' },
  Hausa: { code: 'ha', lesson: 'aisha_ha', guide: 'abdullahi_ha' },
};

function ttsProvider(l) {
  if (NAIJA[l] && process.env.NAIJALINGO_API_KEY) return 'naija';
  if (process.env.ELEVENLABS_API_KEY) return 'eleven';
  return null;
}

async function naijaTts(l, text, role) {
  const v = NAIJA[l];
  const r = await fetch('https://api.9jalingo.org/v1/audio/speech', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.NAIJALINGO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ input: text, voice: v[role], language: v.code, response_format: 'mp3' }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    console.error('naija tts failed', r.status);
    // Plan limit reached: the app shows text now and plays audio once it resets.
    if (r.status === 429) fail(503, 'Voices are busy right now. Please try again a little later.');
    fail(502, 'Could not create the audio right now.');
  }
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}

// ---- Backup voice: Gemini speech, used when 9jaLingo is at its plan limit or has no voice for a language.
const GEMINI_TTS = () => [...new Set([process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts', 'gemini-2.5-pro-preview-tts'])];
const ACCENT = { Yoruba: 'south-west Nigeria', Igbo: 'south-east Nigeria', Hausa: 'northern Nigeria', Swahili: 'Kenya and Tanzania', Twi: 'Ghana', Zulu: 'South Africa', Amharic: 'Ethiopia', Wolof: 'Senegal' };

/** 16-bit mono PCM to a WAV file the phone can play. */
function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

let ttsFetch = (...a) => fetch(...a);
export function useTtsFetch(fn) {
  ttsFetch = fn;
}

async function geminiTts(l, text, role = 'lesson') {
  const key = need('GEMINI_API_KEY', 'Voice');
  const where = ACCENT[l] ? ` from ${ACCENT[l]}` : '';
  const how = role === 'guide' ? 'warmly and naturally, like a friendly local chatting' : 'clearly and a little slowly, like a patient teacher, keeping every tone';
  const body = {
    contents: [{ role: 'user', parts: [{ text: `Read this ${l} text aloud ${how}, as a native ${l} speaker${where}. Say only the text:\n${text}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: role === 'guide' ? 'Charon' : 'Kore' } } } },
  };
  for (const model of GEMINI_TTS()) {
    let r;
    try {
      r = await ttsFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      continue;
    }
    if (!r.ok) {
      console.error('gemini tts failed', model, r.status);
      continue;
    }
    const j = await r.json();
    const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
    const data = part?.inlineData || part?.inline_data;
    if (!data?.data) continue;
    const rate = Number(/rate=(\d+)/.exec(data.mimeType || data.mime_type || '')?.[1]) || 24000;
    return wav(Buffer.from(data.data, 'base64'), rate).toString('base64');
  }
  fail(503, 'Voices are busy right now. Please try again in a minute.');
}

async function naijaBusy() {
  const [r] = await sql`select 1 from rate_hits where key = 'naija-busy' and bucket = ${Math.floor(Date.now() / 600000)}`;
  return !!r;
}
async function markNaijaBusy() {
  await sql`insert into rate_hits (key, bucket, hits) values ('naija-busy', ${Math.floor(Date.now() / 600000)}, 1) on conflict do nothing`;
}

/** Native 9jaLingo voice first; Gemini when 9jaLingo is busy or has no voice for the language. */
async function speech(l, text, role = 'lesson') {
  if (ttsProvider(l) === 'naija' && !(await naijaBusy())) {
    try {
      return { audio: await naijaTts(l, text, role), type: 'audio/mpeg', native: true };
    } catch (e) {
      if (e?.status === 503) await markNaijaBusy();
    }
  } else if (ttsProvider(l) === 'eleven') {
    try {
      return { audio: await tts(l, text, role), type: 'audio/mpeg', native: true };
    } catch {}
  }
  return { audio: await geminiTts(l, text, role), type: 'audio/wav', native: false };
}

async function tts(l, text, role = 'lesson') {
  const p = ttsProvider(l);
  if (!p) fail(503, 'Voice is not switched on yet. Please try again later.');
  if (p === 'naija') return naijaTts(l, text, role);
  const key = process.env.ELEVENLABS_API_KEY;
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
// Lessons are written once and shared, so they use the more careful model first.
const GEMINI_LESSON_MODELS = () => [process.env.GEMINI_LESSON_MODEL || 'gemini-3.5-flash', process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'];

/** Calls Gemini, moving to the next model when one is busy. */
async function geminiCall(body, models = GEMINI_MODELS(), timeoutMs = 20000) {
  const key = need('GEMINI_API_KEY', 'The AI tutor');
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
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

async function gemini(system, messages, maxTokens, lesson = false) {
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
    generationConfig: { maxOutputTokens: maxTokens, temperature: lesson ? 0.6 : 0.8, responseMimeType: 'application/json' },
  }, lesson ? GEMINI_LESSON_MODELS() : GEMINI_MODELS(), lesson ? 38000 : 15000);
}

async function llm(system, messages, maxTokens = 600, lesson = false) {
  const text = provider() === 'gemini' ? await gemini(system, messages, maxTokens * 3, lesson) : await anthropic(system, messages, maxTokens);
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
  const key = sha256(`${l}|${ttsProvider(l) === 'naija' ? 'naija:' + NAIJA[l].lesson : process.env.ELEVEN_MODEL || 'eleven_v3'}|${text}`);
  const backup = sha256(`${l}|gemini-tts|${text}`);
  const [hit] = await sql`select audio from tts_cache where key = ${key}`;
  if (hit) return { audio: hit.audio, type: 'audio/mpeg' };
  await limit(`speak:${u.id}`, premium(u) ? 600 : 150, 86400);
  // A native recording replaces the backup voice as soon as 9jaLingo has room again.
  const [old] = await sql`select audio from tts_cache where key = ${backup}`;
  if (old && (ttsProvider(l) !== 'naija' || (await naijaBusy()))) return { audio: old.audio, type: 'audio/wav' };
  const out = await speech(l, text);
  if (!out.native && old) return { audio: old.audio, type: 'audio/wav' };
  await sql`insert into tts_cache (key, audio) values (${out.native ? key : backup}, ${out.audio}) on conflict (key) do nothing`;
  return { audio: out.audio, type: out.type };
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
  let audio = null, audioType = null;
  try {
    const v = await speech(l, reply, 'guide');
    audio = v.audio;
    audioType = v.type;
  } catch {}
  return { heard, reply, english: String(out.english || '').slice(0, 500), tip: String(out.tip || '').slice(0, 300), audio, audioType };
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
  const content = cleanLesson(await llm(system, [{ role: 'user', content: `Write the "${topic}" unit.` }], 2500, true));
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

/** Admin: checks both voices end to end without exposing any key. */
export async function voiceCheck(req) {
  const want = Buffer.from(process.env.ADMIN_KEY || '');
  const got = Buffer.from(String(req.headers['x-admin-key'] || ''));
  if (want.length < 32 || got.length !== want.length || !crypto.timingSafeEqual(got, want)) fail(404, 'Not found');
  const out = { naijaKey: !!process.env.NAIJALINGO_API_KEY, geminiKey: !!process.env.GEMINI_API_KEY, naijaBusy: await naijaBusy() };
  try {
    out.gemini = (await geminiTts('Igbo', 'Nnọọ', 'lesson')).length;
  } catch (e) {
    out.gemini = 'failed: ' + e.message;
  }
  return out;
}
