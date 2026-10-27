import { NextResponse } from "next/server";
import { adminEmails } from "@/lib/auth";
import { blobEnabled, writeJson } from "@/lib/blob";
import { mailEnabled, sendMail } from "@/lib/mailer";
import { allowOnce, normalizeEmail } from "@/lib/subscribers";
import { methods, planById, type PremiumRequest } from "@/content/subscriptions";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* A buyer asks for Zualingo Premium. The team confirms payment in the Workbench and issues the code. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.website2) return NextResponse.json({ ok: true }); // honeypot
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Enter the email you use in the Zualingo app." }, { status: 400 });
  const plan = planById(String(body?.plan ?? ""));
  if (!plan) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
  const method = String(body?.method ?? "");
  if (!methods.includes(method)) return NextResponse.json({ error: "Choose how you will pay." }, { status: 400 });
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim().slice(0, 200) : "";
  if (!blobEnabled()) return NextResponse.json({ error: "Subscriptions open soon." }, { status: 503 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!(await allowOnce(`premium:${ip}`, 60))) return NextResponse.json({ error: "Please wait a minute before sending another request." }, { status: 429 });

  const at = new Date().toISOString();
  const record: PremiumRequest = { email, name, plan: plan.id, method, reference, at, status: "pending" };
  try {
    await writeJson(`premium/${at.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.json`, record);
    if (mailEnabled()) {
      const to = Array.from(new Set([process.env.SMTP_USER, ...adminEmails()].filter(Boolean) as string[])).join(", ");
      const rows: [string, string][] = [["Email", email], ["Name", name], ["Plan", `${plan.name} (${plan.price})`], ["Payment", method], ["Reference", reference]];
      await sendMail({
        to,
        subject: `Zualingo Premium request: ${plan.name} for ${email}`,
        html: `<div style="font-family:Arial,sans-serif;background:#0b0716;color:#ece4fa;padding:24px"><h2 style="color:#ffb627;margin:0 0 12px">New Premium request</h2><table>${rows.filter((r) => r[1]).map((r) => `<tr><td style="padding:6px 12px 6px 0;color:#9b8cc2">${r[0]}</td><td>${esc(r[1])}</td></tr>`).join("")}</table><p>Confirm the payment, then open the Workbench, Premium tab, and press "Payment confirmed: send code".</p></div>`,
        text: rows.filter((r) => r[1]).map((r) => `${r[0]}: ${r[1]}`).join("\n"),
      }).catch((e) => console.error("admin mail", e));
      await sendMail({
        to: email,
        subject: "We received your Zualingo Premium request",
        html: `<div style="font-family:Arial,sans-serif;background:#160A30;color:#ffffff;padding:28px;border-radius:18px"><h2 style="color:#FFD447;margin:0 0 10px">Thank you!</h2><p>We received your request for <b>Zualingo Premium, ${esc(plan.name)}</b> (${esc(plan.price)}), paying by <b>${esc(method)}</b>.</p><p>Our team will reply with payment details if you have not paid yet. As soon as your payment is confirmed, we email your <b>one-time 5-digit code</b> to this address.</p><p>In the app: Profile, Premium, <b>I have a code</b>. The code only works for the Zualingo account with this email (${esc(email)}).</p><p style="color:#9C84D9;font-size:12px">ZUBA · zubatoken.com</p></div>`,
        text: `We received your request for Zualingo Premium, ${plan.name} (${plan.price}), paying by ${method}.\nOur team will reply with payment details if needed. When your payment is confirmed, we email your one-time 5-digit code to this address.\nIn the app: Profile > Premium > I have a code. The code only works for the account with this email (${email}).`,
      }).catch((e) => console.error("buyer mail", e));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Premium request failed", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
