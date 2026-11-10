"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/* ---------- types (what /api/stake returns) ---------- */
type Token = { symbol: string; contract: string; chain: string; chainId: number; explorer: string };
type Program = { day: number; programDays: number; dayMs: number; nextDayAt: number; budget: string; paid: string; dailyPool: string; totalStaked: string; stakers: number };
type Me = {
  email: string; test: boolean; token: Token; paused: boolean; apy: Record<string, number>; maxApy: number; day: number; dayMs: number; program: Program;
  weights: Record<string, number>; address: string | null; twoFactor: "on" | "pending" | "off"; depositsOpen: boolean;
  balance: { available: string; staked: string; pendingWithdrawal: string; rewards: string; total: string };
  positions: { id: number; amount: string; lockDays: number; weight: number; startedAt: string; unlockAt: string; earned: string; canUnstake: boolean }[];
  deposits: { tx: string; amount: string; status: string; at: string }[];
  withdrawals: { id: number; to: string; amount: string; status: string; tx: string | null; at: string }[];
  history: { kind: string; amount: string; at: string }[];
  addresses: { address: string; activeAt: string; active: boolean }[];
  limits: { minStake: string; minWithdraw: string; autoLimit: string; userDaily: string; confirmations: number; whitelistDelayMs: number; maxAddresses: number; faucetAmount: string | null };
  workerSecondsAgo: number | null;
  admin: null | { queue: { id: number; user: string; to: string; amount: string; status: string; at: string }[]; alerts: { at: string; level: string; msg: string }[]; pauseReason: string | null };
};
type Pub = { enabled: boolean; test?: boolean; token?: Token; paused?: boolean; program?: Program; apy?: Record<string, number>; maxApy?: number };
type Refresh = () => Promise<void>;

/* ---------- helpers ---------- */
async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/stake/${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json", "x-zs": "1" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Something went wrong. Try again."), { status: r.status });
  return j as T;
}
function nice(s: string | undefined, dp = 4) {
  if (!s) return "0";
  const [w, f = ""] = s.split(".");
  const frac = f.slice(0, dp).replace(/0+$/, "");
  return w.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? "." + frac : "");
}
function compact(s: string | undefined) {
  const n = Number((s || "0").split(".")[0]);
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.?0+$/, "") + "K";
  return nice(s, 2);
}
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const when = (d: string) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function span(ms: number) {
  if (ms <= 0) return "now";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
const lockName = (d: number) => (d === 0 ? "Flexible" : `${d} days`);
const num = (s: string) => Number(s || 0);

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
function useCopy() {
  const [done, setDone] = useState("");
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setDone(text); setTimeout(() => setDone(""), 1600);
  };
  return { done, copy };
}
function useAction(refresh: Refresh) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /** Runs one request. Resolves true when it worked. */
  const run = async <T,>(body: Record<string, unknown>, then?: (r: T) => void) => {
    setBusy(true); setErr("");
    try {
      const r = await api<T>("act", body);
      then?.(r);
      await refresh();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, run, reset: () => setErr("") };
}

/* ---------- small pieces ---------- */
const ICONS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  down: "M12 3v13m0 0-5-5m5 5 5-5M4 21h16",
  lock: "M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
  up: "M12 21V8m0 0-5 5m5-5 5 5M4 3h16",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  shield: "M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z",
  copy: "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  check: "m5 12.5 4.5 4.5L19 7",
  out: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4m4 4H4",
  ext: "M14 4h6v6m0-6-9 9M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  chev: "m9 6 6 6-6 6",
};
function Ico({ n, s = 18 }: { n: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[n]} /></svg>;
}
function Qr({ text, size = 168 }: { text: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: size * 2, color: { dark: "#0b0716", light: "#ffffff" } }).then(setSrc).catch(() => setSrc("")); }, [text, size]);
  return <span className="sk-qr" style={{ width: size, height: size }}>{src && <img src={src} width={size} height={size} alt="QR code" />}</span>;
}
function Err({ children }: { children: React.ReactNode }) {
  return children ? <p className="sk-note err" role="alert">{children}</p> : null;
}
function CodeInput({ value, onChange, id, autoFocus }: { value: string; onChange: (v: string) => void; id: string; autoFocus?: boolean }) {
  return <input id={id} className="sk-input sk-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />;
}
function Field({ label, hint, htmlFor, children }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode }) {
  return <div className="sk-field"><div className="sk-field-top"><label htmlFor={htmlFor}>{label}</label>{hint && <span>{hint}</span>}</div>{children}</div>;
}
function Card({ title, aside, children, className = "" }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`sk-card ${className}`}>
      {title && <header className="sk-card-head"><h2>{title}</h2>{aside}</header>}
      {children}
    </section>
  );
}
function Amount({ id, value, onChange, max, symbol }: { id: string; value: string; onChange: (v: string) => void; max: string; symbol: string }) {
  return (
    <div className="sk-amount">
      <input id={id} inputMode="decimal" placeholder="0" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} />
      <span className="sk-amount-sym">{symbol}</span>
      <button type="button" onClick={() => onChange(max)}>Max</button>
    </div>
  );
}
function Countdown({ to, now }: { to: number; now: number }) {
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (v: number) => String(v).padStart(2, "0");
  return <span className="sk-count">{h > 0 ? `${p(h)}:` : ""}{p(m)}:{p(x)}</span>;
}
/** A dialog: centred on desktop, a bottom sheet on phones. Esc or the backdrop closes it. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="sk-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sk-sheet">
        <header><h2>{title}</h2><button type="button" className="sk-x" onClick={onClose} aria-label="Close"><Ico n="x" /></button></header>
        {children}
      </div>
    </div>
  );
}
function Rows({ items }: { items: [string, React.ReactNode, string?][] }) {
  return <dl className="sk-dl">{items.map(([k, v, c]) => <div key={k}><dt>{k}</dt><dd className={c}>{v}</dd></div>)}</dl>;
}
function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return <div className="sk-toast" role="status"><Ico n="check" s={16} />{text}</div>;
}

/* ======================================================================================= */
const TABS: [string, string, string][] = [["overview", "Overview", "home"], ["deposit", "Deposit", "down"], ["stake", "Stake", "lock"], ["withdraw", "Withdraw", "up"], ["history", "History", "list"]];

export default function StakeApp() {
  const [pub, setPub] = useState<Pub | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("me"));
      setState("in");
    } catch (e) {
      if ((e as { status?: number }).status === 401) { setMe(null); setState("out"); }
    }
  }, []);
  useEffect(() => {
    api<Pub>("public").then(setPub).catch(() => setPub({ enabled: false }));
    refresh().then(() => setState((s) => (s === "loading" ? "out" : s)));
  }, [refresh]);
  useEffect(() => {
    if (state !== "in") return;
    timer.current = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [state, refresh]);
  const go = (t: string) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const clearToast = useCallback(() => setToast(""), []);

  if (!pub || state === "loading") return <Shell><div className="sk-loading" aria-label="Loading" /></Shell>;
  if (!pub.enabled) {
    return (
      <Shell>
        <Card className="sk-narrow sk-center">
          <span className="sk-eyebrow">Coming soon</span>
          <h2 className="sk-h1">ZUBA Staking</h2>
          <p className="sk-muted">Not open yet.</p>
        </Card>
      </Shell>
    );
  }
  if (state === "out" || !me) return <Shell test={pub.test}><SignedOut pub={pub} onDone={refresh} /></Shell>;

  const ready = me.twoFactor === "on" && me.address;
  const tabs = [...TABS, ...(me.admin ? [["admin", "Admin", "shield"] as [string, string, string]] : [])];
  const signOut = async () => { await api("logout", {}); setMe(null); setState("out"); };
  return (
    <Shell test={me.test}>
      <div className="sk-topline">
        <span className="sk-who" title={me.email}>{me.email}</span>
        <button type="button" className="sk-ghost" onClick={signOut}><Ico n="out" s={16} /> Sign out</button>
      </div>
      {me.paused && <p className="sk-note warn" role="status">Staking is paused. Balances are safe.</p>}
      {!ready ? <Setup me={me} refresh={refresh} /> : (
        <>
          <Hero me={me} go={go} />
          <nav className="sk-tabs" aria-label="Staking sections">
            {tabs.map(([k, label, icon]) => (
              <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => go(k)} aria-current={tab === k ? "page" : undefined}><Ico n={icon} /><span>{label}</span></button>
            ))}
          </nav>
          <div className="sk-view" key={tab}>
            {tab === "overview" && <Overview me={me} go={go} refresh={refresh} say={setToast} />}
            {tab === "deposit" && <Deposit me={me} refresh={refresh} say={setToast} />}
            {tab === "stake" && <Stake me={me} refresh={refresh} say={setToast} />}
            {tab === "withdraw" && <Withdraw me={me} refresh={refresh} say={setToast} />}
            {tab === "history" && <History me={me} />}
            {tab === "admin" && me.admin && <Admin me={me} refresh={refresh} say={setToast} />}
          </div>
        </>
      )}
      {toast && <Toast text={toast} onDone={clearToast} />}
    </Shell>
  );
}

function Shell({ children, test }: { children: React.ReactNode; test?: boolean }) {
  return (
    <div className="page sk">
      <div className="sk-wrap">
        {test && <div className="sk-test"><b>Testnet</b> Tokens here have no value.</div>}
        {children}
      </div>
    </div>
  );
}

/* ---------- signed out ---------- */
function SignedOut({ pub, onDone }: { pub: Pub; onDone: Refresh }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api("login", { email, password }); await onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const apy = pub.apy || {}, p = pub.program!;
  const W: Record<string, number> = { 0: 1, 30: 1.25, 90: 1.5, 180: 2 };
  return (
    <>
      <div className="sk-landing">
        <div className="sk-landing-copy">
          <span className="sk-eyebrow">ZUBA Staking</span>
          <h1 className="sk-display">Stake ZUBA.<br /><em>Earn daily.</em></h1>
          <p className="sk-lead">Lock longer, earn a larger share.</p>
          <dl className="sk-facts">
            <div><dt>Total staked</dt><dd className="sk-num">{compact(p.totalStaked)}</dd></div>
            <div><dt>Stakers</dt><dd className="sk-num">{p.stakers}</dd></div>
            <div><dt>Daily rewards</dt><dd className="sk-num gold">{compact(p.dailyPool)}</dd></div>
          </dl>
        </div>
        <form className="sk-card sk-signin" onSubmit={submit}>
          <header className="sk-card-head"><h2>Sign in</h2></header>
          <Field label="Email" htmlFor="stk-email"><input id="stk-email" className="sk-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" htmlFor="stk-pw"><input id="stk-pw" className="sk-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Err>{err}</Err>
          <button className="sk-btn primary wide" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="sk-fine sk-center">Use your Zualingo account. <a href="/play">Create one</a></p>
        </form>
      </div>
      <div className="sk-tiers">
        {Object.keys(apy).map((d) => (
          <div key={d} className={`sk-tier ${d === "180" ? "top" : ""}`}>
            <span className="sk-eyebrow">{lockName(Number(d))}</span>
            <b className="sk-num">{apy[d]}<small>%</small></b>
            <i>APY · {W[d]}× share</i>
          </div>
        ))}
      </div>
      <p className="sk-fine sk-center">Variable rate, capped at {pub.maxApy}% APY.</p>
    </>
  );
}

/* ---------- first-time set-up ---------- */
function Setup({ me, refresh }: { me: Me; refresh: Refresh }) {
  const a = useAction(refresh);
  const [secret, setSecret] = useState<{ secret: string; url: string } | null>(null);
  const [code, setCode] = useState("");
  const [manual, setManual] = useState(false);
  const { done, copy } = useCopy();
  const step = me.twoFactor === "on" ? 2 : 1;
  return (
    <Card className="sk-narrow">
      <ol className="sk-steps"><li className={step === 1 ? "on" : "done"}><span>{step === 1 ? "1" : <Ico n="check" s={14} />}</span>Security</li><li className={step === 2 ? "on" : ""}><span>2</span>Deposit address</li></ol>
      {step === 1 && !secret && (
        <>
          <h2 className="sk-h1">Secure your account</h2>
          <p className="sk-muted">Two-factor authentication is required for withdrawals.</p>
          <Err>{a.err}</Err>
          <button type="button" className="sk-btn primary" disabled={a.busy} onClick={() => a.run<{ secret: string; url: string }>({ kind: "2fa_setup" }, (r) => setSecret(r))}>{a.busy ? "Preparing…" : "Set up authenticator"}</button>
        </>
      )}
      {step === 1 && secret && (
        <>
          <h2 className="sk-h1">Scan with your authenticator</h2>
          <div className="sk-qrrow">
            <Qr text={secret.url} />
            <div>
              <Field label="Verification code" htmlFor="stk-c1"><CodeInput id="stk-c1" value={code} onChange={setCode} /></Field>
              <button type="button" className="sk-ghost" onClick={() => setManual((v) => !v)}>{manual ? "Hide setup key" : "Can't scan? Show setup key"}</button>
              {manual && (
                <div className="sk-keybox">
                  <p className="sk-mono sk-key">{secret.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
                  <button type="button" className="sk-ghost" onClick={() => copy(secret.secret)}><Ico n={done === secret.secret ? "check" : "copy"} s={15} /> {done === secret.secret ? "Copied" : "Copy"}</button>
                </div>
              )}
            </div>
          </div>
          <p className="sk-fine">Store the setup key offline. It is not shown again.</p>
          <Err>{a.err}</Err>
          <button type="button" className="sk-btn primary" disabled={a.busy || code.length !== 6} onClick={() => a.run({ kind: "2fa_enable", code })}>{a.busy ? "Verifying…" : "Verify"}</button>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="sk-h1">Your deposit address</h2>
          <p className="sk-muted">One address, unique to your account.</p>
          <Err>{a.err}</Err>
          <button type="button" className="sk-btn primary" disabled={a.busy} onClick={() => a.run({ kind: "address" })}>{a.busy ? "Generating…" : "Generate address"}</button>
        </>
      )}
    </Card>
  );
}

/* ---------- the balance header ---------- */
function Hero({ me, go }: { me: Me; go: (t: string) => void }) {
  const now = useNow();
  const b = me.balance;
  const total = num(b.total) || 1;
  const parts: [string, string, string][] = [["Staked", b.staked, "staked"], ["Available", b.available, "avail"], ["Withdrawing", b.pendingWithdrawal, "out"]];
  return (
    <section className="sk-hero">
      <div className="sk-hero-main">
        <span className="sk-eyebrow">Total balance</span>
        <div className="sk-total"><b className="sk-num">{nice(b.total, 2)}</b><span>{me.token.symbol}</span></div>
        <div className="sk-split" aria-hidden="true">
          {parts.map(([, v, c]) => num(v) > 0 && <span key={c} className={c} style={{ flexGrow: num(v) / total }} />)}
          {num(b.total) === 0 && <span className="none" style={{ flexGrow: 1 }} />}
        </div>
        <ul className="sk-legend">
          {parts.map(([label, v, c]) => (c !== "out" || num(v) > 0) && <li key={c}><i className={c} />{label}<b className="sk-num">{nice(v, 2)}</b></li>)}
        </ul>
      </div>
      <div className="sk-hero-side">
        <div className="sk-earned">
          <span className="sk-eyebrow">Rewards earned</span>
          <b className="sk-num gold">{nice(b.rewards, 4)}</b>
          {num(b.staked) > 0 && <span className="sk-next">Next reward <Countdown to={me.program.nextDayAt} now={now} /></span>}
        </div>
        <div className="sk-hero-actions">
          <button type="button" className="sk-btn primary" onClick={() => go("stake")}>Stake</button>
          <button type="button" className="sk-btn" onClick={() => go("deposit")}>Deposit</button>
          <button type="button" className="sk-btn" onClick={() => go("withdraw")}>Withdraw</button>
        </div>
      </div>
    </section>
  );
}

/* ---------- overview ---------- */
type Say = (t: string) => void;
function Overview({ me, go, refresh, say }: { me: Me; go: (t: string) => void; refresh: Refresh; say: Say }) {
  const funded = num(me.balance.available) > 0;
  return (
    <>
      <Card title="Stakes" aside={me.positions.length > 0 && <button type="button" className="sk-ghost" onClick={() => go("stake")}><Ico n="plus" s={15} /> New</button>}>
        <Positions me={me} refresh={refresh} say={say} empty={<div className="sk-empty"><p>{funded ? "Nothing staked yet." : "No balance yet."}</p><button type="button" className="sk-btn primary" onClick={() => go(funded ? "stake" : "deposit")}>{funded ? "Stake" : "Deposit"}</button></div>} />
      </Card>
      {me.history.length > 0 && (
        <Card title="Recent activity" aside={<button type="button" className="sk-ghost" onClick={() => go("history")}>View all <Ico n="chev" s={14} /></button>}>
          <Ledger items={me.history.slice(0, 4)} />
        </Card>
      )}
    </>
  );
}
function Positions({ me, refresh, say, empty }: { me: Me; refresh: Refresh; say: Say; empty?: React.ReactNode }) {
  const a = useAction(refresh);
  const now = useNow(5000);
  if (!me.positions.length) return <>{empty ?? <p className="sk-muted">No stakes.</p>}</>;
  return (
    <>
      <Err>{a.err}</Err>
      <div className="sk-positions">
        {me.positions.map((p) => {
          const start = new Date(p.startedAt).getTime(), end = new Date(p.unlockAt).getTime();
          const pct = p.lockDays === 0 || end <= start ? 100 : Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
          return (
            <article key={p.id} className="sk-pos">
              <header><span className="sk-pill strong">{lockName(p.lockDays)}</span><span className="sk-pos-earn sk-num gold">+{nice(p.earned, 2)}</span></header>
              <b className="sk-num">{nice(p.amount, 2)}</b>
              {p.lockDays > 0 && <div className="sk-bar"><span style={{ width: `${pct}%` }} /></div>}
              <footer>
                <span>{p.lockDays === 0 ? "No lock" : p.canUnstake ? "Unlocked" : `Unlocks in ${span(end - now)}`}</span>
                {p.canUnstake && <button type="button" className="sk-ghost" disabled={a.busy} onClick={async () => (await a.run({ kind: "unstake", id: p.id })) && say("Unstaked")}>Unstake</button>}
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ---------- deposit ---------- */
function Deposit({ me, refresh, say }: { me: Me; refresh: Refresh; say: Say }) {
  const { done, copy } = useCopy();
  const a = useAction(refresh);
  const addr = me.address!;
  return (
    <div className="sk-two wide-left">
      <Card title="Deposit" aside={<span className="sk-pill strong">{me.token.chainId === 56 ? "BNB Smart Chain" : "BNB Testnet"}</span>}>
        <div className="sk-qrrow">
          <Qr text={addr} />
          <div>
            <span className="sk-eyebrow">Your {me.token.symbol} address</span>
            <p className="sk-mono sk-addr">{addr}</p>
            <button type="button" className="sk-btn primary" onClick={() => copy(addr)}><Ico n={done === addr ? "check" : "copy"} /> {done === addr ? "Copied" : "Copy"}</button>
          </div>
        </div>
        <p className="sk-warnline">Send only {me.token.symbol} (BEP-20). Credited after {me.limits.confirmations} confirmations.</p>
        <details className="sk-more">
          <summary>Token contract</summary>
          <a className="sk-mono" href={`${me.token.explorer}/token/${me.token.contract}`} target="_blank" rel="noreferrer">{me.token.contract} <Ico n="ext" s={13} /></a>
        </details>
        {me.limits.faucetAmount && me.depositsOpen && (
          <div className="sk-testbox">
            <span>Need test tokens?</span>
            <button type="button" className="sk-btn" disabled={a.busy} onClick={async () => (await a.run({ kind: "faucet" })) && say("Test ZUBA on its way")}>{a.busy ? "Sending…" : `Get ${compact(me.limits.faucetAmount)} test ZUBA`}</button>
            <Err>{a.err}</Err>
          </div>
        )}
        {!me.depositsOpen && <p className="sk-note warn">Deposits open soon.</p>}
      </Card>
      <Card title="Deposits">
        {!me.deposits.length ? <p className="sk-muted">No deposits yet.</p> : (
          <ul className="sk-rows">
            {me.deposits.map((d) => (
              <li key={d.tx}>
                <div><b className="sk-num plus">+{nice(d.amount, 2)}</b><span>{when(d.at)}</span></div>
                <span className={`sk-pill ${d.status === "credited" ? "ok" : "wait"}`}>{d.status === "credited" ? "Completed" : "Confirming"}</span>
                <a className="sk-ghost" href={`${me.token.explorer}/tx/${d.tx}`} target="_blank" rel="noreferrer" aria-label="View transaction"><Ico n="ext" s={15} /></a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- stake ---------- */
function Stake({ me, refresh, say }: { me: Me; refresh: Refresh; say: Say }) {
  const [amount, setAmount] = useState("");
  const [lock, setLock] = useState(90);
  const [review, setReview] = useState(false);
  const a = useAction(refresh);
  const sym = me.token.symbol, amt = Number(amount) || 0, apy = me.apy[String(lock)] ?? 0;
  const yearly = (amt * apy) / 100;
  const unlock = lock === 0 ? "Any time" : new Date(Date.now() + lock * me.dayMs).toLocaleString(undefined, me.dayMs === 86_400_000 ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const f = (v: number) => nice(v.toFixed(v < 100 ? 2 : 0), 2);
  const low = amt > 0 && amt < num(me.limits.minStake), over = amt > num(me.balance.available);
  return (
    <>
      <Card title="Stake" className="sk-narrow-l">
        <Field label="Amount" htmlFor="stk-amt" hint={<>Available <b className="sk-num">{nice(me.balance.available, 2)}</b></>}>
          <Amount id="stk-amt" value={amount} onChange={setAmount} max={me.balance.available} symbol={sym} />
        </Field>
        <Field label="Lock">
          <div className="sk-locks" role="radiogroup" aria-label="Lock">
            {Object.keys(me.apy).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={lock === Number(d)} className={lock === Number(d) ? "on" : ""} onClick={() => setLock(Number(d))}>
                <span>{lockName(Number(d))}</span>
                <b className="sk-num">{me.apy[d]}%</b>
              </button>
            ))}
          </div>
        </Field>
        {(low || over) && <p className="sk-hint bad">{over ? "Exceeds available balance" : `Minimum ${nice(me.limits.minStake)} ${sym}`}</p>}
        <button type="button" className="sk-btn primary wide" disabled={!amt || low || over || me.paused} onClick={() => { a.reset(); setReview(true); }}>Review</button>
      </Card>
      <Card title="Stakes"><Positions me={me} refresh={refresh} say={say} /></Card>
      {review && (
        <Modal title="Confirm stake" onClose={() => setReview(false)}>
          <div className="sk-big"><b className="sk-num">{nice(amount, 2)}</b><span>{sym}</span></div>
          <Rows items={[["Lock", lockName(lock)], ["Unlocks", unlock], ["Est. APY", `${apy}%`], ["Est. daily", `+${f(yearly / 365)} ${sym}`, "gold"]]} />
          {lock > 0 && <p className="sk-fine">Locked stakes can&apos;t be withdrawn early.</p>}
          <Err>{a.err}</Err>
          <button type="button" className="sk-btn primary wide" disabled={a.busy} onClick={async () => { if (await a.run({ kind: "stake", amount, lock })) { setReview(false); setAmount(""); say("Staked"); } }}>{a.busy ? "Staking…" : "Confirm"}</button>
        </Modal>
      )}
    </>
  );
}

/* ---------- withdraw ---------- */
const W_LABEL: Record<string, [string, string]> = { review: ["In review", "wait"], queued: ["Processing", "wait"], sending: ["Sending", "wait"], sent: ["Completed", "ok"], failed: ["Failed", "bad"], cancelled: ["Cancelled", ""], rejected: ["Declined", "bad"] };

function Withdraw({ me, refresh, say }: { me: Me; refresh: Refresh; say: Say }) {
  const active = me.addresses.filter((x) => x.active);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const w = useAction(refresh), rm = useAction(refresh), cancel = useAction(refresh);
  const sym = me.token.symbol, amt = Number(amount) || 0;
  const dest = to || active[0]?.address || "";
  const low = amt > 0 && amt < num(me.limits.minWithdraw), over = amt > num(me.balance.available);
  return (
    <>
      <div className="sk-two wide-left">
        <Card title="Withdraw">
          <Field label="Amount" htmlFor="stk-wamt" hint={<>Available <b className="sk-num">{nice(me.balance.available, 2)}</b></>}>
            <Amount id="stk-wamt" value={amount} onChange={setAmount} max={me.balance.available} symbol={sym} />
          </Field>
          <Field label="To">
            {active.length ? (
              <div className="sk-dests" role="radiogroup" aria-label="To">
                {active.map((x) => <button key={x.address} type="button" role="radio" aria-checked={dest === x.address} className={dest === x.address ? "on" : ""} onClick={() => setTo(x.address)}><span className="sk-mono">{x.address}</span></button>)}
              </div>
            ) : (
              <button type="button" className="sk-addfirst" onClick={() => setAdding(true)}><Ico n="plus" s={16} /> Add a withdrawal address</button>
            )}
          </Field>
          {(low || over) && <p className="sk-hint bad">{over ? "Exceeds available balance" : `Minimum ${nice(me.limits.minWithdraw)} ${sym}`}</p>}
          <button type="button" className="sk-btn primary wide" disabled={!amt || !dest || low || over || me.paused} onClick={() => { w.reset(); setCode(""); setConfirm(true); }}>Continue</button>
          <details className="sk-more">
            <summary>Limits</summary>
            <Rows items={[["Instant, up to", `${compact(me.limits.autoLimit)} ${sym}`], ["Daily", `${compact(me.limits.userDaily)} ${sym}`]]} />
          </details>
        </Card>
        <Card title="Addresses" aside={me.addresses.length < me.limits.maxAddresses && <button type="button" className="sk-ghost" onClick={() => setAdding(true)}><Ico n="plus" s={15} /> Add</button>}>
          <Err>{rm.err}</Err>
          {!me.addresses.length ? <p className="sk-muted">No saved addresses.</p> : (
            <ul className="sk-rows tight">
              {me.addresses.map((x) => (
                <li key={x.address}>
                  <div><span className="sk-mono" title={x.address}>{short(x.address)}</span>{!x.active && <span className="sk-pill wait">Active in {span(new Date(x.activeAt).getTime() - Date.now())}</span>}</div>
                  <button type="button" className="sk-ghost dim" disabled={rm.busy} onClick={() => rm.run({ kind: "whitelist_remove", address: x.address })}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {me.withdrawals.length > 0 && (
        <Card title="Withdrawals">
          <Err>{cancel.err}</Err>
          <ul className="sk-rows">
            {me.withdrawals.map((x) => {
              const [label, tone] = W_LABEL[x.status] || [x.status, ""];
              return (
                <li key={x.id}>
                  <div><b className="sk-num">{nice(x.amount, 2)} {sym}</b><span><span className="sk-mono">{short(x.to)}</span> · {when(x.at)}</span></div>
                  <span className={`sk-pill ${tone}`}>{label}</span>
                  <div className="sk-row-actions">
                    {x.tx && <a className="sk-ghost" href={`${me.token.explorer}/tx/${x.tx}`} target="_blank" rel="noreferrer" aria-label="View transaction"><Ico n="ext" s={15} /></a>}
                    {(x.status === "review" || x.status === "queued") && <button type="button" className="sk-ghost dim" disabled={cancel.busy} onClick={async () => (await cancel.run({ kind: "withdraw_cancel", id: x.id })) && say("Withdrawal cancelled")}>Cancel</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {confirm && (
        <Modal title="Confirm withdrawal" onClose={() => setConfirm(false)}>
          <div className="sk-big"><b className="sk-num">{nice(amount, 2)}</b><span>{sym}</span></div>
          <Rows items={[["To", <span key="a" className="sk-mono sk-wrapaddr">{dest}</span>], ["Network", me.token.chainId === 56 ? "BNB Smart Chain" : "BNB Testnet"]]} />
          <Field label="Authenticator code" htmlFor="stk-wc"><CodeInput id="stk-wc" value={code} onChange={setCode} autoFocus /></Field>
          <Err>{w.err}</Err>
          <button type="button" className="sk-btn primary wide" disabled={w.busy || code.length !== 6} onClick={async () => { let review = false; if (await w.run<{ status: string }>({ kind: "withdraw", amount, address: dest, code }, (r) => { review = r.status === "review"; })) { setConfirm(false); setAmount(""); say(review ? "Withdrawal submitted for review" : "Withdrawal submitted"); } }}>{w.busy ? "Submitting…" : "Confirm"}</button>
        </Modal>
      )}
      {adding && <AddAddress me={me} refresh={refresh} onClose={() => setAdding(false)} say={say} />}
    </>
  );
}
function AddAddress({ me, refresh, onClose, say }: { me: Me; refresh: Refresh; onClose: () => void; say: Say }) {
  const [addr, setAddr] = useState("");
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  const a = useAction(refresh);
  const valid = /^0x[0-9a-fA-F]{40}$/.test(addr);
  return (
    <Modal title={step === 1 ? "Add address" : "Verify"} onClose={onClose}>
      {step === 1 ? (
        <>
          <Field label="BNB Smart Chain address" htmlFor="stk-na"><input id="stk-na" className="sk-input sk-mono" placeholder="0x" autoComplete="off" spellCheck={false} autoFocus value={addr} onChange={(e) => setAddr(e.target.value.trim())} /></Field>
          {me.limits.whitelistDelayMs > 0 && <p className="sk-fine">New addresses activate after {span(me.limits.whitelistDelayMs)}.</p>}
          <button type="button" className="sk-btn primary wide" disabled={!valid} onClick={() => setStep(2)}>Continue</button>
        </>
      ) : (
        <>
          <Rows items={[["Address", <span key="a" className="sk-mono sk-wrapaddr">{addr}</span>]]} />
          <Field label="Authenticator code" htmlFor="stk-nc"><CodeInput id="stk-nc" value={code} onChange={setCode} autoFocus /></Field>
          <Err>{a.err}</Err>
          <div className="sk-modal-actions">
            <button type="button" className="sk-btn" onClick={() => { setStep(1); a.reset(); }}>Back</button>
            <button type="button" className="sk-btn primary" disabled={a.busy || code.length !== 6} onClick={async () => { if (await a.run({ kind: "whitelist_add", address: addr, code })) { onClose(); say("Address saved"); } }}>{a.busy ? "Saving…" : "Save"}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- history ---------- */
const LEDGER: Record<string, [string, string, string]> = {
  deposit: ["Deposit", "+", "down"], reward: ["Reward", "+", "check"], stake: ["Stake", "", "lock"], unstake: ["Unstake", "", "lock"],
  withdraw_hold: ["Withdrawal", "−", "up"], withdraw_release: ["Withdrawal returned", "+", "up"], withdraw_paid: ["Withdrawal sent", "", "up"],
};
function Ledger({ items }: { items: Me["history"] }) {
  return (
    <ul className="sk-rows history">
      {items.map((h, i) => {
        const [label, sign, icon] = LEDGER[h.kind] || [h.kind, "", "list"];
        return <li key={i}><div><span className={`sk-dot ${h.kind}`}><Ico n={icon} s={15} /></span><div className="sk-hl"><b>{label}</b><span>{when(h.at)}</span></div></div><b className={`sk-num ${h.kind === "reward" ? "gold" : sign === "+" ? "plus" : ""}`}>{sign}{nice(h.amount, 2)}</b></li>;
      })}
    </ul>
  );
}
function History({ me }: { me: Me }) {
  return <Card title="History">{me.history.length ? <Ledger items={me.history} /> : <p className="sk-muted">No activity yet.</p>}</Card>;
}

/* ---------- admin (owner only) ---------- */
function Admin({ me, refresh, say }: { me: Me; refresh: Refresh; say: Say }) {
  const a = useAction(refresh);
  const [code, setCode] = useState("");
  const ad = me.admin!, p = me.program;
  const waiting = ad.queue.filter((q) => q.status === "review");
  return (
    <>
      <div className="sk-two">
        <Card title="System" aside={<span className={`sk-pill ${me.paused ? "bad" : "ok"}`}>{me.paused ? "Paused" : "Running"}</span>}>
          <Rows items={[["Worker", me.workerSecondsAgo === null ? "Never seen" : `${me.workerSecondsAgo}s ago`], ...(me.paused ? [["Reason", ad.pauseReason || "None"] as [string, string]] : [])]} />
          <Field label="Admin code" htmlFor="stk-ac"><CodeInput id="stk-ac" value={code} onChange={setCode} /></Field>
          <Err>{a.err}</Err>
          {me.paused
            ? <button type="button" className="sk-btn primary" disabled={a.busy || code.length !== 6} onClick={async () => { if (await a.run({ kind: "admin_resume", code })) { setCode(""); say("Resumed"); } }}>Resume</button>
            : <button type="button" className="sk-btn" disabled={a.busy} onClick={async () => (await a.run({ kind: "admin_pause" })) && say("Paused")}>Pause staking</button>}
        </Card>
        <Card title="Reward budget">
          <Rows items={[["Budget", "10,000,000,000"], ["Paid", nice(p.paid, 0), "gold"], ["Today's pool", nice(p.dailyPool, 0)], ["Program day", `${p.day + 1} of ${p.programDays}`], ["Total staked", nice(p.totalStaked, 0)], ["Stakers", String(p.stakers)]]} />
        </Card>
      </div>
      <Card title="Approvals" aside={<span className="sk-pill">{waiting.length}</span>}>
        {!waiting.length ? <p className="sk-muted">Nothing waiting.</p> : (
          <ul className="sk-rows tight">
            {waiting.map((q) => (
              <li key={q.id}>
                <div><b className="sk-num">#{q.id} · {nice(q.amount, 2)}</b><span className="sk-mono">{short(q.to)}</span></div>
                <div className="sk-row-actions">
                  <button type="button" className="sk-ghost" disabled={a.busy || code.length !== 6} onClick={async () => { if (await a.run({ kind: "admin_decide", id: q.id, approve: true, code })) { setCode(""); say("Approved"); } }}>Approve</button>
                  <button type="button" className="sk-ghost dim" disabled={a.busy || code.length !== 6} onClick={async () => { if (await a.run({ kind: "admin_decide", id: q.id, approve: false, code })) { setCode(""); say("Declined"); } }}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Alerts">
        {!ad.alerts.length ? <p className="sk-muted">None.</p> : <ul className="sk-rows tight">{ad.alerts.map((x, i) => <li key={i}><div><span className={`sk-pill ${x.level === "critical" ? "bad" : ""}`}>{x.level}</span><span>{x.msg}</span></div><span className="sk-muted">{when(x.at)}</span></li>)}</ul>}
      </Card>
    </>
  );
}
