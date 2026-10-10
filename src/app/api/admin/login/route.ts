import { NextResponse } from "next/server";
import { adminConfigured, checkPassword, createSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin is not set up. Add ADMIN_PASSWORD to the environment." }, { status: 503 });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  // Slow down guessing.
  await new Promise((r) => setTimeout(r, 600));
  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const s = createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: s.maxAge,
  });
  return res;
}
