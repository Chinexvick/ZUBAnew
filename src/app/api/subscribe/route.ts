import { NextResponse } from "next/server";
import { welcomeEmail } from "@/lib/emails";
import { mailEnabled, sendMail } from "@/lib/mailer";
import { adminEmails } from "@/lib/auth";
import { addSubscriber, allowOnce, normalizeEmail, subscribersEnabled, unsubscribeUrl } from "@/lib/subscribers";

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
    // One sign-up per visitor every 30 seconds keeps scripts from enrolling lists of strangers.
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (!(await allowOnce(`sub:${ip}`, 30))) {
      return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
    }
    const isNew = await addSubscriber(email, source);
    if (isNew) {
      const unsub = unsubscribeUrl(email);
      await sendMail({ to: email, ...welcomeEmail(unsub), unsubscribeUrl: unsub }).catch((e) => console.error("Welcome email failed", e));
      const team = Array.from(new Set([process.env.SMTP_USER, ...adminEmails()].filter(Boolean) as string[])).join(", ");
      await sendMail({
        to: team,
        subject: `New Dev Notes subscriber: ${email}`,
        html: `<p style="font-family:Arial,sans-serif">New Dev Notes subscriber: <b>${email}</b><br>Source: ${source}<br>Time: ${new Date().toISOString()}</p>`,
        text: `New Dev Notes subscriber: ${email}\nSource: ${source}`,
      }).catch((e) => console.error("Team notice failed", e));
    }
    return NextResponse.json({ ok: true, already: !isNew });
  } catch (e) {
    console.error("Subscribe failed", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
