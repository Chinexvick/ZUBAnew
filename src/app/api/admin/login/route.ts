import { NextResponse } from "next/server";
import {
  adminConfigured,
  adminEmails,
  checkPassword,
  createLoginToken,
  createSession,
  emailLoginEnabled,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { loginEmail } from "@/lib/emails";
import { sendMail, siteUrl } from "@/lib/mailer";
import { normalizeEmail } from "@/lib/subscribers";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin is not set up yet." }, { status: 503 });
  }
  const { password, email } = (await req.json().catch(() => ({}))) as { password?: string; email?: string };
  // Slow down guessing.
  await new Promise((r) => setTimeout(r, 600));

  if (email !== undefined) {
    if (!emailLoginEnabled()) return NextResponse.json({ error: "Email sign-in is not set up." }, { status: 503 });
    const addr = normalizeEmail(email);
    if (addr && adminEmails().includes(addr)) {
      const link = `${siteUrl()}/api/admin/login/verify?t=${createLoginToken(addr)}`;
      try {
        await sendMail({ to: addr, ...loginEmail(link) });
      } catch (e) {
        console.error("Login email failed", e);
        return NextResponse.json({ error: "Could not send the email. Check the SMTP settings." }, { status: 502 });
      }
    }
    // Same answer either way so the admin list can't be probed.
    return NextResponse.json({ ok: true, sent: true });
  }

  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const s = createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, sessionCookieOptions(s.maxAge));
  return res;
}
