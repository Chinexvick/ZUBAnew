"use client";

import { useRef, useState } from "react";
import type { Utility } from "@/content/utilities";
import { Icon } from "./Icons";
import { Divider, Runes, ZText } from "./ui/Glyphs";

/* ZAU trinket-ring: the coin in the centre, each utility a slot around it. One detail at a time. */
export default function UtilityRing({ items }: { items: Utility[] }) {
  const [sel, setSel] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const u = items[sel];
  const n = items.length;

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
      <div className="uring-dial">
        <div className="uring-band" aria-hidden="true" />
        <div className="uring-core" aria-hidden="true">
          <img src="/brand/zuba-coin.png" alt="" />
        </div>
        <div role="tablist" aria-label="What $ZUBA unlocks" aria-orientation="horizontal">
          {items.map((it, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const x = 50 + Math.cos(a) * 41;
            const y = 50 + Math.sin(a) * 41;
            return (
              <button
                key={it.key}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="tab"
                id={`util-tab-${it.key}`}
                aria-selected={sel === i}
                aria-controls="util-panel"
                tabIndex={sel === i ? 0 : -1}
                className={`uring-slot ${sel === i ? "on" : ""}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => setSel(i)}
                onKeyDown={(e) => onKey(e, i)}
                title={`${it.verb}: ${it.name}`}
              >
                <Icon name={it.key} size={26} />
                <span className="uring-verb">{it.verb}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="uring-panel" id="util-panel" role="tabpanel" aria-labelledby={`util-tab-${u.key}`} key={u.key}>
        <span className="uring-medal" aria-hidden="true">
          <Icon name={u.key} size={30} />
        </span>
        <Runes text={u.verb} />
        <h3 className="t-title md">
          <ZText>{u.name}</ZText>
        </h3>
        <Divider variant="diamond" />
        <p className="uring-body">{u.body}</p>
        <p className="t-lore">{u.lore}</p>
        <span className={`chip ${u.status === "Live" ? "live" : u.status === "In production" ? "prod" : ""}`}>{u.status}</span>
        <span className="uring-count" aria-hidden="true">
          {String(sel + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
