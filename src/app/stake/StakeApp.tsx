"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import Link from "next/link";

/* ---------- types (what /api/stake returns) ---------- */
type Token = { symbol: string; contract: string; chain: string; chainId: number; explorer: string };
type Program = { day: number; programDays: number; dayMs: number; nextDayAt: number; totalStaked: string; stakers: number };
type Me = {
  email: string; test: boolean; token: Token; paused: boolean; apy: Record<string, number>; maxApy: number; day: number; dayMs: number; program: Program;
  weights: Record<string, number>; address: string | null; twoFactor: "on" | "pending" | "off"; depositsOpen: boolean;
  balance: { available: string; staked: string; pendingWithdrawal: string; rewards: string; total: string };
  positions: { id: number; amount: string; lockDays: number; weight: number; startedAt: string; unlockAt: string; earned: string; canUnstake: boolean }[];
  deposits: { tx: string; amount: string; status: string; at: string }[];
  withdrawals: { id: number; to: string; amount: string; status: string; tx: string | null; at: string }[];
  history: { kind: string; amount: string; at: string }[];
  addresses: { address: string; activeAt: string; active: boolean }[];
  limits: { minStake: string; minStakeFloor: string; minDeposit: string; minWithdraw: string; autoLimit: string; userDaily: string; confirmations: number; whitelistDelayMs: number; maxAddresses: number; manual: boolean; faucetAmount: string | null };
  workerSecondsAgo: number | null;
};
type Pub = { enabled: boolean; test?: boolean; token?: Token; paused?: boolean; program?: Program; apy?: Record<string, number>; maxApy?: number };
type Refresh = () => Promise<void>;
type Account = { email: string; name: string; game: { zuba: number } | null };

/* One sign-in for the games too: the games read their own sign-in from the browser's storage, so it is put there once. */
const ARCADE_KEYS = ["FlutterSecureStorage.zr", "flutter.zr_fallback"];
function arcadeSignIn(token: unknown) {
  try {
    for (const k of ARCADE_KEYS) localStorage.removeItem(k);
    if (typeof token === "string" && token) localStorage.setItem("flutter.zr_fallback", JSON.stringify(token));
  } catch { /* storage blocked: the games will ask to sign in */ }
}

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
const lockName = (d: number) => (d === 0 ? "Flexible" : `Fixed · ${d} days`);
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
  back: "M15 6l-6 6 6 6",
  play: "M8 5.5v13l11-6.5z",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zm0 13a3 3 0 0 1 3-3h10",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-10v6m0-9.5h.01",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  wallet: "M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3.5M3 7.5V17a2.5 2.5 0 0 0 2.5 2.5H20a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5zM17 14h.01",
  star: "m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6L3.4 9.3l6-.7z",
  trend: "m3 17 6-6 4 4 8-8m0 0h-5m5 0v5",
  calc: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2.5 4h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01",
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
  // drawn at the top level of the staking page, so nothing on the page can sit on top of it
  const host = typeof document === "undefined" ? null : document.getElementById("sk-portal");
  if (!host) return null;
  return createPortal(
    <div className="sk-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sk-sheet">
        <header><h2>{title}</h2><button type="button" className="sk-x" onClick={onClose} aria-label="Close"><Ico n="x" /></button></header>
        {children}
      </div>
    </div>,
    host,
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
const TABS: [string, string, string][] = [["stake", "Stake", "lock"], ["deposit", "Deposit", "down"], ["withdraw", "Withdraw", "up"], ["history", "History", "list"]];

export default function StakeApp({ start = "hub" }: { start?: "hub" | "staking" }) {
  const [view, setView] = useState<"hub" | "staking">(start);
  const [account, setAccount] = useState<Account | null>(null);
  const [pub, setPub] = useState<Pub | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [tab, setTab] = useState("stake");
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
    if (state === "in") api<Account>("account").then(setAccount).catch(() => {});
    else setAccount(null);
  }, [state]);
  useEffect(() => {
    if (state !== "in") return;
    timer.current = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [state, refresh]);
  const go = (t: string) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const open = (v: "hub" | "staking") => { setView(v); window.history.replaceState(null, "", v === "hub" ? "/dashboard" : "/stake"); window.scrollTo({ top: 0 }); };
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
  const tabs = TABS;
  const signOut = async () => { await api("logout", {}); arcadeSignIn(null); setMe(null); setState("out"); setView("hub"); };
  if (view === "hub") {
    return (
      <Shell test={me.test} onSignOut={signOut}>
        <Hub me={me} pub={pub} account={account} open={() => open("staking")} />
        {toast && <Toast text={toast} onDone={clearToast} />}
      </Shell>
    );
  }
  return (
    <Shell test={me.test} onSignOut={signOut}>
      <div className="sk-crumb">
        <button type="button" className="sk-backbtn" onClick={() => open("hub")}><Ico n="back" s={18} /> Dashboard</button>
        <h1>Staking</h1>
      </div>
      {me.paused && <p className="sk-note warn" role="status">Staking is paused. Balances are safe.</p>}
      {!ready ? <Setup me={me} refresh={refresh} /> : (
        <>
          <Summary me={me} go={go} />
          <p className="sk-intro">Stake {me.token.symbol} to earn {me.token.symbol}. Rewards are paid to your balance once a day, and you choose between flexible and fixed terms for every stake.</p>
          <nav className="sk-tabs" aria-label="Staking sections">
            {tabs.map(([k, label, icon]) => (
              <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => go(k)} aria-current={tab === k ? "page" : undefined}><Ico n={icon} /><span>{label}</span></button>
            ))}
          </nav>
          <div className="sk-view" key={tab}>
            {tab === "deposit" && <Deposit me={me} refresh={refresh} say={setToast} />}
            {tab === "stake" && <Stake me={me} go={go} refresh={refresh} say={setToast} />}
            {tab === "withdraw" && <Withdraw me={me} refresh={refresh} say={setToast} />}
            {tab === "history" && <History me={me} />}
          </div>
        </>
      )}
      {toast && <Toast text={toast} onDone={clearToast} />}
    </Shell>
  );
}

function Shell({ children, test, onSignOut }: { children: React.ReactNode; test?: boolean; onSignOut?: () => void }) {
  return (
    <div className="page sk">
      <header className="sk-top">
        <Link href="/" className="sk-exit"><Ico n="back" s={18} /><span>Website</span></Link>
        <span className="sk-brand"><img src="/brand/zuba-coin.png" width={34} height={34} alt="" /><b>ZUBA</b></span>
        {onSignOut ? <button type="button" className="sk-exit end" onClick={onSignOut}><span>Sign out</span><Ico n="out" s={18} /></button> : <span className="sk-exit end" aria-hidden="true" />}
      </header>
      <div className="sk-wrap">
        {test && <div className="sk-test"><b>Testnet</b> Tokens here have no value.</div>}
        {children}
      </div>
      <div id="sk-portal" />
    </div>
  );
}

/* ---------- the pool and the calculator (shared by the public page and the dashboard) ---------- */
const WEIGHT: Record<string, number> = { 0: 1, 30: 1.25, 90: 1.5, 180: 2 };
const lockShort = (d: number) => (d === 0 ? "Flexible" : `${d}D`);
const dateIn = (days: number, dayMs: number) => new Date(Date.now() + days * dayMs).toLocaleString(undefined, dayMs === 86_400_000 ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const amountOf = (v: number) => nice(v.toFixed(v < 100 ? 2 : 0), 2);

function Pool({ token, program, apy, earned }: { token: Token; program: Program; apy: Record<string, number>; earned?: string }) {
  const rates = Object.values(apy), lo = Math.min(...rates), hi = Math.max(...rates);
  return (
    <section className="sk-card sk-pool">
      <header className="sk-pool-head">
        <img src="/brand/zuba-coin.png" width={52} height={52} alt="" />
        <div><h2>Stake {token.symbol}</h2><span>Earn {token.symbol}</span></div>
        <span className="sk-pill strong">Day {Math.min(program.day + 1, program.programDays)} of {program.programDays}</span>
      </header>
      <div className="sk-pool-main">
        {earned !== undefined && <div><span className="sk-eyebrow">Earned</span><b className="sk-num gold">{nice(earned, 2)}</b></div>}
        <div>
          <span className="sk-eyebrow">Est. APR</span>
          <b className="sk-num mint">{lo === hi ? `${hi}%` : `${lo}% – ${hi}%`}</b>
          <i>Annualized · ≈{(lo / 365).toFixed(3)}%{lo === hi ? "" : `–${(hi / 365).toFixed(3)}%`} a day today · variable</i>
        </div>
      </div>
      <Rows items={[["Total staked", <span key="t" className="sk-num">{compact(program.totalStaked)} {token.symbol}</span>], ["Stakers", <span key="s" className="sk-num">{program.stakers}</span>], ["Network", token.chainId === 56 ? "BNB Smart Chain" : "BNB Testnet"]]} />
    </section>
  );
}

/** Amount, lock option and what it is estimated to earn. The same block is the public calculator and the stake form. */
function Calc({ sym, apy, dayMs, amount, setAmount, lock, setLock, max, minLabel }: { sym: string; apy: Record<string, number>; dayMs: number; amount: string; setAmount: (v: string) => void; lock: number; setLock: (d: number) => void; max?: string; minLabel?: string }) {
  const amt = Number(amount) || 0, rate = apy[String(lock)] ?? 0;
  const days = lock || 30;
  const earn = (amt * rate * days) / 100 / 365;
  const pct = (f: number) => setAmount(f === 1 ? max! : String(Math.floor(num(max!) * f)));
  return (
    <>
      <Field label="Stake amount" htmlFor="stk-amt" hint={max !== undefined ? <>Balance <b className="sk-num">{nice(max, 2)} {sym}</b></> : minLabel}>
        <div className="sk-amount">
          <input id="stk-amt" inputMode="decimal" placeholder="0.0" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          <span className="sk-amount-sym">{sym}</span>
        </div>
      </Field>
      {max !== undefined && (
        <div className="sk-chips">
          {([[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "Max"]] as [number, string][]).map(([f, label]) => <button key={label} type="button" disabled={num(max) <= 0} onClick={() => pct(f)}>{label}</button>)}
        </div>
      )}
      <div className="sk-field">
        <div className="sk-field-top"><label>Lock option</label><span>APR estimate uses this weight</span></div>
        <div className="sk-lockgrid" role="radiogroup" aria-label="Lock option">
          {Object.keys(apy).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={lock === Number(d)} className={lock === Number(d) ? "on" : ""} onClick={() => setLock(Number(d))}>
              <span><b>{lockShort(Number(d))}</b><i>{(WEIGHT[d] ?? 1).toFixed(2)}× weight</i></span>
              <em className="sk-num">{apy[d]}%</em>
            </button>
          ))}
        </div>
      </div>
      <div className="sk-terms">
        {lock === 0 ? (
          <>
            <p><b>Flexible:</b> unstake at any time, with no fee. Rewards are paid to your balance once a day and can be withdrawn or staked again.</p>
            <p className="dim">Deposit fee: 0% | Unstake fee: 0% | No lock</p>
          </>
        ) : (
          <>
            <p><b>Fixed {lock} days:</b> earns {(WEIGHT[String(lock)] ?? 1).toFixed(2)}× the flexible weight. Your {sym} stays locked until {dateIn(lock, dayMs)} and cannot be unstaked early. Rewards are still paid daily and can be withdrawn at any time.</p>
            <p className="dim">Deposit fee: 0% | Early unstake: not available | Locked {lock} days</p>
          </>
        )}
        <p className="gold">A stake starts earning when the next reward day begins. Each day&apos;s reward is paid when that day ends.{lock > 0 ? " A fixed stake is confirmed with your authenticator code." : ""}</p>
      </div>
      <div className="sk-est">
        <div className="sk-est-top"><span className="sk-eyebrow">Estimated return</span><i>{lock === 0 ? "over 30 days" : `over ${lock} days`}</i></div>
        <div className="sk-est-big"><b className="sk-num">{amt ? `+${amountOf(earn)}` : "0"}</b><span>{sym}</span></div>
        <span className="sk-est-pct">+{amt ? ((earn / amt) * 100).toFixed(2) : "0.00"}%</span>
      </div>
      <div className="sk-field">
        <div className="sk-field-top"><label>Summary</label></div>
        <div className="sk-summary">
          <Rows items={[["Principal", <span key="p" className="sk-num">{nice(amount || "0", 2)} {sym}</span>], ["Est. APR", `${rate}%`], ["Lock option", `${lockShort(lock)} · ${(WEIGHT[String(lock)] ?? 1).toFixed(2)}× weight`], ["Unlocks", lock === 0 ? "Any time" : dateIn(lock, dayMs)], ["Total value", <span key="v" className="sk-num">{amountOf(amt + earn)} {sym}</span>, "strong"]]} />
          <p className="sk-fine">{lock === 0 ? "Flexible has no lock. The estimate uses a 30-day horizon. " : ""}Estimated at today&apos;s rate. Rates are variable.</p>
        </div>
      </div>
    </>
  );
}

/* ---------- signed out ---------- */
const FAQ: [string, string][] = [
  ["How are rewards calculated?", "Once a day, from the size of your stake and the weight of its lock option. Fixed terms carry a higher weight than flexible."],
  ["Is the rate fixed?", "No. The rate is variable and is updated every day. The figures shown are estimates at today's rate."],
  ["How long do rewards run?", "365 days from launch. Your staked ZUBA stays yours and can be withdrawn after rewards end."],
  ["When do rewards start?", "A stake starts earning when the next reward day begins, and each day's reward is paid when that day ends. So the first reward arrives between one and two days after you stake, then every day after that."],
  ["Can I unstake early?", "Flexible stakes can be unstaked at any time. Fixed stakes earn a higher rate and are released when the term ends."],
  ["How do withdrawals work?", "Withdrawals go to an address you have saved, on BNB Smart Chain, and are confirmed with your authenticator code."],
  ["Which token and network?", "ZUBA (BEP-20) on BNB Smart Chain only."],
];
function SignedOut({ pub, onDone }: { pub: Pub; onDone: Refresh }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await api<{ arcade?: string | null }>("login", { email, password }); arcadeSignIn(r.arcade); await onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const apy = pub.apy || {}, p = pub.program!, token = pub.token!;
  const [amount, setAmount] = useState("");
  const [lock, setLock] = useState(90);
  const signin = useRef<HTMLFormElement>(null);
  return (
    <>
      <div className="sk-landing">
        <div className="sk-landing-copy">
          <span className="sk-eyebrow">Your ZUBA account</span>
          <h1 className="sk-display">One sign-in.<br /><em>Games and staking.</em></h1>
          <p className="sk-lead">Sign in once to play the ZUBA Arcade, see your game balance and stake ZUBA for daily rewards.</p>
          <ul className="sk-ticks">
            <li><Ico n="check" s={16} />The same account as Zualingo and the ZUBA Arcade.</li>
            <li><Ico n="check" s={16} />Staking with no wallet connection. Deposit to your own address.</li>
            <li><Ico n="check" s={16} />Two-factor and saved addresses on every withdrawal.</li>
          </ul>
        </div>
        <form ref={signin} className="sk-card sk-signin" onSubmit={submit}>
          <header className="sk-card-head"><h2>Sign in</h2></header>
          <Field label="Email" htmlFor="stk-email"><input id="stk-email" className="sk-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" htmlFor="stk-pw"><input id="stk-pw" className="sk-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Err>{err}</Err>
          <button className="sk-btn primary wide" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="sk-fine sk-center">Use your Zualingo account. <a href="/play">Create one</a></p>
        </form>
      </div>
      <div className="sk-home">
        <div className="sk-home-side">
          <Pool token={token} program={p} apy={apy} />
          <Card title="How it works">
            <ol className="sk-how">
              <li><span>1</span><div><b>Deposit</b>Send ZUBA to your personal deposit address.</div></li>
              <li><span>2</span><div><b>Stake</b>Choose flexible or a fixed term.</div></li>
              <li><span>3</span><div><b>Earn</b>Rewards reach your balance every day.</div></li>
              <li><span>4</span><div><b>Withdraw</b>To a wallet address you have saved, confirmed with your authenticator.</div></li>
            </ol>
          </Card>
        </div>
        <section className="sk-card sk-panel">
          <header className="sk-panel-head"><span className="sk-icobox"><Ico n="calc" /></span><h2>Rewards calculator</h2></header>
          <Calc sym={token.symbol} apy={apy} dayMs={p.dayMs} amount={amount} setAmount={setAmount} lock={lock} setLock={setLock} />
          <button type="button" className="sk-btn primary wide" onClick={() => { signin.current?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById("stk-email")?.focus({ preventScroll: true }); }}>Sign in to stake</button>
        </section>
      </div>
      <div className="sk-sec-head"><h2 className="sk-h1">Questions</h2></div>
      <div className="sk-faq">
        {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </div>
    </>
  );
}

/* ---------- first-time set-up ---------- */
function Setup({ me, refresh }: { me: Me; refresh: Refresh }) {
  const a = useAction(refresh);
  const [secret, setSecret] = useState<{ secret: string; url: string } | null>(null);
  const [code, setCode] = useState("");
  const { done, copy } = useCopy();
  const step = me.twoFactor === "on" ? 2 : 1;
  return (
    <Card className="sk-narrow">
      <ol className="sk-steps"><li className={step === 1 ? "on" : "done"}><span>{step === 1 ? "1" : <Ico n="check" s={14} />}</span>Security</li><li className={step === 2 ? "on" : ""}><span>2</span>Deposit address</li></ol>
      {step === 1 && !secret && (
        <>
          <h2 className="sk-h1">Secure your account</h2>
          <p className="sk-muted">Set up two-factor authentication to protect your balance. You will use it to confirm every withdrawal.</p>
          <Err>{a.err}</Err>
          <button type="button" className="sk-btn primary" disabled={a.busy} onClick={() => a.run<{ secret: string; url: string }>({ kind: "2fa_setup" }, (r) => setSecret(r))}>{a.busy ? "Preparing…" : "Set up authenticator"}</button>
        </>
      )}
      {step === 1 && secret && (
        <>
          <h2 className="sk-h1">Add to your authenticator</h2>
          <p className="sk-muted">On this phone, copy the setup key and paste it into your authenticator app. On another device, scan the code.</p>
          <div className="sk-keybox">
            <span className="sk-eyebrow">Setup key</span>
            <p className="sk-mono sk-key">{secret.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
            <div className="sk-keyacts">
              <button type="button" className="sk-btn" onClick={() => copy(secret.secret)}><Ico n={done === secret.secret ? "check" : "copy"} s={15} /> {done === secret.secret ? "Copied" : "Copy key"}</button>
              <a className="sk-btn" href={secret.url}>Open authenticator app</a>
            </div>
          </div>
          <div className="sk-qrrow">
            <Qr text={secret.url} />
            <div>
              <Field label="Verification code" htmlFor="stk-c1"><CodeInput id="stk-c1" value={code} onChange={setCode} /></Field>
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
          <p className="sk-muted">You get one deposit address. It is unique to your account and never changes.</p>
          <Err>{a.err}</Err>
          <button type="button" className="sk-btn primary" disabled={a.busy} onClick={() => a.run({ kind: "address" })}>{a.busy ? "Generating…" : "Generate address"}</button>
        </>
      )}
    </Card>
  );
}

/* ---------- the dashboard: everything the account can do, on one screen ---------- */
function Hub({ me, pub, account, open }: { me: Me; pub: Pub; account: Account | null; open: () => void }) {
  const sym = me.token.symbol, b = me.balance;
  const rates = Object.values(pub.apy || me.apy), lo = Math.min(...rates), hi = Math.max(...rates);
  const name = account?.name || me.email.split("@")[0];
  const staking = num(b.total) > 0;
  return (
    <div className="sk-hub">
      <div className="sk-hello">
        <span className="sk-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <div><span>Welcome back</span><h1>{name}</h1></div>
      </div>
      <div className="sk-wallets">
        <section className="sk-wallet game">
          <header><span className="sk-icobox gold"><Ico n="play" /></span><span className="sk-eyebrow">Game balance</span></header>
          <div className="sk-wallet-num"><b className="sk-num">{account === null ? "…" : account.game ? account.game.zuba.toLocaleString("en-US") : "—"}</b><span>ZUBA</span></div>
          <p>{account && !account.game ? "Open the games to see your balance." : "Earned in the ZUBA Arcade and Zualingo."}</p>
          <a className="sk-btn primary wide" href="/play"><Ico n="play" s={16} /> Play games</a>
        </section>
        <section className="sk-wallet stake">
          <header><span className="sk-icobox"><Ico n="lock" /></span><span className="sk-eyebrow">Staking</span></header>
          <div className="sk-wallet-num"><b className="sk-num">{compact(b.total)}</b><span>{sym}</span></div>
          <p>{staking ? <>Staked <b>{compact(b.staked)}</b> · Rewards <b className="gold">+{compact(b.rewards)}</b></> : <>Earn {lo === hi ? `${hi}%` : `${lo}%–${hi}%`} APR, paid daily.</>}</p>
          <button type="button" className="sk-btn wide" onClick={open}>{staking ? "Open staking" : "Start staking"}</button>
        </section>
      </div>
      <h2 className="sk-hub-h">Explore</h2>
      <div className="sk-tiles">
        <a className="sk-tile" href="/play"><span className="sk-icobox gold"><Ico n="play" /></span><div><b>Games</b><span>Play the ZUBA Arcade</span></div><Ico n="chev" s={16} /></a>
        <button type="button" className="sk-tile" onClick={open}><span className="sk-icobox"><Ico n="trend" /></span><div><b>Staking</b><span>Stake ZUBA, earn daily</span></div><Ico n="chev" s={16} /></button>
        <Link className="sk-tile" href="/about"><span className="sk-icobox"><Ico n="info" /></span><div><b>About</b><span>The story of ZUBA</span></div><Ico n="chev" s={16} /></Link>
        <Link className="sk-tile" href="/whitepaper"><span className="sk-icobox"><Ico n="book" /></span><div><b>Whitepaper</b><span>How the token works</span></div><Ico n="chev" s={16} /></Link>
      </div>
      <Link className="sk-leave" href="/"><Ico n="globe" s={18} /> Back to the ZUBA website</Link>
    </div>
  );
}

/* ---------- the three numbers at the top ---------- */
type Say = (t: string) => void;
function Summary({ me, go }: { me: Me; go: (t: string) => void }) {
  const now = useNow();
  const b = me.balance, sym = me.token.symbol;
  const staked = me.positions.reduce((t, p) => t + num(p.amount), 0);
  const mine = staked > 0 ? me.positions.reduce((t, p) => t + num(p.amount) * (me.apy[String(p.lockDays)] ?? 0), 0) / staked : null;
  // What today's reward is building up to. A stake counts for a reward day once it has been in place since that day began.
  const dayStart = me.program.nextDayAt - me.dayMs;
  const earning = me.positions.filter((p) => new Date(p.startedAt).getTime() <= dayStart);
  const part = Math.min(1, Math.max(0, (now - dayStart) / me.dayMs));
  const accruing = earning.reduce((t, p) => t + (num(p.amount) * (me.apy[String(p.lockDays)] ?? 0)) / 100 / 365, 0) * part;
  return (
    <section className="sk-card sk-sum">
      <div className="sk-stats">
        <div><span className="sk-icobox"><Ico n="wallet" /></span><span className="sk-eyebrow">Total staked</span><b className="sk-num">{compact(b.staked)}</b><i>{sym}</i></div>
        <div><span className="sk-icobox gold"><Ico n="star" /></span><span className="sk-eyebrow">Rewards earned</span><b className="sk-num gold">{compact(b.rewards)}</b><i>{sym}</i></div>
        <div><span className="sk-icobox"><Ico n="trend" /></span><span className="sk-eyebrow">Your APR</span><b className="sk-num">{mine === null ? "Variable" : `${mine.toFixed(2).replace(/\.?0+$/, "")}%`}</b><i>{mine === null ? "not staking yet" : "estimate"}</i></div>
      </div>
      <div className="sk-sum-foot">
        <dl>
          <div><dt>Available</dt><dd className="sk-num">{nice(b.available, 2)} {sym}</dd></div>
          {num(b.pendingWithdrawal) > 0 && <div><dt>Withdrawing</dt><dd className="sk-num">{nice(b.pendingWithdrawal, 2)} {sym}</dd></div>}
          {earning.length > 0 && <div><dt>Accruing today</dt><dd className="sk-num sk-live">≈ +{accruing.toFixed(accruing < 100 ? 4 : 2)} {sym}</dd></div>}
          {num(b.staked) > 0 && <div><dt>{earning.length > 0 ? "Paid in" : "Starts earning in"}</dt><dd><Countdown to={me.program.nextDayAt} now={now} /></dd></div>}
        </dl>
        <div className="sk-sum-actions">
          <button type="button" className="sk-btn primary" onClick={() => go("deposit")}>Deposit</button>
          <button type="button" className="sk-btn" onClick={() => go("withdraw")}>Withdraw</button>
        </div>
      </div>
    </section>
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
                {start <= me.program.nextDayAt - me.dayMs ? <span className="sk-live">Earning</span> : <span>Starts earning in {span(me.program.nextDayAt - now)}</span>}
                {p.canUnstake && <button type="button" className="sk-btn small" disabled={a.busy} onClick={async () => (await a.run({ kind: "unstake", id: p.id })) && say("Unstaked")}>Unstake</button>}
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
        <p className="sk-warnline">Send only {me.token.symbol} (BEP-20). Credited after {me.limits.confirmations} confirmations.{num(me.limits.minDeposit) > 0 ? ` Minimum deposit ${nice(me.limits.minDeposit)} ${me.token.symbol}; smaller amounts are not credited.` : ""}</p>
        <p className="sk-fine">Minimum stake {nice(me.limits.minStake)} {me.token.symbol}. If your wallet takes its network fee from the tokens you send, send a little extra.</p>
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
        {!me.deposits.length ? <p className="sk-muted">Deposits appear here as soon as the network sees them.</p> : (
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
function Stake({ me, go, refresh, say }: { me: Me; go: (t: string) => void; refresh: Refresh; say: Say }) {
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");
  const [lock, setLock] = useState(90);
  const [review, setReview] = useState(false);
  const [code, setCode] = useState("");
  const a = useAction(refresh);
  const sym = me.token.symbol, amt = Number(amount) || 0, apy = me.apy[String(lock)] ?? 0;
  const daily = (amt * apy) / 100 / 365;
  const low = amt > 0 && amt < num(me.limits.minStakeFloor || me.limits.minStake), over = amt > num(me.balance.available);
  const funded = num(me.balance.available) > 0;
  return (
    <>
      <div className="sk-home">
        <div className="sk-home-side">
          <Pool token={me.token} program={me.program} apy={me.apy} earned={me.balance.rewards} />
          {me.history.length > 0 && (
            <Card title="Recent activity" aside={<button type="button" className="sk-ghost" onClick={() => go("history")}>View all <Ico n="chev" s={14} /></button>}>
              <Ledger items={me.history.slice(0, 4)} />
            </Card>
          )}
        </div>
        <section className="sk-card sk-panel">
          <div className="sk-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "stake"} className={mode === "stake" ? "on" : ""} onClick={() => setMode("stake")}>Stake</button>
            <button type="button" role="tab" aria-selected={mode === "unstake"} className={mode === "unstake" ? "on" : ""} onClick={() => setMode("unstake")}>Unstake{me.positions.length > 0 && <i>{me.positions.length}</i>}</button>
          </div>
          <Rows items={[["Available balance", <span key="a" className="sk-num">{nice(me.balance.available, 2)} {sym}</span>], ["Staked", <span key="s" className="sk-num">{nice(me.balance.staked, 2)} {sym}</span>]]} />
          {mode === "stake" ? (
            <>
              <Calc sym={sym} apy={me.apy} dayMs={me.dayMs} amount={amount} setAmount={setAmount} lock={lock} setLock={setLock} max={me.balance.available} />
              {(low || over) && <p className="sk-hint bad">{over ? "Exceeds available balance" : `Minimum ${nice(me.limits.minStake)} ${sym}`}</p>}
              {!funded && <p className="sk-note info">Your balance is empty. <button type="button" className="sk-ghost" onClick={() => go("deposit")}>Deposit {sym}</button></p>}
              <button type="button" className="sk-btn primary wide" disabled={!amt || low || over || me.paused} onClick={() => { a.reset(); setCode(""); setReview(true); }}>Review stake</button>
              <p className="sk-fine sk-center">Minimum {nice(me.limits.minStake)} {sym}</p>
            </>
          ) : (
            <Positions me={me} refresh={refresh} say={say} empty={<p className="sk-muted">You have no stakes yet.</p>} />
          )}
        </section>
      </div>
      {review && (
        <Modal title="Confirm stake" onClose={() => setReview(false)}>
          <div className="sk-big"><b className="sk-num">{nice(amount, 2)}</b><span>{sym}</span></div>
          <Rows items={[["Lock", lockName(lock)], ["Unlocks", lock === 0 ? "Any time" : dateIn(lock, me.dayMs)], ["Est. APR", `${apy}%`], ["Est. daily", `+${amountOf(daily)} ${sym}`, "gold"]]} />
          {lock > 0 && <p className="sk-fine">Fixed stakes can&apos;t be unstaked before the term ends.</p>}
          {lock > 0 && <Field label="Authenticator code" htmlFor="stk-sc"><CodeInput id="stk-sc" value={code} onChange={setCode} autoFocus /></Field>}
          <Err>{a.err}</Err>
          <button type="button" className="sk-btn primary wide" disabled={a.busy || (lock > 0 && code.length !== 6)} onClick={async () => { if (await a.run(lock > 0 ? { kind: "stake", amount, lock, code } : { kind: "stake", amount, lock })) { setReview(false); setAmount(""); setCode(""); say("Staked"); } }}>{a.busy ? "Staking…" : "Confirm"}</button>
        </Modal>
      )}
    </>
  );
}

/* ---------- withdraw ---------- */
const W_LABEL: Record<string, [string, string]> = { review: ["Processing", "wait"], queued: ["Processing", "wait"], sending: ["Sending", "wait"], sent: ["Completed", "ok"], failed: ["Failed", "bad"], cancelled: ["Cancelled", ""], rejected: ["Declined", "bad"] };

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
          <p className="sk-sub-copy">Sent to one of your saved addresses on BNB Smart Chain{me.limits.manual ? ", usually within a few hours" : ""}.</p>
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
            <Rows items={[...(me.limits.manual ? [] : [["Instant, up to", `${compact(me.limits.autoLimit)} ${sym}`] as [string, string]]), ["Minimum", `${nice(me.limits.minWithdraw)} ${sym}`], ...(me.limits.manual ? [] : [["Daily", `${compact(me.limits.userDaily)} ${sym}`] as [string, string]])]} />
          </details>
        </Card>
        <Card title="Addresses" aside={me.addresses.length < me.limits.maxAddresses && <button type="button" className="sk-ghost" onClick={() => setAdding(true)}><Ico n="plus" s={15} /> Add</button>}>
          <Err>{rm.err}</Err>
          {!me.addresses.length ? <p className="sk-muted">Save the wallet addresses you withdraw to.</p> : (
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
                    {!me.limits.manual && (x.status === "review" || x.status === "queued") && <button type="button" className="sk-ghost dim" disabled={cancel.busy} onClick={async () => (await cancel.run({ kind: "withdraw_cancel", id: x.id })) && say("Withdrawal cancelled")}>Cancel</button>}
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
          <button type="button" className="sk-btn primary wide" disabled={w.busy || code.length !== 6} onClick={async () => { let review = false; if (await w.run<{ status: string }>({ kind: "withdraw", amount, address: dest, code }, (r) => { review = r.status === "review"; })) { setConfirm(false); setAmount(""); say(review && !me.limits.manual ? "Withdrawal submitted for review" : "Withdrawal submitted"); } }}>{w.busy ? "Submitting…" : "Confirm"}</button>
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
