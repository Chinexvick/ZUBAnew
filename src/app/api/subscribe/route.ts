import { NextResponse } from "next/server";
import { welcomeEmail } from "@/lib/emails";
import { mailEnabled, sendMail } from "@/lib/mailer";
import { addSubscriber, normalizeEmail, subscribersEnabled, unsubscribeUrl } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; website?: unknown; source?: unknown } | null;
  // Honeypot: bots fill the hidden "website" field. Pretend it worked.
  if (body?.website) return NextResponse.json({ ok: true });
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  if (!subscribersEnabled() || !mailEnabled()) {
    return NextResponse.json({ error: "Subscriptions open soon. Try again later." }, { status: 503 });
  }
  const source = typeof body?.source === "string" ? body.source.slice(0, 40) : "site";
  try {
    const isNew = await addSubscriber(email, source);
    if (isNew) {
      const unsub = unsubscribeUrl(email);
      await sendMail({ to: email, ...welcomeEmail(unsub), unsubscribeUrl: unsub }).catch((e) => console.error("Welcome email failed", e));
    }
    return NextResponse.json({ ok: true, already: !isNew });
  } catch (e) {
    console.error("Subscribe failed", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
