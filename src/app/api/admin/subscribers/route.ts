import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { mailEnabled } from "@/lib/mailer";
import { listSubscribers, normalizeEmail, notifiedSlugs, removeSubscriber, subscribersEnabled } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!subscribersEnabled()) return NextResponse.json({ enabled: false, mail: mailEnabled(), emails: [], notified: {} });
  const [emails, notified] = await Promise.all([listSubscribers(), notifiedSlugs()]);
  return NextResponse.json({ enabled: true, mail: mailEnabled(), emails, notified });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const email = normalizeEmail(new URL(req.url).searchParams.get("email"));
  if (!email) return NextResponse.json({ error: "Bad email." }, { status: 400 });
  await removeSubscriber(email);
  return NextResponse.json({ ok: true });
}
