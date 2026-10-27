import { NextResponse } from "next/server";
import { adminEmails, isAdmin, safeEqual } from "@/lib/auth";
import { blobEnabled, listPaths, readJson, writeJson } from "@/lib/blob";
import { testerInviteEmail } from "@/lib/emails";
import { mailEnabled, sendMail } from "@/lib/mailer";
import { EMAIL_RE } from "@/lib/subscribers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Emails everyone who applied as a tester that the games are live (zubatoken.com/play).
   Resumable: the addresses already emailed are saved after every send, so nobody gets it twice.
   Allowed for a signed-in admin, or with the private OPS_KEY in the x-ops-key header.
     GET            → status: how many testers, how many have an email, who still needs a message
     action=test    → send the invite to the admin address(es) only
     action=send    → send the next batch (call until done) */
const STATE = "ops/tester-invite.json";
const TIME_BUDGET_MS = 40_000;
type App = { track: string; at: string; answers: Record<string, string> };
type Tester = { name: string; email: string | null; contact: string; social: string; device: string; at: string };

async function allowed(req: Request) {
  if (await isAdmin()) return true;
  const key = process.env.OPS_KEY || "";
  // Header only: a key in the address would end up in server and proxy logs.
  const got = req.headers.get("x-ops-key") || "";
  return key.length >= 32 && got.length === key.length && safeEqual(got, key);
}

async function testers(): Promise<Tester[]> {
  const paths = (await listPaths("partners/")).filter((p) => p.includes("-testers-"));
  const apps = await Promise.all(paths.map((p) => readJson<App>(p).catch(() => null)));
  const seen = new Set<string>();
  const out: Tester[] = [];
  for (const a of apps) {
    if (!a || a.track !== "testers") continue;
    const raw = (a.answers.email || "").trim().toLowerCase();
    const email = EMAIL_RE.test(raw) ? raw : null;
    const key = email || `${a.answers.name}|${a.answers.contact}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: a.answers.name || "", email, contact: a.answers.contact || "", social: a.answers.social || "", device: a.answers.device || "", at: a.at });
  }
  return out.sort((x, y) => x.at.localeCompare(y.at));
}

async function run(req: Request, action: string) {
  if (!(await allowed(req))) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!blobEnabled()) return NextResponse.json({ error: "Storage is not set up." }, { status: 503 });
  const all = await testers();
  const state = (await readJson<{ sent: string[]; at?: string }>(STATE).catch(() => null)) ?? { sent: [] };
  const sent = new Set(state.sent);
  const pending = all.filter((t) => t.email && !sent.has(t.email));
  const summary = () => ({
    total: all.length,
    withEmail: all.filter((t) => t.email).length,
    emailed: sent.size,
    remaining: all.filter((t) => t.email && !sent.has(t.email)).length,
    finishedAt: state.at ?? null,
    noEmail: all.filter((t) => !t.email).map((t) => ({ name: t.name, contact: t.contact, social: t.social, device: t.device })),
  });

  if (action === "status") return NextResponse.json(summary());
  if (!mailEnabled()) return NextResponse.json({ error: "Email is not set up." }, { status: 503 });

  if (action === "test") {
    const to = adminEmails();
    for (const a of to) await sendMail({ to: a, ...testerInviteEmail(all[0]?.name || "Tester") });
    return NextResponse.json({ ok: true, testSentTo: to.length });
  }

  if (action === "send") {
    const started = Date.now();
    const failed: string[] = [];
    for (const t of pending) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      try {
        await sendMail({ to: t.email!, ...testerInviteEmail(t.name) });
        sent.add(t.email!);
      } catch (e) {
        console.error("Tester invite failed", t.email, e);
        failed.push(t.email!);
        sent.add(t.email!); // do not retry a bad address forever; it is listed in `failed`
      }
      await writeJson(STATE, { sent: [...sent] });
    }
    const left = all.filter((t) => t.email && !sent.has(t.email)).length;
    if (left === 0 && !state.at) {
      state.at = new Date().toISOString();
      await writeJson(STATE, { sent: [...sent], at: state.at });
    }
    return NextResponse.json({ ok: true, failed, done: left === 0, ...summary() });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function GET(req: Request) {
  return run(req, new URL(req.url).searchParams.get("action") || "status");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  return run(req, body.action || "status");
}
