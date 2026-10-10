"use client";

import { useRef, useState } from "react";
import type { Utility } from "@/content/utilities";
import { Icon } from "./Icons";
import { Divider, Runes, ZText } from "./ui/Glyphs";

const statusClass = (s: Utility["status"]) => (s === "Live" ? "live" : s === "In production" ? "prod" : "planned");

/* ZAU trinket-ring: the coin in the centre, each utility a slot around it. One detail at a time.
   All panels share one grid cell so the layout never jumps between selections. */
export default function UtilityRing({ items }: { items: Utility[] }) {
  const [sel, setSel] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const n = items.length;

  function choose(i: number) {
    setSel(i);
    if (window.matchMedia("(max-width: 900px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + n) % n;
    setSel(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="uring">
      <div className="uring-left">
        <div className="uring-dial">
          <div className="uring-band" aria-hidden="true" />
          <div className="uring-core" aria-hidden="true">
            <img src="/brand/zuba-coin.png" alt="" />
          </div>
          <div role="tablist" aria-label="What $ZUBA unlocks">
            {items.map((it, i) => {
              const a = (i / n) * Math.PI * 2 - Math.PI / 2;
              const x = 50 + Math.cos(a) * 41;
              const y = 50 + Math.sin(a) * 41;
              const lx = 50 + Math.cos(a) * 55;
              const ly = 50 + Math.sin(a) * 55;
              return (
                <span key={it.key}>
                  <button
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    role="tab"
                    id={`util-tab-${it.key}`}
                    aria-selected={sel === i}
                    aria-controls={`util-panel-${it.key}`}
                    aria-label={`${it.verb}: ${it.name} (${it.status})`}
                    tabIndex={sel === i ? 0 : -1}
                    className={`uring-slot ${statusClass(it.status)} ${sel === i ? "on" : ""}`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => choose(i)}
                    onKeyDown={(e) => onKey(e, i)}
                  >
                    <Icon name={it.key} size={26} />
                    {it.status === "Planned" && (
                      <span className="uring-lock" aria-hidden="true">
                        <Icon name="lock" size={11} />
                      </span>
                    )}
                  </button>
                  <span className={`uring-verb ${sel === i ? "on" : ""}`} style={{ left: `${lx}%`, top: `${ly}%` }} aria-hidden="true">
                    {it.verb}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <p className="uring-legend" aria-hidden="true">
          <span className="dot prod" /> In production <span className="dot planned" /> Planned
        </p>
      </div>

      <div className="uring-stack" ref={panelRef}>
        {items.map((u, i) => (
          <div
            key={u.key}
            className={`uring-panel ${sel === i ? "on" : ""}`}
            id={`util-panel-${u.key}`}
            role="tabpanel"
            aria-labelledby={`util-tab-${u.key}`}
            aria-hidden={sel !== i}
          >
            <span className="uring-count" aria-hidden="true">
              {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
            <span className="uring-medal" aria-hidden="true">
              <Icon name={u.key} size={30} />
            </span>
            <Runes text={u.verb} />
            <h3 className="t-title md">
              <ZText>{u.name}</ZText>
            </h3>
            <span className={`uring-status ${statusClass(u.status)}`}>{u.status}</span>
            <Divider variant="diamond" />
            <p className="uring-body">{u.body}</p>
            <p className="t-lore">{u.lore}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
