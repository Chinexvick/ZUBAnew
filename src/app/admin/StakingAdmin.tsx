"use client";

import { useCallback, useEffect, useState } from "react";
import "../stake/stake.css";

type W = { id: number; to: string; amount: string; status: string; at: string; tx: string | null; raw?: string; check?: "pending" | "verified" | "failed" | "invalid"; checkNote?: string | null };
type Data = {
  enabled: boolean; test?: boolean; explorer?: string; manual?: boolean; symbol?: string; notify?: { email: string; working: boolean };
  system?: { paused: boolean; reason: string | null; workerSecondsAgo: number | null; checkedSecondsAgo: number | null; depositsOpen: boolean; pendingDeposits: number };
  budget?: { total: string; paid: string; left: string; today: string; day: number; days: number; daysPaid: number };
  totals?: { owed: string; available: string; staked: string; withdrawing: string; accounts: number; stakers: number };
  wallets?: { vault: string; payout: string; token: string };
  approvals?: W[]; inProgress?: W[]; recent?: W[]; alerts?: { at: string; level: string; msg: string }[];
};
type Pending = { action: "resume" } | { action: "decide"; id: number; approve: boolean; amount: string; to: string } | { action: "settle"; id: number; amount: string; to: string };

const nice = (s: string | undefined, dp = 0) => {
  if (!s) return "0";
  const [w, f = ""] = s.split(".");
  const frac = f.slice(0, dp).replace(/0+$/, "");
  return w.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? "." + frac : "");
};
const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Not set");
const when = (d: string) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ago = (s: number | null) => (s === null ? "Never" : s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`);
const STATUS: Record<string, [string, string]> = { review: ["Waiting", "wait"], queued: ["Processing", "wait"], sending: ["Sending", "wait"], sent: ["Completed", "ok"], failed: ["Failed", "bad"], cancelled: ["Cancelled", ""], rejected: ["Declined", "bad"] };

export default function StakingAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [ask, setAsk] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [tx, setTx] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/stake", { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/stake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      setAsk(null); setCode(""); setTx(""); setNote(done); setTimeout(() => setNote(""), 3000);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* older browsers */ }
    setCopied(key); setTimeout(() => setCopied(""), 1500);
  };
  const open = (a: Pending) => { setErr(""); setCode(""); setTx(""); setAsk(a); };
  if (!d) return <div className="sk sk-admin"><div className="sk-loading" /></div>;
  if (!d.enabled) return <div className="sk sk-admin"><section className="sk-card"><p className="sk-muted">Staking is not set up on this site yet.</p></section></div>;
  const s = d.system!, b = d.budget!, t = d.totals!, wl = d.wallets!;
  const pct = Math.min(100, (Number(b.paid.split(".")[0]) / 1e10) * 100);
  const Row = ({ k, v, c }: { k: string; v: React.ReactNode; c?: string }) => <div><dt>{k}</dt><dd className={c}>{v}</dd></div>;
  const List = ({ items, actions }: { items: W[]; actions?: boolean }) => (
    <ul className="sk-rows">
      {items.map((x) => {
        const [label, tone] = STATUS[x.status] || [x.status, ""];
        return (
          <li key={x.id}>
            <div><b className="sk-num">#{x.id} · {nice(x.amount, 2)}</b><span><span className="sk-mono">{short(x.to)}</span> · {when(x.at)}</span></div>
            <span className={`sk-pill ${tone}`}>{label}</span>
            <div className="sk-row-actions">
              {actions ? (
                <>
                  <button type="button" className="sk-ghost" onClick={() => { setErr(""); setCode(""); setAsk({ action: "decide", id: x.id, approve: true, amount: x.amount, to: x.to }); }}>Approve</button>
                  <button type="button" className="sk-ghost dim" onClick={() => { setErr(""); setCode(""); setAsk({ action: "decide", id: x.id, approve: false, amount: x.amount, to: x.to }); }}>Decline</button>
                </>
              ) : x.tx ? <a className="sk-ghost" href={`${d.explorer}/tx/${x.tx}`} target="_blank" rel="noreferrer">View</a> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="sk sk-admin">
      {d.test && <div className="sk-test"><b>Testnet</b> This is the test system.</div>}
      {s.paused && <p className="sk-note warn">Paused: {s.reason || "no reason recorded"}</p>}
      <div className="sk-two">
        <section className="sk-card">
          <header className="sk-card-head"><h2>System</h2><span className={`sk-pill ${s.paused ? "bad" : "ok"}`}>{s.paused ? "Paused" : "Running"}</span></header>
          <dl className="sk-dl">
            <Row k="Worker" v={ago(s.workerSecondsAgo)} />
            <Row k="Last self-check" v={ago(s.checkedSecondsAgo)} />
            <Row k="Deposits" v={s.depositsOpen ? `Open${s.pendingDeposits ? ` · ${s.pendingDeposits} confirming` : ""}` : "Closed"} />
          </dl>
          {s.paused
            ? <button type="button" className="sk-btn primary" onClick={() => open({ action: "resume" })}>Resume staking</button>
            : <button type="button" className="sk-btn" disabled={busy} onClick={() => window.confirm("Pause staking now? New stakes and withdrawals stop until you resume.") && send({ action: "pause" }, "Staking paused")}>Pause staking</button>}
        </section>
        <section className="sk-card">
          <header className="sk-card-head"><h2>Reward budget</h2><span className="sk-pill">Day {nice(String(b.day))} of {nice(String(b.days))}</span></header>
          <div className="sk-big left"><b className="sk-num gold">{nice(b.paid)}</b><span>paid of 10B</span></div>
          <div className="sk-bar"><span style={{ width: `${Math.max(pct, 0.5)}%`, background: "var(--gold)" }} /></div>
          <dl className="sk-dl">
            <Row k="Left" v={nice(b.left)} />
            <Row k="Today's pool" v={nice(b.today)} />
            <Row k="Days paid" v={String(b.daysPaid)} />
          </dl>
        </section>
      </div>
      <div className="sk-two">
        <section className="sk-card">
          <header className="sk-card-head"><h2>Balances owed</h2></header>
          <div className="sk-big left"><b className="sk-num">{nice(t.owed)}</b><span>ZUBA</span></div>
          <dl className="sk-dl">
            <Row k="Staked" v={nice(t.staked)} />
            <Row k="Available" v={nice(t.available)} />
            <Row k="Being withdrawn" v={nice(t.withdrawing)} />
            <Row k="Accounts" v={`${t.accounts} · ${t.stakers} staking`} />
          </dl>
        </section>
        <section className="sk-card">
          <header className="sk-card-head"><h2>Wallets</h2></header>
          <dl className="sk-dl">
            {([["Vault", wl.vault], [d.manual ? "Paying wallet" : "Payout wallet", wl.payout], ["Token", wl.token]] as [string, string][]).map(([k, a]) => (
              <Row key={k} k={k} v={a ? <a className="sk-mono" href={`${d.explorer}/address/${a}`} target="_blank" rel="noreferrer">{short(a)}</a> : "Not set"} />
            ))}
          </dl>
        </section>
      </div>
      <section className="sk-card">
        <header className="sk-card-head"><h2>{d.manual ? "Withdrawals to pay" : "Waiting for approval"}</h2><span className="sk-pill">{d.approvals!.length}</span></header>
        {d.manual && <p className="sk-sub-copy">{d.notify?.working ? `New requests are emailed to ${d.notify.email}.` : "Email notices are off on this site."} Pay from your own wallet, then confirm with the transaction.</p>}
        {!d.approvals!.length ? <p className="sk-muted">Nothing is waiting.</p> : !d.manual ? <List items={d.approvals!} actions /> : (
          <div className="sk-pay">
            {d.approvals!.map((x) => {
              const good = x.check === "verified";
              return (
                <article key={x.id} className={`sk-payrow ${x.check === "failed" || x.check === "invalid" ? "danger" : ""}`}>
                  <header>
                    <b className="sk-num">#{x.id}</b>
                    <span className="sk-muted">{when(x.at)}</span>
                    <span className={`sk-pill ${good ? "ok" : x.check === "pending" ? "wait" : "bad"}`}>{good ? "Verified on-chain" : x.check === "pending" ? "Checking" : "Do not pay"}</span>
                  </header>
                  {!good && x.check !== "pending" && <p className="sk-note err">{x.check === "invalid" ? "This request's check is missing or was altered. Do not pay it." : `This request ${x.checkNote || "failed its deposit check"}. Do not pay it.`}</p>}
                  <dl className="sk-dl">
                    <div><dt>Amount</dt><dd><span className="sk-num">{nice(x.amount, 18)}</span> {d.symbol} <button type="button" className="sk-ghost" onClick={() => copy(x.raw || x.amount, `a${x.id}`)}>{copied === `a${x.id}` ? "Copied" : "Copy"}</button></dd></div>
                    <div><dt>To</dt><dd><span className="sk-mono sk-wrapaddr">{x.to}</span> <button type="button" className="sk-ghost" onClick={() => copy(x.to, `t${x.id}`)}>{copied === `t${x.id}` ? "Copied" : "Copy"}</button></dd></div>
                  </dl>
                  <div className="sk-actions">
                    <button type="button" className="sk-btn primary" disabled={!good} onClick={() => open({ action: "settle", id: x.id, amount: x.amount, to: x.to })}>I have paid this</button>
                    <button type="button" className="sk-btn" onClick={() => open({ action: "decide", id: x.id, approve: false, amount: x.amount, to: x.to })}>Decline</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section className="sk-card">
        <header className="sk-card-head"><h2>Recent withdrawals</h2></header>
        {d.recent!.length ? <List items={d.recent!} /> : <p className="sk-muted">None yet.</p>}
      </section>
      <section className="sk-card">
        <header className="sk-card-head"><h2>Alerts</h2></header>
        {d.alerts!.length ? (
          <ul className="sk-rows tight">{d.alerts!.map((x, i) => <li key={i}><div><span className={`sk-pill ${x.level === "critical" ? "bad" : x.level === "warning" ? "wait" : ""}`}>{x.level}</span><span>{x.msg}</span></div><span className="sk-muted">{when(x.at)}</span></li>)}</ul>
        ) : <p className="sk-muted">No alerts.</p>}
      </section>

      {ask && (
        <div className="sk-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setAsk(null)}>
          <div className="sk-sheet">
            <header><h2>{ask.action === "resume" ? "Resume staking" : ask.action === "settle" ? "Confirm payment" : ask.approve ? "Approve withdrawal" : "Decline withdrawal"}</h2><button type="button" className="sk-x" onClick={() => setAsk(null)} aria-label="Close">×</button></header>
            {ask.action !== "resume" && (
              <dl className="sk-dl">
                <Row k="Withdrawal" v={`#${ask.id}`} />
                <Row k="Amount" v={`${nice(ask.amount, 2)} ZUBA`} />
                <Row k="To" v={<span className="sk-mono sk-wrapaddr">{ask.to}</span>} />
              </dl>
            )}
            {ask.action === "settle" && (
              <div className="sk-field">
                <div className="sk-field-top"><label htmlFor="sa-tx">Transaction hash or BscScan link</label></div>
                <input id="sa-tx" className="sk-input sk-mono" placeholder="0x" autoComplete="off" spellCheck={false} autoFocus value={tx} onChange={(e) => setTx(e.target.value.trim())} />
              </div>
            )}
            <div className="sk-field">
              <div className="sk-field-top"><label htmlFor="sa-code">Admin authenticator code</label></div>
              <input id="sa-code" className="sk-input sk-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" autoFocus={ask.action !== "settle"} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            {err && <p className="sk-note err" role="alert">{err}</p>}
            <button type="button" className="sk-btn primary wide" disabled={busy || code.length !== 6 || (ask.action === "settle" && !/0x[0-9a-fA-F]{64}/.test(tx))} onClick={() => send(ask.action === "resume" ? { action: "resume", code } : ask.action === "settle" ? { action: "settle", id: ask.id, tx, code } : { action: "decide", id: ask.id, approve: ask.approve, code }, ask.action === "resume" ? "Staking resumed" : ask.action === "settle" ? "Payment confirmed" : ask.approve ? "Approved" : "Declined")}>{busy ? "Working…" : "Confirm"}</button>
          </div>
        </div>
      )}
      {note && <div className="sk-toast" role="status">{note}</div>}
      {err && !ask && <p className="sk-note err" role="alert">{err}</p>}
    </div>
  );
}
