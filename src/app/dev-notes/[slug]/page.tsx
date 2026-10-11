import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDevNote, getDevNotes, formatDate, renderMarkdown } from "@/lib/content";
import { phases } from "@/content/roadmap";
import { Chev, Divider, Runes, ZText } from "@/components/ui/Glyphs";
import Share from "@/components/Share";
import { siteUrl } from "@/lib/mailer";

type Params = { slug: string };

export async function generateStaticParams() {
  return (await getDevNotes()).map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const n = await getDevNote((await params).slug);
  if (!n) return {};
  const url = `/dev-notes/${n.slug}`;
  const image = "/email/notes-banner.jpg";
  return {
    title: n.title,
    description: n.summary,
    alternates: { canonical: url },
    openGraph: { type: "article", title: `Dev Note: ${n.title}`, description: n.summary, url, images: [{ url: image, width: 1200, height: 520, alt: n.title }], publishedTime: n.date },
    twitter: { card: "summary_large_image", title: `Dev Note: ${n.title}`, description: n.summary, images: [image] },
  };
}

const statusLabel = { cleared: "Cleared", "in-progress": "In Progress", planned: "Planned" } as const;

export default async function DevNotePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const notes = await getDevNotes();
  const idx = notes.findIndex((n) => n.slug === slug);
  if (idx < 0) notFound();
  const n = notes[idx];
  const newer = notes[idx - 1];
  const older = notes[idx + 1];
  const phase = phases.find((p) => p.n === n.phase);

  return (
    <div className="page">
      <div className="container">
        <Link href="/dev-notes" className="back-link" style={{ marginBottom: 24 }}>
          <Chev dir="left" /> Back to Dev Notes
        </Link>

        <article className="notebook" style={{ marginTop: 20 }}>
          <span className="notebook-spine" aria-hidden="true" />
          <div className="notebook-left">
            <span className="hand">{formatDate(n.date)}</span>
            <span className={`stamp ${n.status}`}>{statusLabel[n.status] ?? n.status}</span>
            <div>
              <span className="t-label">Location</span>
              <p className="t-title sm" style={{ marginTop: 6 }}>
                <ZText>{n.location || "On the road"}</ZText>
              </p>
            </div>
            <div>
              <span className="t-label">Roadmap</span>
              <div className="mini-map" style={{ marginTop: 10 }}>
                {phases.map((p, i) => (
                  <span key={p.n} style={{ display: "contents" }}>
                    {i > 0 && <i />}
                    <span className={p.n <= n.phase ? "on" : ""} title={p.name}>
                      {p.n}
                    </span>
                  </span>
                ))}
              </div>
              {phase && (
                <p className="t-muted" style={{ marginTop: 8 }}>
                  Phase 0{phase.n}: {phase.name}
                </p>
              )}
            </div>
            {n.achievements.length > 0 && (
              <div>
                <span className="t-label">Shipped in this update</span>
                <ul className="task-list" style={{ marginTop: 12 }}>
                  {n.achievements.map((a) => (
                    <li key={a}>
                      <span className="check on" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {n.next.length > 0 && (
              <div>
                <span className="t-label">Next on the trail</span>
                <ul className="task-list" style={{ marginTop: 12 }}>
                  {n.next.map((a) => (
                    <li key={a}>
                      <span className="check" />
                      <span className="t-muted">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="notebook-right">
            <Runes text="Dev Note" />
            <h1 className="t-title lg" style={{ marginTop: 10 }}>
              <ZText>{n.title}</ZText>
            </h1>
            <Divider variant="notched" align="left" />
            <p className="t-lead">{n.summary}</p>
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body) }} />
            <p className="hand" style={{ marginTop: 30, textAlign: "right" }}>
              The ZUBA Builders
            </p>
          </div>
        </article>
        <Share url={`${siteUrl()}/dev-notes/${n.slug}`} title={`Dev Note: ${n.title}`} />

        <nav className="hero-actions" style={{ justifyContent: "space-between", marginTop: 30 }}>
          {older ? (
            <Link href={`/dev-notes/${older.slug}`} className="prompt-pill">
              <span className="keycap">LB</span> Older · {older.title}
            </Link>
          ) : (
            <span />
          )}
          {newer && (
            <Link href={`/dev-notes/${newer.slug}`} className="prompt-pill">
              Newer · {newer.title} <span className="keycap">RB</span>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
