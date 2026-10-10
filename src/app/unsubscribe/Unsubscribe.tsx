"use client";

import { useState } from "react";
import Link from "next/link";
import { Delta, Divider, Runes, ZText } from "@/components/ui/Glyphs";

export default function Unsubscribe({ e, s }: { e: string; s: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function go() {
    setState("busy");
    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ e, s }),
    });
    if (res.ok) return setState("done");
    setErr(((await res.json().catch(() => ({}))) as { error?: string }).error || "Something went wrong.");
    setState("error");
  }

  return (
    <div className="admin-shell">
      <div className="admin-card stack center">
        <Delta className="delta admin-delta" />
        <Runes text="Farewell" />
        <h1 className="t-title md">
          <ZText>{state === "done" ? "You're Unsubscribed" : "Leave the Builders' Circle?"}</ZText>
        </h1>
        <Divider variant="notched" />
        {state === "done" ? (
          <>
            <p className="t-muted">No more dev note emails. The map stays open whenever you want to check in.</p>
            <Link href="/dev-notes" className="btn" style={{ justifyContent: "center" }}>
              Visit Dev Notes
            </Link>
          </>
        ) : !e || !s ? (
          <p className="warning">This unsubscribe link is incomplete. Use the link from the bottom of any ZUBA email.</p>
        ) : (
          <>
            <p className="t-muted">You&apos;ll stop getting an email each time the ZUBA builders post a new dev note.</p>
            {state === "error" && <p className="warning">{err}</p>}
            <button className="btn primary" onClick={go} disabled={state === "busy"} style={{ justifyContent: "center" }}>
              {state === "busy" ? "Working…" : "Unsubscribe"}
            </button>
            <Link href="/" className="prompt" style={{ justifyContent: "center" }}>
              Keep me in the circle
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
