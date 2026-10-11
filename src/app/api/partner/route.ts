import { NextResponse } from "next/server";
import { adminEmails } from "@/lib/auth";
import { blobEnabled, writeJson } from "@/lib/blob";
import { mailEnabled, sendMail } from "@/lib/mailer";
import { allowOnce } from "@/lib/subscribers";
import { trackById } from "@/content/partner";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { track?: string; answers?: Record<string, unknown>; website2?: string } | null;
  if (body?.website2) return NextResponse.json({ ok: true }); // honeypot
  const track = trackById(String(body?.track ?? ""));
  if (!track) return NextResponse.json({ error: "Pick a partnership type." }, { status: 400 });

  const answers: Record<string, string> = {};
  for (const f of track.fields) {
    const raw = body?.answers?.[f.id];
    const v = typeof raw === "string" ? raw.trim().slice(0, f.kind === "textarea" ? 4000 : 300) : "";
    if (f.required && !v) return NextResponse.json({ error: `Please fill in: ${f.label}` }, { status: 400 });
    if (f.options && v && !f.options.includes(v)) return NextResponse.json({ error: `Pick an option for: ${f.label}` }, { status: 400 });
    if (v) answers[f.id] = v;
  }
  if (!blobEnabled() && !mailEnabled()) return NextResponse.json({ error: "Applications open soon." }, { status: 503 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (blobEnabled() && !(await allowOnce(`partner:${ip}`, 60))) {
    return NextResponse.json({ error: "Please wait a minute before sending another application." }, { status: 429 });
  }

  const at = new Date().toISOString();
  const record = { track: track.id, trackName: track.name, at, answers };
  try {
    if (blobEnabled()) await writeJson(`partners/${at.replace(/[:.]/g, "-")}-${track.id}-${Math.random().toString(36).slice(2, 8)}.json`, record);
    if (mailEnabled()) {
      const rows = track.fields
        .filter((f) => answers[f.id])
        .map((f) => `<tr><td style="padding:6px 12px 6px 0;color:#9b8cc2;vertical-align:top">${esc(f.label)}</td><td style="padding:6px 0;white-space:pre-wrap">${esc(answers[f.id])}</td></tr>`)
        .join("");
      const to = Array.from(new Set([process.env.SMTP_USER, ...adminEmails()].filter(Boolean) as string[])).join(", ");
      await sendMail({
        to,
        subject: `New ${track.name} application: ${answers.company || answers.name}`,
        html: `<div style="font-family:Arial,sans-serif;background:#0b0716;color:#ece4fa;padding:24px"><h2 style="color:#ffb627;margin:0 0 12px">New ${esc(track.name)} application</h2><table>${rows}</table><p style="color:#9b8cc2;font-size:12px">Received ${at}</p></div>`,
        text: track.fields.filter((f) => answers[f.id]).map((f) => `${f.label}: ${answers[f.id]}`).join("\n"),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Partner application failed", e);
    return NextResponse.json({ error: "Something went wrong. Please try again or message us on Telegram." }, { status: 500 });
  }
}
