"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SRC = "/audio/the-call-of-zuba.mp3";
const TARGET = 0.6;
const FADE_MS = 1800;

/* Site music. Browsers only allow sound after the visitor's first interaction, so we try on load
   and again on the first tap, click, key press, scroll or touch, then fade in. Loops quietly after. */
export default function Music() {
  const pathname = usePathname();
  const off = pathname.startsWith("/admin");

  useEffect(() => {
    if (off) return;
    const w = window as Window & { __zubaAudio?: HTMLAudioElement };
    const audio = w.__zubaAudio ?? new Audio(SRC);
    w.__zubaAudio = audio;
    audio.loop = true;
    audio.preload = "auto";
    if (!audio.paused) return;

    let started = false;
    const events = ["pointerdown", "touchstart", "touchend", "click", "keydown", "wheel", "scroll"] as const;

    const fadeIn = () => {
      const t0 = performance.now();
      const step = (t: number) => {
        audio.volume = Math.min(TARGET, (TARGET * (t - t0)) / FADE_MS);
        if (audio.volume < TARGET) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const tryPlay = () => {
      if (started) return;
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          started = true;
          events.forEach((e) => window.removeEventListener(e, tryPlay, true));
          fadeIn();
        })
        .catch(() => {
          /* not allowed yet: wait for the next interaction */
        });
    };

    events.forEach((e) => window.addEventListener(e, tryPlay, { capture: true, passive: true }));
    tryPlay();
    return () => events.forEach((e) => window.removeEventListener(e, tryPlay, true));
  }, [off]);

  useEffect(() => {
    const a = (window as Window & { __zubaAudio?: HTMLAudioElement }).__zubaAudio;
    if (off && a) a.pause();
  }, [off]);

  return null;
}
