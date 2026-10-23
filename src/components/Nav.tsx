"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { nav, site } from "@/lib/site";
import { Chev, Keycap, Runes, ZText } from "./ui/Glyphs";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ marginRight: 2 }}>
      <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Q / E cycle through tabs, just like the in-game menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      const key = e.key.toLowerCase();
      if (key !== "q" && key !== "e") return;
      const i = Math.max(0, nav.findIndex((n) => isActive(pathname, n.href)));
      const next = key === "e" ? (i + 1) % nav.length : (i - 1 + nav.length) % nav.length;
      router.push(nav[next].href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <header className={`nav ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-band zigzag" aria-hidden="true" />
        <div className="nav-inner">
          <Link href="/" className="nav-logo" aria-label="ZUBA home">
            <img src="/brand/zuba-coin.png" alt="" width={42} height={42} />
            <span className="t-title sm">
              <ZText>ZUBA</ZText>
            </span>
          </Link>

          <nav className="nav-tabs" aria-label="Main">
            <span className="nav-key" title="Press Q for previous tab">
              <Keycap k="Q" />
            </span>
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={`nav-tab ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                  {active && <Runes text={item.label.split(" ")[0]} className="nav-runes" />}
                  <span className="nav-label">
                    <ZText>{item.label}</ZText>
                  </span>
                  {active && (
                    <svg className="nav-underline" viewBox="0 0 120 12" aria-hidden="true">
                      <path d="M0 3h120" />
                      <path d="M8 7h14M30 7h6M84 7h6M98 7h14" />
                      <path d="M55 11 L60 5 L65 11 Z" fill="currentColor" />
                    </svg>
                  )}
                </Link>
              );
            })}
            <span className="nav-key" title="Press E for next tab">
              <Keycap k="E" />
            </span>
          </nav>

          <a href="/play" className="btn nav-cta nav-play" title="Play ZUBA games in your browser">
            <PlayIcon /> Play
          </a>
          <a href={site.links.buy} target="_blank" rel="noopener noreferrer" className="btn primary nav-cta">
            Buy $ZUBA
          </a>

          <button className="nav-burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className={`nav-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="nav-drawer-list">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={`drawer-item ${active ? "active" : ""}`} tabIndex={open ? 0 : -1}>
                {active && <Chev />}
                <ZText>{item.label}</ZText>
                {active && <Chev dir="left" />}
              </Link>
            );
          })}
          <a href="/play" className="btn primary" tabIndex={open ? 0 : -1} style={{ marginTop: 18 }}>
            <PlayIcon /> Play the Games
          </a>
          <Link href="/whitepaper" className="btn" tabIndex={open ? 0 : -1}>
            Read Whitepaper
          </Link>
          <a href={site.links.buy} target="_blank" rel="noopener noreferrer" className="btn primary" tabIndex={open ? 0 : -1}>
            Buy $ZUBA
          </a>
        </div>
      </div>
    </>
  );
}
