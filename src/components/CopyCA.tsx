"use client";

import { useState } from "react";
import { site } from "@/lib/site";

export default function CopyCA({ compact }: { compact?: boolean }) {
  const [done, setDone] = useState(false);
  const ca = site.contractAddress;

  async function copy() {
    try {
      await navigator.clipboard.writeText(ca);
    } catch {
      const t = document.createElement("textarea");
      t.value = ca;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <div className="ca" style={compact ? { maxWidth: 520 } : undefined}>
      <span className="ca-tag">CA</span>
      <span className="ca-addr" title={ca} aria-label={ca}>
        <span className="ca-full">{ca}</span>
        <span className="ca-short" aria-hidden="true">
          {ca.slice(0, 8)}…{ca.slice(-8)}
        </span>
      </span>
      <button type="button" className={`ca-copy ${done ? "done" : ""}`} onClick={copy} aria-live="polite">
        {done ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
