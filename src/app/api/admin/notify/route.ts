import { NextResponse } from "next/server";
import { adminEmails, isAdmin } from "@/lib/auth";
import { getDevNote, type DevNote } from "@/lib/content";
import { noteEmail, welcomeEmail } from "@/lib/emails";
import { sendMail } from "@/lib/mailer";
import { listSubscribers, markNotified, unsubscribeUrl } from "@/lib/subscribers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 20;

/* Sends a dev note to subscribers in batches. The dashboard calls this repeatedly with the
   returned `next` offset until `done`, so long lists never hit the function time limit.
   { slug, offset }   → email subscribers [offset, offset+BATCH)
   { slug, test }     → email the note only to the admin address(es)
   { welcomeTest }    → email the welcome message to the admin address(es) */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: string; offset?: number; test?: boolean; welcomeTest?: boolean };

  try {
    if (body.welcomeTest) {
      for (const to of adminEmails()) {
        const u = unsubscribeUrl(to);
        await sendMail({ to, ...welcomeEmail(u), unsubscribeUrl: u });
      }
      return NextResponse.json({ ok: true, sent: adminEmails().length, done: true });
    }

    const note = body.slug ? ((await getDevNote(body.slug)) as DevNote | undefined) : undefined;
    if (!note) return NextResponse.json({ error: "Save the note first, then send it." }, { status: 404 });

    if (body.test) {
      for (const to of adminEmails()) {
        const u = unsubscribeUrl(to);
        await sendMail({ to, ...noteEmail(note, u), unsubscribeUrl: u });
      }
      return NextResponse.json({ ok: true, sent: adminEmails().length, done: true });
    }

    const all = await listSubscribers();
    const offset = Math.max(0, Number(body.offset) || 0);
    const batch = all.slice(offset, offset + BATCH);
    const failed: string[] = [];
    for (const to of batch) {
      const u = unsubscribeUrl(to);
      await sendMail({ to, ...noteEmail(note, u), unsubscribeUrl: u }).catch((e) => {
        console.error("Note email failed", to, e);
        failed.push(to);
      });
    }
    const next = offset + batch.length;
    const done = next >= all.length;
    if (done) await markNotified(note.slug);
    return NextResponse.json({ ok: true, total: all.length, sent: batch.length - failed.length, failed, next, done });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
