"use client";

import { useState } from "react";
import { Delta, Divider, Runes, ZText } from "@/components/ui/Glyphs";

export default function AdminLogin() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      window.location.reload();
      return;
    }
    setErr(((await res.json().catch(() => ({}))) as { error?: string }).error || "Login failed.");
    setBusy(false);
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
        <p className="t-muted">Builders only. Enter the password to manage dev notes and blog posts.</p>
        <div className="field" style={{ textAlign: "left" }}>
          <label htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        {err && <p className="warning">{err}</p>}
        <button className="btn primary" disabled={busy} style={{ justifyContent: "center" }}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
