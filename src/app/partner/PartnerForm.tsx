"use client";

import { useEffect, useRef, useState } from "react";
import { tracks, type Field } from "@/content/partner";
import { Icon } from "@/components/Icons";
import { Divider, Runes, ZText } from "@/components/ui/Glyphs";

export default function PartnerForm() {
  const [trackId, setTrackId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hp, setHp] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const track = tracks.find((t) => t.id === trackId) ?? null;

  // Deep links: /partner#games opens that track.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (tracks.some((t) => t.id === id)) setTrackId(id);
  }, []);

  function pick(id: string) {
    setTrackId(id);
    setStatus("idle");
    setMsg("");
    history.replaceState(null, "", `#${id}`);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!track) return;
    setStatus("busy");
    setMsg("");
    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: track.id, answers, website2: hp }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) {
      setStatus("done");
      setAnswers({});
    } else {
      setStatus("error");
      setMsg(json.error || "Something went wrong.");
    }
  }

  const input = (f: Field) => {
    const common = {
      id: `pf-${f.id}`,
      value: answers[f.id] ?? "",
      required: f.required,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setAnswers((a) => ({ ...a, [f.id]: e.target.value })),
    };
    if (f.kind === "textarea") return <textarea className="input" rows={5} {...common} placeholder={f.placeholder} />;
    if (f.kind === "select")
      return (
        <select className="select" {...common}>
          <option value="">Choose…</option>
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    return <input className="input" type={f.kind === "url" ? "url" : f.kind === "email" ? "email" : "text"} {...common} placeholder={f.placeholder} />;
  };

  return (
    <>
      <section className="section" id="paths">
        <div className="container">
          <div className="center stack" style={{ marginBottom: 34 }}>
            <Runes text="Paths" />
            <h2 className="t-title lg">
              <ZText>Choose Your Path</ZText>
            </h2>
            <Divider variant="notched" />
            <p className="t-lead" style={{ maxWidth: 620, margin: "0 auto" }}>
              Six ways to build with ZUBA. Pick the one that fits you and the form adapts to ask only what matters.
            </p>
          </div>
          <div className="pw-tracks">
            {tracks.map((t) => (
              <button key={t.id} type="button" className={`pw-track ${trackId === t.id ? "active" : ""}`} onClick={() => pick(t.id)} aria-pressed={trackId === t.id}>
                <span className="pw-track-icon">
                  <Icon name={t.icon} size={26} />
                </span>
                <span className="t-label">{t.short}</span>
                <span className="t-title sm">
                  <ZText>{t.name}</ZText>
                </span>
                <span className="pw-track-blurb">{t.blurb}</span>
                <ul className="pw-gets">
                  {t.gets.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
                <span className="prompt">{trackId === t.id ? "Selected ✓" : "Apply ▸"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="apply" ref={formRef}>
        <div className="container">
          <div className="pw-form-wrap">
            {!track ? (
              <div className="center stack" style={{ padding: "30px 10px" }}>
                <Runes text="Apply" />
                <h2 className="t-title md">
                  <ZText>The Application Scroll</ZText>
                </h2>
                <p className="t-muted">Choose a path above to open the right form.</p>
              </div>
            ) : status === "done" ? (
              <div className="center stack" style={{ padding: "30px 10px" }}>
                <span className="sub-check" style={{ width: 40, height: 40, margin: "0 auto" }} aria-hidden="true" />
                <h2 className="t-title md">
                  <ZText>Application Received</ZText>
                </h2>
                <p className="t-muted" style={{ maxWidth: 480, margin: "0 auto" }}>
                  Thank you. The ZUBA team reviews every application and will reach you on the Telegram or WhatsApp you shared.
                </p>
                <button type="button" className="btn" style={{ justifyContent: "center", margin: "10px auto 0" }} onClick={() => setStatus("idle")}>
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="pw-form-head">
                  <div>
                    <span className="t-label">Application · {track.short}</span>
                    <h2 className="t-title md">
                      <ZText>{track.name}</ZText>
                    </h2>
                  </div>
                  <select className="select pw-switch" value={track.id} onChange={(e) => pick(e.target.value)} aria-label="Change partnership type">
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Divider variant="notched" align="left" />
                <div className="pw-fields">
                  {track.fields.map((f) => (
                    <div key={f.id} className={`field ${f.kind === "textarea" ? "wide" : ""}`}>
                      <label htmlFor={`pf-${f.id}`}>
                        {f.label}
                        {f.required && <span className="pw-req"> *</span>}
                      </label>
                      {input(f)}
                      {f.hint && <span className="pw-hint">{f.hint}</span>}
                    </div>
                  ))}
                </div>
                <input className="sub-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
                {status === "error" && <p className="warning">{msg}</p>}
                <div className="pw-submit">
                  <button className="btn primary" disabled={status === "busy"}>
                    {status === "busy" ? "Sending…" : "Send application"}
                  </button>
                  <span className="pw-hint">Fields marked * are required. We reply within a few days.</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
