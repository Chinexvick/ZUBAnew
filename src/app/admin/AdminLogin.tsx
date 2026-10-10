"use client";

import { useState } from "react";
import { Delta, Divider, Runes, ZText } from "@/components/ui/Glyphs";

export default function AdminLogin({ email: emailOn, password: pwOn, expired }: { email: boolean; password: boolean; expired: boolean }) {
  const [method, setMethod] = useState<"email" | "password">(emailOn ? "email" : "password");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(expired ? "That sign-in link has expired. Ask for a new one." : "");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(method === "email" ? { email } : { password: pw }),
    });
    setBusy(false);
    if (res.ok) {
      if (method === "email") return setSent(true);
      window.location.reload();
      return;
    }
    setErr(((await res.json().catch(() => ({}))) as { error?: string }).error || "Login failed.");
  }

  return (
    <div className="admin-shell">
      <form className="admin-card stack center" onSubmit={submit}>
        <Delta className="delta admin-delta" />
        <Runes text="Workbench" />
        <h1 className="t-title md">
          <ZText>Workbench</ZText>
        </h1>
        <Divider variant="notched" />
        {sent ? (
          <>
            <p className="sub-done" role="status" style={{ textAlign: "left" }}>
              <span className="sub-check" aria-hidden="true" /> If {email} is an admin address, a sign-in link is on its way. It expires in 15
              minutes.
            </p>
            <button type="button" className="prompt" style={{ justifyContent: "center", background: "none", border: 0, cursor: "pointer" }} onClick={() => setSent(false)}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <p className="t-muted">
              {method === "email"
                ? "Builders only. Enter your admin email and we'll send you a sign-in link."
                : "Builders only. Enter the password to manage dev notes and blog posts."}
            </p>
            {method === "email" ? (
              <div className="field" style={{ textAlign: "left" }}>
                <label htmlFor="em">Admin email</label>
                <input id="em" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            ) : (
              <div className="field" style={{ textAlign: "left" }}>
                <label htmlFor="pw">Password</label>
                <input id="pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
              </div>
            )}
            {err && <p className="warning">{err}</p>}
            <button className="btn primary" disabled={busy} style={{ justifyContent: "center" }}>
              {busy ? "Working…" : method === "email" ? "Send sign-in link" : "Enter"}
            </button>
            {emailOn && pwOn && (
              <button
                type="button"
                className="prompt"
                style={{ justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}
                onClick={() => setMethod(method === "email" ? "password" : "email")}
              >
                {method === "email" ? "Use the password instead" : "Email me a sign-in link instead"}
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}
