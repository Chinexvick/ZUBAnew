"use client";

import { useEffect, useRef, useState } from "react";
import type { Phase } from "@/content/roadmap";
import { Cursor, Divider, Runes, ZText } from "./ui/Glyphs";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

const stateLabel = { cleared: "Cleared", active: "In Progress", locked: "Locked" } as const;

export default function SkillTree({ phases, art }: { phases: Phase[]; art: string[] }) {
  const firstActive = phases.find((p) => p.status === "active")?.n ?? 1;
  const [sel, setSel] = useState(firstActive);

  useEffect(() => {
    const m = window.location.hash.match(/phase-(\d)/);
    if (m) setSel(Number(m[1]));
  }, []);

  const panelRef = useRef<HTMLElement>(null);
  const p = phases.find((x) => x.n === sel) ?? phases[0];
  const locked = p.status === "locked";
  const prev = phases.find((x) => x.n === p.n - 1);

  function choose(n: number) {
    setSel(n);
    if (window.matchMedia("(max-width: 960px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  return (
    <div className="tree-wrap">
      <div className="tree" role="tablist" aria-label="Roadmap phases">
        {phases.map((ph) => (
          <button
            key={ph.n}
            id={`phase-${ph.n}`}
            role="tab"
            aria-selected={sel === ph.n}
            className={`tree-node ${ph.status} ${sel === ph.n ? "selected" : ""}`}
            onClick={() => choose(ph.n)}
          >
            <span className="tree-medal">
              <span className={`quest-node ${ph.status}`} style={{ display: "block" }}>
                <span className="quest-medal">
                  {ph.status === "locked" ? <LockIcon /> : <span className="t-title md">0{ph.n}</span>}
                  {sel === ph.n && <Cursor />}
                </span>
              </span>
            </span>
            <span className="tree-text">
              <span className="phase-n">PHASE 0{ph.n} · {stateLabel[ph.status].toUpperCase()}</span>
              <span className="phase-name">
                <ZText>{ph.name}</ZText>
              </span>
              <span className="t-muted">{ph.quest}</span>
            </span>
          </button>
        ))}
      </div>

      <aside className={`detail-panel ${locked ? "locked" : ""}`} aria-live="polite" ref={panelRef}>
        <div className="detail-panel-art" style={{ backgroundImage: `url(${art[(p.n - 1) % art.length]})` }} />
        <div className="detail-panel-body">
          <Runes text={p.name} />
          <h2 className="t-title lg">
            <ZText>{p.name}</ZText>
          </h2>
          <Divider variant="diamond" />
          <p className="t-lead" style={{ margin: 0 }}>
            Quest: <span className="hl">{p.quest}</span>
          </p>
          <ul className="objective-list">
            {p.objectives.map((o) => (
              <li key={o}>
                <span className={`check ${p.status === "cleared" ? "on" : p.status === "active" ? "half" : ""}`} />
                <span>{o}</span>
              </li>
            ))}
          </ul>
          <p className="t-lore">{p.lore}</p>
          {locked ? (
            <div className="lock-box">
              <LockIcon />
              <div>{prev ? `Unlocks after Phase 0${prev.n}: ${prev.name}` : "Coming soon"}</div>
            </div>
          ) : (
            <span className={`chip ${p.status === "cleared" ? "live" : ""}`}>{stateLabel[p.status]}</span>
          )}
        </div>
      </aside>
    </div>
  );
}
