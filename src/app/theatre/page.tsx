import type { Metadata } from "next";
import Link from "next/link";
import { games, movies } from "@/content/theatre";
import TitleRow from "@/components/TitleRow";
import { Chev, Divider, Runes, ZText } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "Movies & Games",
  description: "African myths, legends and real-life heroes, told as animated films and playable games.",
};

export default function Theatre() {
  const featured = movies[0];
  const flagship = games.find((g) => g.slug === "zuba-rise-of-the-ancestors") ?? games[0];
  return (
    <>
      <section className="feature">
        <div className="feature-bg" style={{ backgroundImage: `url(${featured.backdrop})` }} aria-hidden="true" />
        <div className="container">
          <div className="feature-copy">
            <p className="t-label">Movies &amp; Games · Featured Legend</p>
            <Runes text={featured.runes} />
            <h1 className="t-title xl">
              <ZText>{featured.title.split(":")[0]}</ZText>
            </h1>
            <p className="t-title md dim" style={{ opacity: 1, color: "var(--violet-soft)" }}>
              <ZText>{featured.title.split(":")[1]?.trim() ?? ""}</ZText>
            </p>
            <Divider variant="notched" align="left" />
            <div className="meta-row">
              <span className="chip">{featured.origin}</span>
              <span className="chip">{featured.genre}</span>
              <span className="chip">{featured.status}</span>
            </div>
            <p className="t-lead">{featured.logline}</p>
            <div className="hero-actions">
              <Link href={`/theatre/movies/${featured.slug}`} className="btn primary">
                <Chev /> Enter the Story
              </Link>
              <a href="#films" className="btn">
                Browse All
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingBottom: 90 }}>
        <section id="films" style={{ scrollMarginTop: 120 }}>
          <header className="heading" style={{ marginBottom: 20 }}>
            <Runes text="Films" />
            <h2 className="t-title lg">
              <ZText>Films</ZText>
            </h2>
            <p className="t-muted" style={{ margin: 0 }}>
              Gods, tricksters, kings and the heroes who gave their lives for a free Africa. All in development.
            </p>
          </header>
          <TitleRow title="Films" items={movies} hideHead />
        </section>

        <Divider variant="notched" />

        <section id="games" style={{ marginTop: 50, scrollMarginTop: 120 }}>
          <header className="heading" style={{ marginBottom: 24 }}>
            <Runes text="Games" />
            <h2 className="t-title lg">
              <ZText>Games</ZText>
            </h2>
            <p className="t-muted" style={{ margin: 0 }}>
              Don&apos;t just hear the legends. Soon, you&apos;ll play them.
            </p>
          </header>
          <Link href={`/theatre/games/${flagship.slug}`} className="h-forge th-flagship">
            <span className="h-forge-art" style={{ backgroundImage: `url(${flagship.backdrop})` }} />
            <span className="h-forge-text">
              <span className="t-label">Our flagship game</span>
              <span className="t-title lg">
                <ZText>{flagship.title.split(":")[0]}</ZText>
              </span>
              <span className="h-forge-sub">
                <ZText>{flagship.title.split(":")[1]?.trim() ?? ""}</ZText>
              </span>
              <span className="h-forge-meta">
                <span className="chip prod">{flagship.status}</span>
                <span className="t-label">{flagship.genre}</span>
              </span>
              <span className="t-lead">{flagship.logline}</span>
              <span className="btn primary" style={{ alignSelf: "flex-start" }}>
                <Chev /> View the Game
              </span>
            </span>
          </Link>
          <div style={{ marginTop: 36 }}>
            <TitleRow title="Legends in the Forge" items={games.filter((g) => g.slug !== flagship.slug)} />
          </div>
        </section>
      </div>
    </>
  );
}
