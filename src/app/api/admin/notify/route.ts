import { NextResponse } from "next/server";
import { adminEmails, isAdmin } from "@/lib/auth";
import { getDevNote } from "@/lib/content";
import { noteEmail, welcomeEmail } from "@/lib/emails";
import { sendMail } from "@/lib/mailer";
import { broadcasts, listSubscribers, saveBroadcast, unsubscribeUrl } from "@/lib/subscribers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 10;
const TIME_BUDGET_MS = 40_000;

/* Sends a dev note to subscribers in batches. The dashboard calls this until `done`.
   Progress (the last address emailed) is saved after every send, so a send that is cut off
   resumes where it stopped and nobody gets the note twice.
   { slug }            → continue (or start) the broadcast
   { slug, restart }   → send again to everyone, e.g. a deliberate resend
   { slug, test }      → email the note only to the admin address(es)
   { welcomeTest }     → email the welcome message to the admin address(es) */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: string; restart?: boolean; test?: boolean; welcomeTest?: boolean };
  const started = Date.now();

  try {
    if (body.welcomeTest) {
      for (const to of adminEmails()) {
        const u = unsubscribeUrl(to);
        await sendMail({ to, ...welcomeEmail(u), unsubscribeUrl: u });
      }
      return NextResponse.json({ ok: true, sent: adminEmails().length, done: true });
    }

    const note = body.slug ? await getDevNote(body.slug) : undefined;
    if (!note) return NextResponse.json({ error: "Save the note first, then send it." }, { status: 404 });

    if (body.test) {
      for (const to of adminEmails()) {
        const u = unsubscribeUrl(to);
        await sendMail({ to, ...noteEmail(note, u), unsubscribeUrl: u });
      }
      return NextResponse.json({ ok: true, sent: adminEmails().length, done: true });
    }

    const progress = body.restart ? {} : ((await broadcasts())[note.slug] ?? {});
    if (progress.at) return NextResponse.json({ ok: true, sent: 0, failed: [], done: true, already: progress.at });

    // Sorted list + "last address emailed" cursor: stable even if people join or leave mid-send.
    const all = await listSubscribers();
    const pending = progress.cursor ? all.filter((e) => e > progress.cursor!) : all;
    const batch = pending.slice(0, BATCH);
    const failed: string[] = [];
    let cursor = progress.cursor;
    let sent = 0;
    for (const to of batch) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const u = unsubscribeUrl(to);
      try {
        await sendMail({ to, ...noteEmail(note, u), unsubscribeUrl: u });
        sent++;
      } catch (e) {
        console.error("Note email failed", to, e);
        failed.push(to);
      }
      cursor = to;
      await saveBroadcast(note.slug, { cursor });
    }
    const remaining = cursor ? all.filter((e) => e > cursor!).length : all.length;
    const done = remaining === 0;
    if (done) await saveBroadcast(note.slug, { at: new Date().toISOString() });
    return NextResponse.json({ ok: true, total: all.length, sent, failed, remaining, done });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
