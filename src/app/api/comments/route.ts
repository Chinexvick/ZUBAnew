import { NextResponse } from "next/server";
import { adminEmails, isAdmin } from "@/lib/auth";
import { blobEnabled } from "@/lib/blob";
import { addComment, deleteComment, listAllComments, listComments, validTarget } from "@/lib/comments";
import { mailEnabled, sendMail, siteUrl } from "@/lib/mailer";
import { allowOnce } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Links are a spam magnet; keep comments to text.
const LINK_RE = /(https?:\/\/|www\.)\S+/i;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind");
  const slug = u.searchParams.get("slug");
  if (!blobEnabled()) return NextResponse.json({ items: [], enabled: false });
  if (kind === "all") {
    if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    return NextResponse.json({ items: await listAllComments() });
  }
  if (!validTarget(kind, slug)) return NextResponse.json({ error: "Bad target." }, { status: 400 });
  return NextResponse.json({ items: await listComments(kind, slug!), enabled: true, admin: await isAdmin() });
}

export async function POST(req: Request) {
  if (!blobEnabled()) return NextResponse.json({ error: "Comments open soon." }, { status: 503 });
  const b = (await req.json().catch(() => null)) as { kind?: string; slug?: string; name?: string; text?: string; website?: string } | null;
  if (b?.website) return NextResponse.json({ ok: true });
  if (!validTarget(b?.kind, b?.slug)) return NextResponse.json({ error: "Bad target." }, { status: 400 });
  const admin = await isAdmin();
  const name = (b?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  const text = (b?.text ?? "").trim().slice(0, 1500);
  if (name.length < 2) return NextResponse.json({ error: "Add your name." }, { status: 400 });
  if (text.length < 2) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
  if (!admin && LINK_RE.test(text)) return NextResponse.json({ error: "Links aren't allowed in comments." }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!admin && !(await allowOnce(`comment:${ip}`, 20))) return NextResponse.json({ error: "Please wait a few seconds before commenting again." }, { status: 429 });

  const c = await addComment({ kind: b!.kind as "blog" | "devnotes", slug: b!.slug!, name, text, admin: admin || undefined });
  if (mailEnabled() && !admin) {
    const url = `${siteUrl()}/${c.kind === "blog" ? "blog" : "dev-notes"}/${c.slug}#comments`;
    const to = Array.from(new Set([process.env.SMTP_USER, ...adminEmails()].filter(Boolean) as string[])).join(", ");
    await sendMail({
      to,
      subject: `New comment from ${name} on ${c.slug}`,
      html: `<div style="font-family:Arial,sans-serif"><p><b>${esc(name)}</b> commented on <a href="${url}">${esc(c.slug)}</a>:</p><blockquote style="border-left:3px solid #b45cff;padding-left:12px;white-space:pre-wrap">${esc(text)}</blockquote><p>Delete it from the admin dashboard if needed.</p></div>`,
      text: `${name} commented on ${url}:\n\n${text}`,
    }).catch((e) => console.error("Comment notice failed", e));
  }
  return NextResponse.json({ ok: true, item: c });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    await deleteComment(new URL(req.url).searchParams.get("id") ?? "");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad id." }, { status: 400 });
  }
}
