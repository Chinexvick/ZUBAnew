import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { mailEnabled } from "@/lib/mailer";
import { broadcasts, listSubscribers, normalizeEmail, removeSubscriber, subscribersEnabled } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!subscribersEnabled()) return NextResponse.json({ enabled: false, mail: mailEnabled(), emails: [], notified: {} });
  const [emails, sent] = await Promise.all([listSubscribers(), broadcasts()]);
  // slug → finished date, or "partial" when a send stopped part way.
  const notified = Object.fromEntries(Object.entries(sent).map(([k, v]) => [k, v.at ?? "partial"]));
  return NextResponse.json({ enabled: true, mail: mailEnabled(), emails, notified });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const email = normalizeEmail(new URL(req.url).searchParams.get("email"));
  if (!email) return NextResponse.json({ error: "Bad email." }, { status: 400 });
  await removeSubscriber(email);
  return NextResponse.json({ ok: true });
}
