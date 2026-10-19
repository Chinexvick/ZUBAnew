import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { blobEnabled, listPaths, readJson, removeBlob, writeJson } from "@/lib/blob";
import { normalizeEmail } from "@/lib/subscribers";
import { planById, type PremiumRequest } from "@/content/subscriptions";

export const dynamic = "force-dynamic";

const ID_RE = /^premium\/[\w.-]+\.json$/;

/* Asks the Zualingo server (zualingo-api) to create a one-time code tied to the email and email it.
   ZUALINGO_ADMIN_KEY is a server-side secret: it never reaches the browser. */
async function issue(email: string, days: number, note: string) {
  const key = process.env.ZUALINGO_ADMIN_KEY;
  if (!key) throw new Error("ZUALINGO_ADMIN_KEY is not set on this site.");
  const base = (process.env.ZUALINGO_API_URL || "https://zualingo-api.vercel.app").replace(/\/+$/, "");
  const res = await fetch(`${base}/premium/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": key },
    body: JSON.stringify({ email, maxUses: 1, days, validDays: 60, note, send: true }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { code?: string; emailed?: boolean; error?: string };
  if (!res.ok || !j.code) throw new Error(j.error || `Zualingo server error ${res.status}`);
  return { code: j.code, emailed: Boolean(j.emailed) };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!blobEnabled()) return NextResponse.json({ items: [], keySet: Boolean(process.env.ZUALINGO_ADMIN_KEY) });
  const paths = (await listPaths("premium/")).sort().reverse().slice(0, 300);
  const items = (await Promise.all(paths.map(async (id) => ({ id, ...(await readJson<PremiumRequest>(id).catch(() => null)) })))).filter((x) => x.email);
  return NextResponse.json({ items, keySet: Boolean(process.env.ZUALINGO_ADMIN_KEY) });
}

/* { id } issues the code for a request; { email, plan } issues one directly (e.g. a sale made elsewhere). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; email?: string; plan?: string };
  try {
    if (b.id) {
      if (!ID_RE.test(b.id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
      const r = await readJson<PremiumRequest>(b.id);
      if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
      if (r.status === "issued") return NextResponse.json({ error: "A code was already sent for this request." }, { status: 409 });
      const plan = planById(r.plan);
      if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
      const out = await issue(r.email, plan.days, `site ${plan.id} ${r.method}`);
      await writeJson(b.id, { ...r, status: "issued", issuedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true, ...out, email: r.email });
    }
    const email = normalizeEmail(b.email);
    const plan = planById(String(b.plan ?? ""));
    if (!email || !plan) return NextResponse.json({ error: "Enter a valid email and plan." }, { status: 400 });
    const out = await issue(email, plan.days, `manual ${plan.id}`);
    return NextResponse.json({ ok: true, ...out, email });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  await removeBlob(id);
  return NextResponse.json({ ok: true });
}
