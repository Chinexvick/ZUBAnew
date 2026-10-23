"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Title } from "@/content/theatre";
import { Runes, ZText } from "./ui/Glyphs";

export function PosterCard({ t }: { t: Title }) {
  const href = `/theatre/${t.kind === "movie" ? "movies" : "games"}/${t.slug}`;
  return (
    <Link href={href} className="poster">
      <span className="poster-art">
        {t.poster ? <img src={t.poster} alt={`${t.title} poster`} loading="lazy" /> : <span className="poster-empty" />}
        <span className="poster-shade" />
        <span className="poster-status">{t.status.split(" · ")[0]}</span>
        <span className="poster-play" aria-hidden="true">
          {t.play ? "Play" : "View"}
        </span>
      </span>
      <span className="poster-meta">
        <Runes text={t.runes} />
        <span className="poster-title">
          <ZText>{t.title.split(":")[0]}</ZText>
        </span>
        <span className="poster-sub">{t.title.includes(":") ? t.title.split(":")[1].trim() : t.genre}</span>
      </span>
    </Link>
  );
}

/* Horizontally scrolling Netflix-style shelf. Arrows appear only when the row actually scrolls. */
export default function TitleRow({ title, items, hideHead }: { title: string; items: Title[]; hideHead?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ scrollable: false, atStart: true, atEnd: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        scrollable: el.scrollWidth > el.clientWidth + 4,
        atStart: el.scrollLeft < 4,
        atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="shelf">
      <div className={`shelf-head ${hideHead ? "bare" : ""}`}>
        {hideHead ? (
          <span className="sr-only">{title}</span>
        ) : (
          <h3 className="t-title sm">
            <ZText>{title}</ZText>
          </h3>
        )}
        {edges.scrollable && (
          <div className="shelf-arrows">
            <button aria-label="Scroll left" className="arrow-tab left" onClick={() => scroll(-1)} disabled={edges.atStart} />
            <button aria-label="Scroll right" className="arrow-tab right" onClick={() => scroll(1)} disabled={edges.atEnd} />
          </div>
        )}
      </div>
      <div className={`shelf-track ${edges.scrollable && !edges.atEnd ? "fade" : ""}`} ref={ref}>
        {items.map((t) => (
          <PosterCard key={t.slug} t={t} />
        ))}
      </div>
    </section>
  );
}
