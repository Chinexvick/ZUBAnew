"use client";

import { useCallback, useEffect, useState } from "react";
import { Divider, Runes, ZText } from "@/components/ui/Glyphs";

type C = { id: string; name: string; text: string; at: string; admin?: boolean };
const NAME_KEY = "zuba-comment-name";

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Comments({ kind, slug }: { kind: "blog" | "devnotes"; slug: string }) {
  const [items, setItems] = useState<C[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?kind=${kind}&slug=${slug}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setItems(j.items ?? []);
    setEnabled(j.enabled !== false);
    setAdmin(!!j.admin);
  }, [kind, slug]);

  useEffect(() => {
    load();
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {}
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, slug, name, text, website: hp }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j.error || "Could not post your comment.");
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {}
    setText("");
    if (j.item) setItems((l) => [...(l ?? []), j.item]);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setItems((l) => (l ?? []).filter((c) => c.id !== id));
  }

  return (
    <section className="cm" id="comments" aria-label="Comments">
      <Runes text="Voices" />
      <h2 className="t-title md">
        <ZText>{`Comments${items?.length ? ` (${items.length})` : ""}`}</ZText>
      </h2>
      <Divider variant="notched" align="left" />

      {items === null ? (
        <p className="t-muted">Loading comments…</p>
      ) : items.length === 0 ? (
        <p className="t-muted">No comments yet. Be the first voice around the fire.</p>
      ) : (
        <ul className="cm-list">
          {items.map((c) => (
            <li key={c.id} className={`cm-item ${c.admin ? "team" : ""}`}>
              <span className="cm-avatar" aria-hidden="true">
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="cm-body">
                <div className="cm-meta">
                  <strong>{c.name}</strong>
                  {c.admin && <span className="chip">ZUBA Team</span>}
                  <span className="t-muted">{ago(c.at)}</span>
                  {admin && (
                    <button className="cm-del" onClick={() => remove(c.id)}>
                      Delete
                    </button>
                  )}
                </div>
                <p>{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {enabled ? (
        <form className="cm-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="cm-name">Your name</label>
            <input id="cm-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="nickname" />
          </div>
          <div className="field">
            <label htmlFor="cm-text">Comment</label>
            <textarea id="cm-text" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} required placeholder="Share your thoughts…" />
          </div>
          <input className="sub-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
          {err && <p className="warning">{err}</p>}
          <div className="cm-actions">
            <button className="btn primary" disabled={busy}>
              {busy ? "Posting…" : "Post comment"}
            </button>
            <span className="t-muted cm-note">Be kind. No links. The team may remove spam.</span>
          </div>
        </form>
      ) : (
        <p className="t-muted">Comments open soon.</p>
      )}
    </section>
  );
}
