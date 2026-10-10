import { NextResponse } from "next/server";
import { removeSubscriber, verifyUnsubscribe } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

// Called by the /unsubscribe page button and by mail apps' one-click unsubscribe (RFC 8058).
export async function POST(req: Request) {
  const url = new URL(req.url);
  let e = url.searchParams.get("e") ?? "";
  let s = url.searchParams.get("s") ?? "";
  if (!e && req.headers.get("content-type")?.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { e?: string; s?: string };
    e = body.e ?? "";
    s = body.s ?? "";
  }
  const email = verifyUnsubscribe(e, s);
  if (!email) return NextResponse.json({ error: "This unsubscribe link is not valid." }, { status: 400 });
  await removeSubscriber(email);
  return NextResponse.json({ ok: true });
}
