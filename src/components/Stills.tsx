"use client";

import { useEffect, useState } from "react";

export default function Stills({ images, title }: { images: string[]; title: string }) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = images.filter(Boolean);
  return (
    <>
      <div className="stills">
        {shown.map((src, i) => (
          <button key={src} className={`still ${i === 0 ? "wide" : ""}`} onClick={() => setOpen(src)} aria-label={`Open still ${i + 1} from ${title}`}>
            <img src={src} alt={`Still ${i + 1} from ${title}`} loading="lazy" />
          </button>
        ))}
      </div>
      {open && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={`${title} still`}>
          <img src={open} alt="" />
          <span className="prompt">
            <span className="keycap">ESC</span> Close
          </span>
        </div>
      )}
    </>
  );
}
