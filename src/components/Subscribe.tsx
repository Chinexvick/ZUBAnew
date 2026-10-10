"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Delta, Divider, Runes, ZText } from "@/components/ui/Glyphs";

const KEY = "zuba-subscribe";
const DELAY_MS = 10_000;
const SNOOZE_DAYS = 7;

type Status = "idle" | "busy" | "done" | "error";

function readFlag(): { state?: "subscribed" | "dismissed"; at?: number } {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeFlag(state: "subscribed" | "dismissed") {
  try {
    localStorage.setItem(KEY, JSON.stringify({ state, at: Date.now() }));
  } catch {
    /* storage blocked: the popup may show again next visit, which is fine */
  }
}

function useSubscribe(source: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  async function submit(email: string, website: string) {
    setStatus("busy");
    setMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website, source }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; already?: boolean };
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      writeFlag("subscribed");
      setMsg(json.already ? "You're already in the circle. New notes will keep coming." : "Check your inbox: your welcome scroll is on its way.");
      setStatus("done");
    } catch (e) {
      setMsg((e as Error).message);
      setStatus("error");
    }
  }
  return { status, msg, submit };
}

function Form({ source, autoFocus, onDone }: { source: string; autoFocus?: boolean; onDone?: () => void }) {
  const { status, msg, submit } = useSubscribe(source);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (status === "done") onDone?.();
  }, [status, onDone]);

  if (status === "done") {
    return (
      <p className="sub-done" role="status">
        <span className="sub-check" aria-hidden="true" /> {msg}
      </p>
    );
  }
  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(email, website);
      }}
    >
      <label className="sr-only" htmlFor={`sub-${source}`}>
        Email address
      </label>
      <input
        id={`sub-${source}`}
        className="input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus={autoFocus}
      />
      {/* Honeypot for bots: hidden from people and screen readers. */}
      <input className="sub-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      <button className="btn primary" disabled={status === "busy"}>
        {status === "busy" ? "Sending…" : "Subscribe"}
      </button>
      {status === "error" && (
        <p className="warning" role="alert">
          {msg}
        </p>
      )}
    </form>
  );
}

/* Inline block, e.g. on the Dev Notes page. */
export function SubscribeCard() {
  return (
    <div className="sub-card">
      <Runes text="Builders circle" />
      <h2 className="t-title md">
        <ZText>Get Every Dev Note</ZText>
      </h2>
      <p className="t-muted">One email each time the builders drop a new marker on the map. No spam, unsubscribe anytime.</p>
      <Form source="dev-notes" />
    </div>
  );
}

/* Popup that appears 10 seconds into a visit, once per week until the visitor subscribes. */
export default function SubscribePopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hidden = pathname.startsWith("/admin") || pathname.startsWith("/unsubscribe");

  useEffect(() => {
    if (hidden) return;
    const f = readFlag();
    if (f.state === "subscribed") return;
    if (f.state === "dismissed" && f.at && Date.now() - f.at < SNOOZE_DAYS * 86_400_000) return;
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [hidden]);

  const close = useCallback(() => {
    if (readFlag().state !== "subscribed") writeFlag("dismissed");
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || hidden) return null;
  return (
    <div className="sub-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sub-modal" role="dialog" aria-modal="true" aria-labelledby="sub-title">
        <span className="sub-corner tl" aria-hidden="true" />
        <span className="sub-corner tr" aria-hidden="true" />
        <span className="sub-corner bl" aria-hidden="true" />
        <span className="sub-corner br" aria-hidden="true" />
        <button className="sub-close" onClick={close} aria-label="Close">
          ✕
        </button>
        <div className="sub-art" aria-hidden="true">
          <img src="/media/zuba-griot.webp" alt="" />
        </div>
        <div className="sub-body">
          <span className="sub-quest">◆ New quest</span>
          <h2 id="sub-title" className="t-title md">
            <ZText>Join the Builders&apos; Circle</ZText>
          </h2>
          <Divider variant="notched" align="left" />
          <p className="t-muted">
            Every time the ZUBA team posts a dev note, the griot brings it to your inbox: real progress on the games, the animation and the
            roadmap.
          </p>
          <Form source="popup" autoFocus />
          <button className="sub-later" onClick={close}>
            Maybe later
          </button>
        </div>
        <Delta className="delta sub-delta" />
      </div>
    </div>
  );
}
