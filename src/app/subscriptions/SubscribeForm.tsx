"use client";

import { useState } from "react";
import { methods, plans } from "@/content/subscriptions";
import { Divider, Runes, ZText } from "@/components/ui/Glyphs";

export default function SubscribeForm() {
  const [plan, setPlan] = useState("quarter");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [hp, setHp] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const chosen = plans.find((p) => p.id === plan)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("busy");
    setMsg("");
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, email, name, method, reference, website2: hp }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) setStatus("done");
    else {
      setStatus("error");
      setMsg(json.error || "Something went wrong.");
    }
  }

  return (
    <>
      <section className="section" id="plans">
        <div className="container">
          <div className="center stack" style={{ marginBottom: 34 }}>
            <Runes text="Plans" />
            <h2 className="t-title lg">
              <ZText>Choose Your Plan</ZText>
            </h2>
            <Divider variant="notched" />
          </div>
          <div className="pw-tracks">
            {plans.map((p) => (
              <button key={p.id} type="button" className={`pw-track ${plan === p.id ? "active" : ""}`} onClick={() => setPlan(p.id)} aria-pressed={plan === p.id}>
                <span className="t-label">{p.best ? "Most popular" : "Premium"}</span>
                <span className="t-title sm">
                  <ZText>{p.name}</ZText>
                </span>
                <span className="t-title md" style={{ color: "var(--gold, #ffb627)" }}>
                  {p.price}
                </span>
                <span className="pw-track-blurb">{p.note}</span>
                <span className="prompt">{plan === p.id ? "Selected ✓" : "Choose ▸"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="buy">
        <div className="container">
          <div className="pw-form-wrap">
            {status === "done" ? (
              <div className="center stack" style={{ padding: "30px 10px" }}>
                <span className="sub-check" style={{ width: 40, height: 40, margin: "0 auto" }} aria-hidden="true" />
                <h2 className="t-title md">
                  <ZText>Request Received</ZText>
                </h2>
                <p className="t-muted" style={{ maxWidth: 520, margin: "0 auto" }}>
                  Check your inbox at <b>{email}</b>. When your payment is confirmed we email your one-time 5-digit code. In the app go to Profile, Premium, then I have a code.
                </p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="pw-form-head">
                  <div>
                    <span className="t-label">Zualingo Premium · {chosen.price}</span>
                    <h2 className="t-title md">
                      <ZText>{chosen.name}</ZText>
                    </h2>
                  </div>
                </div>
                <Divider variant="notched" align="left" />
                <div className="pw-fields">
                  <div className="field">
                    <label htmlFor="sf-email">
                      Your Zualingo email<span className="pw-req"> *</span>
                    </label>
                    <input id="sf-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="the email you sign in with" />
                    <span className="pw-hint">Your code will only work for the account with this email.</span>
                  </div>
                  <div className="field">
                    <label htmlFor="sf-name">Your name</label>
                    <input id="sf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="sf-method">
                      How will you pay?<span className="pw-req"> *</span>
                    </label>
                    <select id="sf-method" className="select" required value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="">Choose…</option>
                      {methods.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="sf-ref">Payment reference (if you already paid)</label>
                    <input id="sf-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="transfer reference or transaction hash" />
                  </div>
                </div>
                <input className="sub-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
                {status === "error" && <p className="warning">{msg}</p>}
                <div className="pw-submit">
                  <button className="btn primary" disabled={status === "busy"}>
                    {status === "busy" ? "Sending…" : "Request my code"}
                  </button>
                  <span className="pw-hint">We email payment details if you have not paid yet. Your code arrives by email once payment is confirmed.</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
