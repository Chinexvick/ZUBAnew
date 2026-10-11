"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { marked } from "marked";
import type { BlogPost, DevNote } from "@/lib/content";
import { Delta, Divider, Runes, ZText } from "@/components/ui/Glyphs";

type Tab = "devnotes" | "blog" | "subscribers" | "applications";
type Application = { id: string; track: string; trackName: string; at: string; answers: Record<string, string>; labels: Record<string, string> };
type Subs = { enabled: boolean; mail: boolean; emails: string[]; notified: Record<string, string> };
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
  const [subs, setSubs] = useState<Subs | null>(null);
  const [apps, setApps] = useState<Application[] | null>(null);
  const [appFilter, setAppFilter] = useState("all");

  const loadApps = useCallback(async () => {
    const res = await fetch("/api/admin/applications", { cache: "no-store" });
    if (res.ok) setApps((await res.json()).items);
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  async function removeApp(id: string) {
    if (!window.confirm("Delete this application?")) return;
    const res = await fetch(`/api/admin/applications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) loadApps();
  }
  const [emailOnPublish, setEmailOnPublish] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const loadSubs = useCallback(async () => {
    const res = await fetch("/api/admin/subscribers", { cache: "no-store" });
    if (res.status === 401) return window.location.reload();
    if (res.ok) setSubs(await res.json());
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const load = useCallback(async (t: Tab) => {
    if (t === "subscribers" || t === "applications") {
      setItems([]);
      setLoading(false);
      return;
    }
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
      text:
        json.mode === "blob"
          ? "Saved. It's live on the site now."
          : json.mode === "github"
            ? "Saved. The live site updates in about a minute."
            : "Saved to the local content folder.",
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
    if (tab === "devnotes" && sel === "new" && idx >= 0 && emailOnPublish && subs?.enabled && subs.mail) {
      await broadcast(saved[idx].slug, saved[idx].title);
    }
  }

  /* Emails a dev note to every subscriber, batch by batch, showing progress. */
  async function broadcast(slug: string, title: string, restart = false) {
    setSending(slug);
    let sent = 0;
    let failed = 0;
    try {
      for (let first = true; ; first = false) {
        setToast({ kind: "ok", text: `Emailing subscribers about “${title}”… ${sent} sent` });
        const res = await fetch("/api/admin/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, restart: restart && first }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Sending stopped.");
        sent += json.sent;
        failed += json.failed?.length ?? 0;
        if (json.done) break;
      }
      setToast({ kind: failed ? "err" : "ok", text: `Emailed ${sent} subscriber${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.` });
    } catch (e) {
      setToast({ kind: "err", text: `${(e as Error).message} ${sent} sent so far. Press “Resume sending” to finish.` });
    }
    setSending(null);
    loadSubs();
  }

  async function sendTest(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/admin/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, test: true }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setToast(res.ok ? { kind: "ok", text: "Test email sent to the admin inbox." } : { kind: "err", text: json.error || "Test failed." });
  }

  async function removeSub(email: string) {
    if (!window.confirm(`Remove ${email} from the list?`)) return;
    const res = await fetch(`/api/admin/subscribers?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    if (res.ok) loadSubs();
  }

  function downloadCsv() {
    if (!subs) return;
    const blob = new Blob(["email\n" + subs.emails.join("\n") + "\n"], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `zuba-subscribers-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
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
        <button className={`admin-tab ${tab === "subscribers" ? "active" : ""}`} onClick={() => confirmDiscard() && setTab("subscribers")}>
          <ZText>Subscribers</ZText>
          {subs?.enabled && <span className="admin-count">{subs.emails.length}</span>}
        </button>
        <button className={`admin-tab ${tab === "applications" ? "active" : ""}`} onClick={() => confirmDiscard() && setTab("applications")}>
          <ZText>Applications</ZText>
          {apps && <span className="admin-count">{apps.length}</span>}
        </button>
        <div className="admin-side-foot">
          <span className={`chip ${mode !== "local" ? "live" : ""}`}>
            {mode === "blob" ? "● Live database" : mode === "github" ? "● Publishing to GitHub" : "Local mode"}
          </span>
          <Link href={tab === "blog" ? "/blog" : "/dev-notes"} target="_blank" className="prompt">
            View on site ↗
          </Link>
          <button className="prompt" onClick={logout} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
            <span className="keycap">ESC</span> Log out
          </button>
        </div>
      </aside>

      {tab === "applications" ? (
        <section className="admin-subs">
          <div className="admin-editor-head">
            <div>
              <span className="t-label">Partner With Us</span>
              <h1 className="t-title md">
                <ZText>Applications</ZText>
              </h1>
            </div>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <select className="select" value={appFilter} onChange={(e) => setAppFilter(e.target.value)} style={{ width: "auto" }}>
                <option value="all">All types</option>
                {Array.from(new Set((apps ?? []).map((a) => a.track))).map((t) => (
                  <option key={t} value={t}>
                    {apps!.find((a) => a.track === t)!.trackName}
                  </option>
                ))}
              </select>
              <button className="btn" onClick={loadApps}>
                Refresh
              </button>
            </div>
          </div>
          <Divider variant="notched" align="left" />
          {!apps ? (
            <p className="t-muted">Loading…</p>
          ) : apps.length === 0 ? (
            <p className="t-muted">No applications yet. Every new one also arrives by email.</p>
          ) : (
            <div className="admin-apps">
              {apps
                .filter((a) => appFilter === "all" || a.track === appFilter)
                .map((a) => (
                  <details key={a.id} className="admin-app">
                    <summary>
                      <span className="chip">{a.trackName}</span>
                      <strong>{a.answers.company || a.answers.name}</strong>
                      <span className="admin-row-meta">{new Date(a.at).toLocaleString()}</span>
                    </summary>
                    <dl>
                      {Object.entries(a.answers).map(([k, v]) => (
                        <div key={k}>
                          <dt>{a.labels[k] ?? k}</dt>
                          <dd>{/^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noopener noreferrer">{v}</a> : v}</dd>
                        </div>
                      ))}
                    </dl>
                    <button className="prompt" onClick={() => removeApp(a.id)} style={{ background: "none", border: 0, color: "#ffc2c2", cursor: "pointer" }}>
                      Delete
                    </button>
                  </details>
                ))}
            </div>
          )}
        </section>
      ) : tab === "subscribers" ? (
        <section className="admin-subs">
          <div className="admin-editor-head">
            <div>
              <span className="t-label">Builders&apos; Circle</span>
              <h1 className="t-title md">
                <ZText>Subscribers</ZText>
              </h1>
            </div>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <button className="btn" onClick={() => sendTest({ welcomeTest: true })} disabled={busy || !subs?.mail}>
                Send welcome test to me
              </button>
              <button className="btn primary" onClick={downloadCsv} disabled={!subs?.emails.length}>
                Download CSV
              </button>
            </div>
          </div>
          <Divider variant="notched" align="left" />
          {!subs ? (
            <p className="t-muted">Loading…</p>
          ) : !subs.enabled || !subs.mail ? (
            <p className="warning">
              {!subs.enabled ? "The subscriber database (Vercel Blob) is not connected." : "Email (SMTP) is not set up."} The pop-up stays
              hidden from visitors until both are ready.
            </p>
          ) : (
            <>
              <div className="admin-stats">
                <div>
                  <span className="t-label">Subscribers</span>
                  <strong>{subs.emails.length}</strong>
                </div>
                <div>
                  <span className="t-label">Notes emailed</span>
                  <strong>{Object.keys(subs.notified).length}</strong>
                </div>
              </div>
              <p className="t-muted">
                New dev notes are emailed to everyone here when you publish them (tick &ldquo;Email subscribers&rdquo; in the note editor).
                People join from the pop-up and the Dev Notes page, and every email carries an unsubscribe link.
              </p>
              {subs.emails.length === 0 ? (
                <p className="t-muted">No subscribers yet.</p>
              ) : (
                <ul className="admin-sub-list">
                  {subs.emails.map((e) => (
                    <li key={e}>
                      <span>{e}</span>
                      <button className="prompt" onClick={() => removeSub(e)} aria-label={`Remove ${e}`}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      ) : (
      <>
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
                {note && sel === "new" && subs?.enabled && subs.mail && (
                  <label className="admin-check">
                    <input type="checkbox" checked={emailOnPublish} onChange={(e) => setEmailOnPublish(e.target.checked)} />
                    Email {subs.emails.length} subscriber{subs.emails.length === 1 ? "" : "s"} on publish
                  </label>
                )}
                {note && typeof sel === "number" && !dirty && subs?.enabled && subs.mail && (
                  <>
                    <button className="btn" onClick={() => sendTest({ slug: note.slug })} disabled={busy || !!sending}>
                      Test email
                    </button>
                    <button
                      className="btn"
                      disabled={busy || !!sending || !subs.emails.length}
                      onClick={() => {
                        const st = subs.notified[note.slug];
                        if (st === "partial") return broadcast(note.slug, note.title);
                        if (st) {
                          if (window.confirm(`This note was already emailed on ${st.slice(0, 10)}. Send it again to all ${subs.emails.length} subscribers?`))
                            broadcast(note.slug, note.title, true);
                          return;
                        }
                        if (window.confirm(`Email this note to ${subs.emails.length} subscribers now?`)) broadcast(note.slug, note.title);
                      }}
                    >
                      {sending === note.slug
                        ? "Sending…"
                        : subs.notified[note.slug] === "partial"
                          ? "Resume sending"
                          : subs.notified[note.slug]
                            ? "Emailed ✓ Resend"
                            : "Email subscribers"}
                    </button>
                  </>
                )}
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
      </>
      )}

      {toast && <div className={`admin-toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
