// Staking, founder side. Only reachable with the Workbench (admin) session.
// It can look, and it can ask the worker to pause, resume or decide a withdrawal.
// Resuming and deciding also need a code from the admin authenticator, which only the worker can check.
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { ask, config, db, limited, proofValid, stakeEnabled } from "@/lib/stake/server";
import { mailEnabled } from "@/lib/mailer";
import { PROGRAM_DAYS, TOTAL_BUDGET, dailyPool, formatAmount } from "@/lib/stake/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const adminId = () => (process.env.STAKE_ADMIN_ID || "").toLowerCase();
const ready = () => stakeEnabled() && /^[0-9a-f-]{36}$/.test(adminId());

export async function GET() {
  if (!(await isAdmin())) return json({ error: "Not signed in." }, 401);
  if (!ready()) return json({ enabled: false });
  const q = db(), conf = await config();
  const decimals = Number(conf.decimals || 9), unit = 10n ** BigInt(decimals);
  const fmt = (v: bigint | string | number) => formatAmount(v, decimals);
  const pub = JSON.parse(conf.public || "{}") as Record<string, string | number | boolean | null>;
  const dayMs = Number(pub.dayMs || 86_400_000);
  const [st, paid, owed, staked, users, queue, recent, alerts, cursors, pendingDep] = await Promise.all([
    q.query("select paused, pause_reason, launch_at from stake_state where id = 1"),
    q.query("select coalesce(sum(paid), 0) as s, count(*)::int as n from stake_epochs"),
    q.query("select coalesce(sum(available), 0) as a, coalesce(sum(staked), 0) as s, coalesce(sum(held), 0) as h, count(*)::int as n from stake_accounts"),
    q.query("select count(distinct user_id)::int as n from stake_positions where status = 'active'"),
    q.query("select count(*)::int as n from stake_addresses"),
    q.query("select id, user_id, to_address, amount, status, created_at, proof, proof_note, proof_sig, proof_at from stake_withdrawals where status in ('review', 'queued', 'sending') order by id limit 100"),
    q.query("select id, to_address, amount, status, tx_hash, created_at from stake_withdrawals order by id desc limit 15"),
    q.query("select at, level, msg from stake_alerts order by id desc limit 20"),
    q.query("select name, block from stake_cursor where name in ('heartbeat', 'reconciled')"),
    q.query("select count(*)::int as n from stake_deposits where status = 'pending'"),
  ]);
  if (!st.rows[0]) return json({ enabled: false });
  const cur = Object.fromEntries(cursors.rows.map((r) => [r.name, Number(r.block)]));
  const now = Math.floor(Date.now() / 1000);
  const day = Math.max(0, Math.floor((Date.now() - new Date(st.rows[0].launch_at).getTime()) / dayMs));
  const o = owed.rows[0];
  const w = (r: { id: string; to_address: string; amount: string; status: string; created_at: string; tx_hash?: string | null }) => ({ id: Number(r.id), to: r.to_address, amount: fmt(r.amount), status: r.status, at: r.created_at, tx: r.tx_hash ?? null });
  return json({
    enabled: true,
    test: Boolean(pub.testMode),
    explorer: conf.explorer || "https://bscscan.com",
    system: {
      paused: Boolean(st.rows[0].paused), reason: st.rows[0].pause_reason,
      workerSecondsAgo: cur.heartbeat ? now - cur.heartbeat : null, checkedSecondsAgo: cur.reconciled ? now - cur.reconciled : null,
      depositsOpen: conf.chain_ready !== "0", pendingDeposits: pendingDep.rows[0].n,
    },
    budget: {
      total: TOTAL_BUDGET.toString(), paid: fmt(paid.rows[0].s), left: fmt(TOTAL_BUDGET * unit - BigInt(paid.rows[0].s)),
      today: fmt(dailyPool(day, unit)), day: Math.min(day + 1, PROGRAM_DAYS), days: PROGRAM_DAYS, daysPaid: paid.rows[0].n,
    },
    totals: { owed: fmt(BigInt(o.a) + BigInt(o.s) + BigInt(o.h)), available: fmt(o.a), staked: fmt(o.s), withdrawing: fmt(o.h), accounts: users.rows[0].n, stakers: staked.rows[0].n },
    wallets: { vault: conf.vault || "", payout: String(pub.payout || ""), token: conf.token || "" }, symbol: conf.symbol || "ZUBA",
    manual: pub.manual !== false,
    notify: { email: process.env.STAKE_NOTIFY_EMAIL || "", working: Boolean(process.env.STAKE_NOTIFY_EMAIL) && mailEnabled() },
    // "check": verified = the worker checked this against the chain and signed it. Anything else must not be paid.
    approvals: queue.rows.filter((r) => r.status === "review").map((r) => ({
      ...w(r), raw: formatAmount(r.amount, decimals),
      check: !r.proof ? "pending" : !proofValid(r) ? "invalid" : r.proof === "ok" ? "verified" : "failed",
      checkNote: r.proof === "fail" && proofValid(r) ? r.proof_note : null,
    })),
    inProgress: queue.rows.filter((r) => r.status !== "review").map(w),
    recent: recent.rows.map(w),
    alerts: alerts.rows,
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return json({ error: "Not signed in." }, 401);
  if (!ready()) return json({ error: "Staking is not set up." }, 503);
  const origin = req.headers.get("origin"), host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return json({ error: "Bad request" }, 403);
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: number; approve?: boolean; code?: string; tx?: string };
  if (await limited("admin:act", 60, 3600)) return json({ error: "Too many tries. Try again later." }, 429);
  const code = typeof b.code === "string" && /^\d{6}$/.test(b.code) ? b.code : "";
  let r;
  if (b.action === "pause") r = await ask(adminId(), "admin_pause", {});
  else if (b.action === "resume") r = code ? await ask(adminId(), "admin_resume", { code }) : null;
  else if (b.action === "decide" && Number.isInteger(b.id)) r = code ? await ask(adminId(), "admin_decide", { id: b.id, approve: b.approve === true, code }) : null;
  else if (b.action === "settle" && Number.isInteger(b.id)) {
    const tx = typeof b.tx === "string" ? b.tx.match(/0x[0-9a-fA-F]{64}/)?.[0] : null;
    if (!tx) return json({ error: "Paste the transaction hash or its BscScan link." }, 400);
    r = code ? await ask(adminId(), "admin_settle", { id: b.id, tx, code }) : null;
  } else return json({ error: "Bad request" }, 400);
  if (r === null) return json({ error: "Enter the 6-digit admin code." }, 400);
  return r.http === 200 ? json({ ok: true }) : json({ error: r.error || "Something went wrong." }, r.http || 500);
}
