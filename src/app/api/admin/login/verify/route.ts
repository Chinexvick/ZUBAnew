import { NextResponse } from "next/server";
import { createSession, sessionCookieOptions, SESSION_COOKIE, verifyLoginToken } from "@/lib/auth";
import { siteUrl } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const base = siteUrl();
  if (!verifyLoginToken(token)) return NextResponse.redirect(`${base}/admin?link=expired`, 303);
  const s = createSession();
  const res = NextResponse.redirect(`${base}/admin`, 303);
  res.cookies.set(SESSION_COOKIE, s.value, sessionCookieOptions(s.maxAge));
  return res;
}
