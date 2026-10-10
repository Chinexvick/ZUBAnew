import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allTitles, findTitle, games, movies } from "@/content/theatre";
import Stills from "@/components/Stills";
import TitleRow from "@/components/TitleRow";
import { Chev, Divider, Frame, Heading, Runes, ZText } from "@/components/ui/Glyphs";

type Params = { kind: string; slug: string };

export function generateStaticParams() {
  return allTitles.map((t) => ({ kind: t.kind === "movie" ? "movies" : "games", slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { kind, slug } = await params;
  const t = findTitle(kind, slug);
  if (!t) return {};
  return { title: t.title, description: t.logline, openGraph: { images: t.poster ? [t.poster] : [] } };
}

export default async function TitlePage({ params }: { params: Promise<Params> }) {
  const { kind, slug } = await params;
  const t = findTitle(kind, slug);
  if (!t) notFound();

  const isMovie = t.kind === "movie";
  const more = (isMovie ? movies : games).filter((x) => x.slug !== t.slug);
  const [main, sub] = t.title.split(":");

  return (
    <>
      <section className="detail-hero">
        <div className="feature-bg" style={{ backgroundImage: `url(${t.backdrop})` }} aria-hidden="true" />
        <div className="container">
          {t.poster && (
            <div className="detail-poster rise">
              <img src={t.poster} alt={`${t.title} poster`} />
            </div>
          )}
          <div className="detail-copy">
            <Link href={`/theatre#${isMovie ? "films" : "games"}`} className="back-link">
              <Chev dir="left" /> Back to the Theatre
            </Link>
            <p className="t-label">
              {isMovie ? "ZUBA Films" : "ZUBA Games"} · {t.shelf}
            </p>
            <Runes text={t.runes} />
            <h1 className="t-title xl" style={{ fontSize: "clamp(2.4rem, 6vw, 4.6rem)" }}>
              <ZText>{main}</ZText>
            </h1>
            {sub && (
              <p className="t-title md" style={{ color: "var(--violet-soft)", textShadow: "none" }}>
                <ZText>{sub.trim()}</ZText>
              </p>
            )}
            <div className="meta-row">
              <span className="chip">{t.origin}</span>
              <span className="chip">{t.genre}</span>
              <span className="chip">{t.format}</span>
              <span className="chip live">{t.status}</span>
            </div>
            <p className="t-lead">{t.logline}</p>
            <div className="hero-actions">
              <a href="#story" className="btn primary">
                <Chev /> {isMovie ? "Read the Storyline" : "Explore the Game"}
              </a>
              <a href="#gallery" className="btn">
                View Gallery
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingBottom: 90 }}>
        <div className="detail-layout" id="story" style={{ scrollMarginTop: 110 }}>
          <div>
            <Heading runes="Story" title={isMovie ? "The Storyline" : "The World"} size="md" align="left" />
            <p className="t-lead" style={{ marginTop: 18 }}>
              {t.synopsis}
            </p>
            <div className="chapters">
              {t.chapters.map((c, i) => (
                <div className="chapter" key={c.title}>
                  <span className="chapter-dot">
                    <span>{i + 1}</span>
                  </span>
                  <h3 className="t-title sm">
                    <ZText>{c.title}</ZText>
                  </h3>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
            {t.quote && (
              <p className="t-lore" style={{ fontSize: "1.15rem", marginTop: 10 }}>
                {t.quote}
              </p>
            )}
          </div>

          <aside className="side-card">
            <Frame>
              <div className="side-card">
                <h3 className="t-title sm">
                  <ZText>Codex</ZText>
                </h3>
                <Divider variant="simple" align="left" />
                <dl className="kv">
                  <dt>Origin</dt>
                  <dd>{t.origin}</dd>
                  <dt>Genre</dt>
                  <dd>{t.genre}</dd>
                  <dt>Format</dt>
                  <dd>{t.format}</dd>
                  <dt>Status</dt>
                  <dd>{t.status}</dd>
                </dl>
              </div>
            </Frame>
            <Frame>
              <div className="side-card">
                <h3 className="t-title sm">
                  <ZText>{isMovie ? "Characters" : "Heroes"}</ZText>
                </h3>
                <Divider variant="simple" align="left" />
                <ul className="cast-list">
                  {t.cast.map((p) => (
                    <li key={p.name}>
                      <span className="medal">{p.name[0]}</span>
                      <span>
                        <strong style={{ color: "#fff" }}>{p.name}</strong>
                        <br />
                        <span className="t-muted" style={{ fontSize: "0.9rem" }}>
                          {p.role}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Frame>
            {t.features && (
              <Frame>
                <div className="side-card">
                  <h3 className="t-title sm">
                    <ZText>Features</ZText>
                  </h3>
                  <Divider variant="simple" align="left" />
                  <ul className="feature-list">
                    {t.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </Frame>
            )}
            {t.note && <p className="tribute-note">{t.note}</p>}
          </aside>
        </div>

        <section id="gallery" className="section" style={{ paddingBottom: 30, scrollMarginTop: 110 }}>
          <Heading runes="Gallery" title="Scenes" size="md" />
          <div style={{ marginTop: 30 }}>
            <Stills images={[t.backdrop, ...t.stills]} title={t.title} />
          </div>
        </section>

        <section className="section" style={{ paddingTop: 30 }}>
          <TitleRow title={isMovie ? "More Films" : "More Games"} items={more} />
          <TitleRow title={isMovie ? "Play the Legends" : "Watch the Legends"} items={isMovie ? games : movies} />
        </section>
      </div>
    </>
  );
}
