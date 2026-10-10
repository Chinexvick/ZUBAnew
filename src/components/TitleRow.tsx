"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Title } from "@/content/theatre";
import { Runes, ZText } from "./ui/Glyphs";

export function PosterCard({ t }: { t: Title }) {
  const href = `/theatre/${t.kind === "movie" ? "movies" : "games"}/${t.slug}`;
  return (
    <Link href={href} className="poster">
      <span className="poster-art">
        {t.poster ? <img src={t.poster} alt={`${t.title} poster`} loading="lazy" /> : <span className="poster-empty" />}
        <span className="poster-shade" />
        <span className="poster-status">{t.status}</span>
        <span className="poster-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M7 4 L20 12 L7 20 Z" fill="currentColor" />
          </svg>
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

/* Horizontally scrolling Netflix-style shelf with angular arrow tabs. */
export default function TitleRow({ title, items, hideHead }: { title: string; items: Title[]; hideHead?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="shelf">
      <div className={`shelf-head ${hideHead ? "bare" : ""}`}>
        {hideHead ? <span className="sr-only">{title}</span> : (
          <h3 className="t-title sm">
            <ZText>{title}</ZText>
          </h3>
        )}
        <div className="shelf-arrows">
          <button aria-label="Scroll left" className="arrow-tab left" onClick={() => scroll(-1)} />
          <button aria-label="Scroll right" className="arrow-tab right" onClick={() => scroll(1)} />
        </div>
      </div>
      <div className="shelf-track" ref={ref}>
        {items.map((t) => (
          <PosterCard key={t.slug} t={t} />
        ))}
      </div>
    </section>
  );
}
