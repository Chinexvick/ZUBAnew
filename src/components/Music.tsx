"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SRC = "/audio/the-call-of-zuba.mp3";
const TARGET = 0.6;
const FADE_MS = 1800;

type W = Window & { __zubaAudio?: HTMLAudioElement };

/* Site music. Browsers only allow sound after the visitor's first interaction, so we try on load
   and again on the first tap, click, key press, scroll or touch, then fade in. Loops quietly after.
   It never clashes with the games: it is off on game pages, stops the moment a Play link is
   clicked (the games have their own music), and fades out while a games section
   (anything marked data-music-off) is on screen. */
export default function Music() {
  const pathname = usePathname();
  const off = pathname.startsWith("/admin") || pathname.startsWith("/theatre/games") || pathname.startsWith("/play");

  useEffect(() => {
    const w = window as W;
    if (off) {
      w.__zubaAudio?.pause();
      return;
    }
    const audio = w.__zubaAudio ?? new Audio(SRC);
    w.__zubaAudio = audio;
    audio.loop = true;
    audio.preload = "auto";

    let stopped = false; // a game is being opened
    const visible = new Set<Element>();
    const want = () => (visible.size ? 0 : TARGET);

    let fade = 0;
    const fadeTo = (v: number, ms: number) => {
      cancelAnimationFrame(fade);
      const from = audio.volume;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        audio.volume = from + (v - from) * k;
        if (k < 1) fade = requestAnimationFrame(step);
      };
      fade = requestAnimationFrame(step);
    };

    const events = ["pointerdown", "touchstart", "touchend", "click", "keydown", "wheel", "scroll"] as const;
    const isPlayLink = (e?: Event) => !!(e?.target as Element | null)?.closest?.('a[href^="/play"]');

    const tryPlay = (e?: Event) => {
      if (stopped || !audio.paused || isPlayLink(e)) return;
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          events.forEach((ev) => window.removeEventListener(ev, tryPlay, true));
          fadeTo(want(), FADE_MS);
        })
        .catch(() => {
          /* not allowed yet: wait for the next interaction */
        });
    };

    // Entering a game: stop the site music at once.
    const onPlayLink = (e: Event) => {
      if (!isPlayLink(e)) return;
      stopped = true;
      cancelAnimationFrame(fade);
      audio.pause();
    };
    window.addEventListener("click", onPlayLink, true);

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) visible.add(en.target);
          else visible.delete(en.target);
        }
        if (!audio.paused && !stopped) fadeTo(want(), 700);
      },
      { threshold: 0.35 },
    );
    document.querySelectorAll("[data-music-off]").forEach((el) => io.observe(el));

    if (audio.paused) {
      events.forEach((ev) => window.addEventListener(ev, tryPlay, { capture: true, passive: true }));
      tryPlay();
    }
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, tryPlay, true));
      window.removeEventListener("click", onPlayLink, true);
      io.disconnect();
      cancelAnimationFrame(fade);
    };
  }, [off, pathname]);

  return null;
}
