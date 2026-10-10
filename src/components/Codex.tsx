"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Whitepaper } from "@/content/whitepaper";
import { Delta, ZText } from "./ui/Glyphs";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"];

/* The whitepaper as an ancient storybook: contents on the left page, one chapter on the right. */
export default function Codex({ wp, griot }: { wp: Whitepaper; griot: string }) {
  const pages = useMemo(() => [{ id: "cover", title: "Prologue" }, ...wp.chapters.map((c) => ({ id: c.id, title: c.title }))], [wp]);
  const [cur, setCur] = useState(0);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const bookRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (i: number, scroll = true) => {
      if (i < 0 || i >= pages.length || i === cur) return;
      setTurn(i > cur ? "next" : "prev");
      setCur(i);
      setTocOpen(false);
      history.replaceState(null, "", `#${pages[i].id}`);
      if (scroll && bookRef.current && bookRef.current.getBoundingClientRect().top < 0) {
        bookRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [cur, pages]
  );

  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = pages.findIndex((p) => p.id === id);
    if (i > 0) setCur(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") go(cur + 1);
      if (e.key === "ArrowLeft") go(cur - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, go]);

  return (
    <div className="codex" ref={bookRef}>
      <div className="codex-tools">
        <button type="button" className="codex-toc-btn" onClick={() => setTocOpen((v) => !v)} aria-expanded={tocOpen}>
          ☰ Contents
        </button>
        <span className="codex-pageno">
          {cur === 0 ? "Prologue" : `Chapter ${ROMAN[cur]} of ${ROMAN[pages.length - 1]}`}
        </span>
        <button type="button" className="codex-print" onClick={() => window.print()}>
          Save as PDF
        </button>
      </div>

      <div className="codex-book">
        <span className="codex-ribbon" aria-hidden="true" />
        {/* ---- left page: contents ---- */}
        <aside className={`codex-left ${tocOpen ? "open" : ""}`} aria-label="Contents">
          <p className="codex-kicker">The Book of</p>
          <h2 className="codex-booktitle">
            <ZText>ZUBA</ZText>
          </h2>
          <p className="codex-ver">{wp.version}</p>
          <span className="codex-rule" aria-hidden="true">
            <Delta className="delta" />
          </span>
          <ol className="codex-toc">
            {pages.map((p, i) => (
              <li key={p.id}>
                <button type="button" className={i === cur ? "on" : ""} onClick={() => go(i)} aria-current={i === cur ? "page" : undefined}>
                  <span className="codex-toc-n">{i === 0 ? "✦" : ROMAN[i]}</span>
                  <span className="codex-toc-t">{p.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <img className="codex-griot" src={griot} alt="" aria-hidden="true" />
        </aside>

        {/* ---- right page: the current chapter (all chapters render; only one shows on screen) ---- */}
        <div className="codex-right">
          <article className={`codex-page ${cur === 0 ? "on" : ""} ${cur === 0 && turn ? `turn-${turn}` : ""}`} id="cover" aria-hidden={cur !== 0}>
            <p className="codex-kicker center">A whitepaper</p>
            <h1 className="codex-title">
              <ZText>{wp.title}</ZText>
            </h1>
            <p className="codex-sub">{wp.subtitle}</p>
            <span className="codex-rule" aria-hidden="true">
              <Delta className="delta" />
            </span>
            <p className="codex-abstract dropcap">{wp.abstract}</p>
            <dl className="codex-facts">
              {wp.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" className="codex-begin" onClick={() => go(1)}>
              Begin reading →
            </button>
          </article>

          {wp.chapters.map((c, ci) => {
            const i = ci + 1;
            return (
              <article key={c.id} id={c.id} className={`codex-page ${cur === i ? "on" : ""} ${cur === i && turn ? `turn-${turn}` : ""}`} aria-hidden={cur !== i}>
                <p className="codex-kicker">Chapter {ROMAN[i]}</p>
                <h2 className="codex-title">
                  <ZText>{c.title}</ZText>
                </h2>
                <p className="codex-sub">{c.kicker}</p>
                <span className="codex-rule" aria-hidden="true">
                  <Delta className="delta" />
                </span>
                {c.sections.map((s, si) => (
                  <section key={s.heading} className="codex-sec">
                    <h3>{s.heading}</h3>
                    {s.paragraphs.map((p, pi) => (
                      <p key={pi} className={si === 0 && pi === 0 ? "dropcap" : undefined}>
                        {p}
                      </p>
                    ))}
                    {s.stats && s.stats.length > 0 && (
                      <div className="codex-stats">
                        {s.stats.map((st) => (
                          <div key={st.label} className="codex-stat">
                            <strong>{st.value}</strong>
                            <span>{st.label}</span>
                            {st.source && <em>{st.source}</em>}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.bullets && s.bullets.length > 0 && (
                      <ul className="codex-list">
                        {s.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {s.table && (
                      <div className="codex-table-wrap">
                        <table className="codex-table">
                          <thead>
                            <tr>
                              {s.table.columns.map((h) => (
                                <th key={h}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {s.table.rows.map((r, ri) => (
                              <tr key={ri}>
                                {r.map((cell, k) => (
                                  <td key={k}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))}
                {i === pages.length - 1 && wp.sources.length > 0 && (
                  <section className="codex-sec codex-sources">
                    <h3>Sources</h3>
                    <ol>
                      {wp.sources.map((src) => (
                        <li key={src.url}>
                          <a href={src.url} target="_blank" rel="noopener noreferrer">
                            {src.title}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </article>
            );
          })}

          <nav className="codex-turn" aria-label="Turn page">
            <button type="button" onClick={() => go(cur - 1)} disabled={cur === 0}>
              ← <span>{cur > 0 ? pages[cur - 1].title : ""}</span>
            </button>
            <span className="codex-folio">{cur + 1}</span>
            <button type="button" onClick={() => go(cur + 1)} disabled={cur === pages.length - 1}>
              <span>{cur < pages.length - 1 ? pages[cur + 1].title : ""}</span> →
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
