import type { Metadata } from "next";
import Link from "next/link";
import { getDevNotes, formatDate } from "@/lib/content";
import { phases } from "@/content/roadmap";
import { art } from "@/content/art";
import { Frame, Heading, Runes, ZText } from "@/components/ui/Glyphs";
import { SubscribeCard } from "@/components/Subscribe";

export const metadata: Metadata = {
  title: "Developer Notebook",
  description: "Progress updates from the ZUBA builders: what we shipped, what we learned and what comes next.",
};

export default async function DevNotes() {
  const notes = await getDevNotes();
  const current = phases.find((p) => p.status === "active") ?? phases[0];
  const totalWins = notes.reduce((n, x) => n + x.achievements.length, 0);

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${art("zuba-game-backdrop")})` }} aria-hidden="true" />
        <div className="container">
          <Heading
            as="h1"
            runes="Builders"
            title="Dev Notes"
            size="xl"
            lead="Every marker on this map is a real update from the ZUBA developers. Follow the trail to see where we've been and exactly where we stand."
          />
        </div>
      </section>

      <div className="container" style={{ paddingBottom: 100 }}>
        <div className="map-board">
          <div className="map-legend">
            <div className="map-progress">
              <span className="t-label">◆ Current region</span>
              <span className="t-title">
                <ZText>{`Phase 0${current.n}: ${current.name}`}</ZText>
              </span>
              <span className="map-check">
                <span className="check on" /> Markers logged <strong style={{ color: "#fff", marginLeft: "auto" }}>{notes.length}</strong>
              </span>
              <span className="map-check">
                <span className="check on" /> Wins logged <strong style={{ color: "#fff", marginLeft: "auto" }}>{totalWins}</strong>
              </span>
            </div>
            <div className="mini-map" aria-label="Roadmap progress">
              {phases.map((p, i) => (
                <span key={p.n} style={{ display: "contents" }}>
                  {i > 0 && <i />}
                  <span className={p.status === "cleared" ? "on" : p.status === "active" ? "now" : ""} title={p.name}>
                    {p.n}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {notes.length === 0 ? (
            <p className="center t-muted">No markers yet. The first entry is coming soon.</p>
          ) : (
            <div className="trail">
              <svg className="trail-svg" preserveAspectRatio="none" viewBox="0 0 200 1000" aria-hidden="true">
                <path d="M100 0 C 20 120, 180 220, 100 330 S 20 560, 100 660 S 180 880, 100 1000" />
              </svg>
              {notes.map((n, i) => (
                <div key={n.slug} className={`waypoint ${i % 2 === 0 ? "left" : "right"}`}>
                  <div className={`waypoint-marker ${i === 0 ? "latest" : ""}`}>
                    <span>{String(notes.length - i).padStart(2, "0")}</span>
                  </div>
                  <Link href={`/dev-notes/${n.slug}`} className="waypoint-card">
                    <Frame hoverable className="paper">
                      <span className="spiral" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                      <div className="mini-note" style={{ minHeight: 0 }}>
                        <span className="note-stamp">{formatDate(n.date)}</span>
                        <span className="t-label">
                          Phase 0{n.phase} · {n.location}
                          {i === 0 && <span className="chip live" style={{ marginLeft: 10 }}>Latest</span>}
                        </span>
                        <h2 className="t-title sm">
                          <ZText>{n.title}</ZText>
                        </h2>
                        <p className="t-muted" style={{ margin: 0 }}>
                          {n.summary}
                        </p>
                        <span className="prompt" style={{ fontSize: "0.85rem" }}>
                          <span className="keycap round">A</span> Open entry
                        </span>
                      </div>
                    </Frame>
                  </Link>
                </div>
              ))}
              <div className="trail-start">
                <Runes text="Base camp" />
                <p className="t-muted" style={{ margin: "6px 0 0" }}>
                  The journey began here.
                </p>
              </div>
            </div>
          )}
        </div>
        <SubscribeCard />
      </div>
    </>
  );
}
