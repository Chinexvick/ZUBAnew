"use client";

import { useState } from "react";

/* Share a page: native share sheet on phones, copy link everywhere, plus X / Telegram / WhatsApp. */
export default function Share({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const text = `${title} · ZUBA`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement("textarea");
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function native() {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        return;
      }
    }
    copy();
  }

  return (
    <div className="share" role="group" aria-label="Share">
      <span className="t-label">Share this</span>
      <div className="share-row">
        <button type="button" className="btn primary share-main" onClick={native}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
          Share
        </button>
        <button type="button" className="btn share-pill" onClick={copy} aria-live="polite">
          {copied ? "Link copied ✓" : "Copy link"}
        </button>
        <a className="btn share-pill" href={`https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer">
          X
        </a>
        <a className="btn share-pill" href={`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`} target="_blank" rel="noopener noreferrer">
          Telegram
        </a>
        <a className="btn share-pill" href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </div>
    </div>
  );
}
