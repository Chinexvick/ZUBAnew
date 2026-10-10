"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { marked } from "marked";
import type { BlogPost, DevNote } from "@/lib/content";
import { Delta, Divider, Runes, ZText } from "@/components/ui/Glyphs";

type Tab = "devnotes" | "blog";
type Item = DevNote | BlogPost;

const today = () => new Date().toISOString().slice(0, 10);

const blankNote = (): DevNote => ({
  slug: "",
  title: "",
  date: today(),
  phase: 2,
  status: "in-progress",
  location: "",
  summary: "",
  achievements: [],
  next: [],
  body: "",
});

const blankPost = (): BlogPost => ({
  slug: "",
  title: "",
  date: today(),
  category: "News",
  author: "ZUBA Team",
  cover: "",
  excerpt: "",
  body: "",
});

export default function Dashboard({ mode }: { mode: string }) {
  const [tab, setTab] = useState<Tab>("devnotes");
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Item | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    const res = await fetch(`/api/admin/content?type=${t}`, { cache: "no-store" });
    if (res.status === 401) return window.location.reload();
    const json = await res.json();
    if (!res.ok) setToast({ kind: "err", text: json.error || "Could not load." });
    const list = ((json.items as Item[]) ?? []).sort((a, b) => (a.date < b.date ? 1 : -1));
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    setSel(null);
    setDraft(null);
    setDirty(false);
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function confirmDiscard() {
    return !dirty || window.confirm("You have unsaved changes. Discard them?");
  }

  function open(i: number | "new") {
    if (!confirmDiscard()) return;
    setSel(i);
    setDraft(i === "new" ? (tab === "devnotes" ? blankNote() : blankPost()) : structuredClone(items[i]));
    setDirty(false);
    setPreview(false);
  }

  function set<K extends string>(key: K, value: unknown) {
    setDraft((d) => (d ? ({ ...d, [key]: value } as Item) : d));
    setDirty(true);
  }

  async function persist(next: Item[], message: string) {
    setBusy(true);
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab, items: next, message }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 401) {
      window.location.reload();
      return null;
    }
    if (!res.ok) {
      setToast({ kind: "err", text: json.error || "Save failed." });
      return null;
    }
    setToast({
      kind: "ok",
      text: json.mode === "github" ? "Saved. The live site updates in about a minute." : "Saved to the local content folder.",
    });
    return (json.items as Item[]).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) return setToast({ kind: "err", text: "Give it a title first." });
    const next = sel === "new" || sel === null ? [draft, ...items] : items.map((it, i) => (i === sel ? draft : it));
    const saved = await persist(next, `${sel === "new" ? "Add" : "Update"} ${tab === "devnotes" ? "dev note" : "blog post"}: ${draft.title}`);
    if (!saved) return;
    setItems(saved);
    const idx = saved.findIndex((it) => it.title === draft.title && it.date === draft.date);
    setSel(idx >= 0 ? idx : null);
    setDraft(idx >= 0 ? structuredClone(saved[idx]) : null);
    setDirty(false);
  }

  async function remove() {
    if (typeof sel !== "number") return;
    if (!window.confirm(`Delete "${items[sel].title}"? This cannot be undone from here.`)) return;
    const saved = await persist(
      items.filter((_, i) => i !== sel),
      `Delete ${tab === "devnotes" ? "dev note" : "blog post"}: ${items[sel].title}`
    );
    if (!saved) return;
    setItems(saved);
    setSel(null);
    setDraft(null);
    setDirty(false);
  }

  async function upload(file: File, onDone: (url: string) => void) {
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setToast({ kind: "err", text: json.error || "Upload failed." });
    onDone(json.url);
    setToast({ kind: "ok", text: mode === "github" ? "Image uploaded. It appears on the live site after the next update." : "Image uploaded." });
  }

  async function logout() {
    if (!confirmDiscard()) return;
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  const html = useMemo(() => (preview && draft ? (marked.parse(draft.body || "", { async: false }) as string) : ""), [preview, draft]);
  const note = tab === "devnotes" ? (draft as DevNote | null) : null;
  const post = tab === "blog" ? (draft as BlogPost | null) : null;

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/" className="nav-logo" style={{ marginBottom: 26 }}>
          <img src="/brand/zuba-coin.png" alt="" width={40} height={40} style={{ borderRadius: "50%" }} />
          <span className="t-title sm">
            <ZText>Workbench</ZText>
          </span>
        </Link>
        <button className={`admin-tab ${tab === "devnotes" ? "active" : ""}`} onClick={() => confirmDiscard() && setTab("devnotes")}>
          <ZText>Dev Notes</ZText>
        </button>
        <button className={`admin-tab ${tab === "blog" ? "active" : ""}`} onClick={() => confirmDiscard() && setTab("blog")}>
          <ZText>Blog</ZText>
        </button>
        <div className="admin-side-foot">
          <span className={`chip ${mode === "github" ? "live" : ""}`}>{mode === "github" ? "● Publishing to GitHub" : "Local mode"}</span>
          <Link href={tab === "devnotes" ? "/dev-notes" : "/blog"} target="_blank" className="prompt">
            View on site ↗
          </Link>
          <button className="prompt" onClick={logout} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
            <span className="keycap">ESC</span> Log out
          </button>
        </div>
      </aside>

      <section className="admin-list">
        <div className="admin-list-head">
          <h2 className="t-title sm">
            <ZText>{tab === "devnotes" ? "Notebook Entries" : "Blog Posts"}</ZText>
          </h2>
          <button className="btn primary" onClick={() => open("new")} style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
            + New
          </button>
        </div>
        {loading ? (
          <p className="t-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="t-muted">Nothing here yet. Create the first one.</p>
        ) : (
          <ul>
            {items.map((it, i) => (
              <li key={it.slug + i}>
                <button className={`admin-row ${sel === i ? "active" : ""}`} onClick={() => open(i)}>
                  <span className="admin-row-title">{it.title}</span>
                  <span className="admin-row-meta">
                    {it.date}
                    {"status" in it ? ` · ${it.status}` : ` · ${(it as BlogPost).category}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-editor">
        {!draft ? (
          <div className="admin-empty">
            <Delta className="delta admin-delta" />
            <Runes text="Select" />
            <p className="t-muted">Pick an entry on the left or create a new one.</p>
          </div>
        ) : (
          <div className="stack">
            <div className="admin-editor-head">
              <div>
                <span className="t-label">{sel === "new" ? "New" : "Editing"}</span>
                <h1 className="t-title md">
                  <ZText>{draft.title || "Untitled"}</ZText>
                </h1>
              </div>
              <div className="hero-actions" style={{ marginTop: 0 }}>
                {typeof sel === "number" && (
                  <button className="btn" onClick={remove} disabled={busy} style={{ borderColor: "rgba(255,122,122,.5)", color: "#ffc2c2" }}>
                    Delete
                  </button>
                )}
                <button className="btn primary" onClick={save} disabled={busy || !dirty}>
                  {busy ? "Saving…" : dirty ? "Save & Publish" : "Saved"}
                </button>
              </div>
            </div>
            <Divider variant="notched" align="left" />

            <div className="admin-grid">
              <div className="field span-2">
                <label>Title</label>
                <input className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder={note ? "e.g. Partnership with ..." : "Post title"} />
              </div>
              <div className="field">
                <label>Date</label>
                <input className="input" type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
              </div>

              {note && (
                <>
                  <div className="field">
                    <label>Roadmap phase</label>
                    <select className="select" value={note.phase} onChange={(e) => set("phase", Number(e.target.value))}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          Phase 0{n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select className="select" value={note.status} onChange={(e) => set("status", e.target.value)}>
                      <option value="cleared">Cleared</option>
                      <option value="in-progress">In progress</option>
                      <option value="planned">Planned</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Map location</label>
                    <input className="input" value={note.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Partner Village" />
                  </div>
                  <div className="field span-3">
                    <label>Summary (shown on the map)</label>
                    <textarea className="input" rows={2} value={note.summary} onChange={(e) => set("summary", e.target.value)} />
                  </div>
                  <div className="field span-3-half">
                    <label>Achieved (one per line)</label>
                    <textarea
                      className="input"
                      rows={5}
                      value={note.achievements.join("\n")}
                      onChange={(e) => set("achievements", e.target.value.split("\n"))}
                      placeholder={"Listed on DEX Screener\nSigned a studio partner"}
                    />
                  </div>
                  <div className="field span-3-half">
                    <label>Next steps (one per line)</label>
                    <textarea className="input" rows={5} value={note.next.join("\n")} onChange={(e) => set("next", e.target.value.split("\n"))} />
                  </div>
                </>
              )}

              {post && (
                <>
                  <div className="field">
                    <label>Category</label>
                    <input className="input" value={post.category} onChange={(e) => set("category", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Author</label>
                    <input className="input" value={post.author} onChange={(e) => set("author", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Cover image</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="input" value={post.cover} onChange={(e) => set("cover", e.target.value)} placeholder="/uploads/... or https://" />
                      <label className="btn" style={{ padding: "8px 14px", fontSize: "0.75rem", cursor: "pointer" }}>
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], (u) => set("cover", u))}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="field span-3">
                    <label>Excerpt</label>
                    <textarea className="input" rows={2} value={post.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
                  </div>
                </>
              )}

              <div className="field span-3">
                <div className="admin-body-head">
                  <label>Body (Markdown: ## heading, **bold**, - list, [link](url), &gt; quote)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <label className="prompt-pill" style={{ cursor: "pointer", fontSize: "0.8rem" }}>
                      <span className="keycap">+</span> Image
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], (u) => set("body", `${draft.body}\n\n![](${u})\n`))}
                      />
                    </label>
                    <button type="button" className="prompt-pill" style={{ fontSize: "0.8rem" }} onClick={() => setPreview((p) => !p)}>
                      <span className="keycap">Y</span> {preview ? "Edit" : "Preview"}
                    </button>
                  </div>
                </div>
                {preview ? (
                  <div className="prose admin-preview" dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <textarea className="textarea" value={draft.body} onChange={(e) => set("body", e.target.value)} />
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {toast && <div className={`admin-toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
