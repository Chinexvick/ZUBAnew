import Link from "next/link";
import { media } from "@/content/media";
import { games, movies } from "@/content/theatre";
import { phases } from "@/content/roadmap";
import { getDevNotes, formatDate } from "@/lib/content";
import { listings, partners, site } from "@/lib/site";
import CopyCA from "@/components/CopyCA";
import TitleRow from "@/components/TitleRow";
import { SocialRow } from "@/components/Social";
import { Chev, Cursor, Delta, Divider, Frame, Heading, Runes, ZText } from "@/components/ui/Glyphs";
import { PartnerGrid, ListingGrid } from "@/components/Listings";

export default async function Home() {
  const notes = (await getDevNotes()).slice(0, 3);
  const hero = media["zuba-royal-a"];

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="hero-bg" style={{ backgroundImage: `url(${media["world-hero"]})` }} aria-hidden="true" />
        <div className="hero-veil" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="t-label rise">Tales of the Motherland · Chapter One</p>
            <Runes text="Zuba" className="hero-runes rise rise-2" />
            <h1 className="t-title xl hero-title rise rise-2">
              <ZText>ZUBA</ZText>
            </h1>
            <Divider variant="notched" align="left" />
            <p className="hero-tag t-title md rise rise-3">
              <ZText>{site.tagline}</ZText>
            </p>
            <p className="t-lead rise rise-3">
              A gaming and animation token on a mission: prove to the world that Africa doesn&apos;t just belong in anime and games. It
              was <span className="hl">always the main character</span>.
            </p>
            <div className="hero-ca rise rise-4">
              <CopyCA />
            </div>
            <div className="hero-actions rise rise-4">
              <Link href="/token" className="btn primary">
                <Chev /> Buy $ZUBA <Chev dir="left" />
              </Link>
              <Link href="/theatre" className="btn">
                Enter the Theatre
              </Link>
            </div>
          </div>

          <div className="hero-art">
            <svg className="hero-delta" viewBox="0 0 400 380" aria-hidden="true">
              <path d="M60 268 L200 30 L340 268 Z" />
              <path d="M20 340 H380" />
            </svg>
            <div className="hero-ring" aria-hidden="true" />
            {hero && <img className="hero-zuba" src={hero} alt="ZUBA, the white pup hero in purple and gold royal African attire, raising the gold ZUBA coin" />}
          </div>
        </div>

        <nav className="hero-menu" aria-label="Quick start">
          {[
            ["/about", "Begin the Journey"],
            ["/theatre", "Watch the Legends"],
            ["/roadmap", "Read the Map"],
            ["/community", "Join the Village"],
          ].map(([href, label], i) => (
            <Link key={href} href={href} className={`hero-menu-item ${i === 0 ? "first" : ""}`}>
              <Chev />
              <ZText>{label}</ZText>
              <Chev dir="left" />
            </Link>
          ))}
        </nav>
      </section>

      {/* ============ LEGEND (shrine unlock) ============ */}
      <section className="section">
        <div className="container">
          <div className="shrine">
            <div className="shrine-crest" aria-hidden="true">
              <Delta className="shrine-delta" />
            </div>
            <div className="shrine-band">
              <Divider variant="notched" />
              <Runes text="New Legend" />
              <h2 className="t-title lg">
                <ZText>A Legend Unlocked</ZText>
              </h2>
              <p className="t-lead">
                For centuries the world&apos;s greatest stories were told about everyone but us. ZUBA flips the script. We back
                <span className="hl"> African games</span>, <span className="hl">African animation</span> and the creators who make them,
                powered by a community that owns the journey.
              </p>
              <Divider variant="diamond" />
              <p className="t-lore">
                A small pup carried a gold coin across the whole continent. In it echoed every story the elders ever told. Wherever the
                coin sang, people remembered who they were.
              </p>
              <Link href="/about" className="prompt" style={{ marginTop: 6 }}>
                <span className="keycap round">A</span> Continue the story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PILLARS ============ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="grid cols-3">
            {[
              { k: "Games", r: "Play", t: "Play the Myths", d: "Original games built on African legends, from swamp dragons to lightning birds. Holders help shape what gets built first." },
              { k: "Animation", r: "Watch", t: "Watch the Legends", d: "Animated stories of gods, tricksters and real-life heroes, drawn with African hands and African pride." },
              { k: "Community", r: "Own", t: "Own the Journey", d: "No gatekeepers. The village votes, creates, shares and grows together. Ubuntu: I am because we are." },
            ].map((p, i) => (
              <Frame key={p.k} hoverable>
                <div className="pillar">
                  <span className="pillar-num">0{i + 1}</span>
                  <Runes text={p.r} />
                  <h3 className="t-title md">
                    <ZText>{p.t}</ZText>
                  </h3>
                  <Divider variant="simple" />
                  <p className="t-muted">{p.d}</p>
                </div>
              </Frame>
            ))}
          </div>
        </div>
      </section>

      {/* ============ THEATRE PREVIEW ============ */}
      <section className="section">
        <div className="container">
          <Heading
            runes="Theatre"
            title="Now Showing"
            lead="Five films. Five games. All African. Choose a legend and step inside."
          />
          <div style={{ marginTop: 40 }}>
            <TitleRow title="ZUBA Films" items={movies} />
            <TitleRow title="ZUBA Games" items={games} />
          </div>
          <div className="center" style={{ marginTop: 26 }}>
            <Link href="/theatre" className="btn">
              Open the Full Theatre
            </Link>
          </div>
        </div>
      </section>

      {/* ============ ROADMAP PREVIEW ============ */}
      <section className="section">
        <div className="container">
          <Heading runes="Roadmap" title="The Quest Line" lead="Five phases. One destination: Africa on the main stage of global entertainment." />
          <div className="quest-strip">
            {phases.map((p) => (
              <Link href={`/roadmap#phase-${p.n}`} key={p.n} className={`quest-node ${p.status}`}>
                <span className="quest-medal">
                  {p.status === "locked" ? (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  ) : (
                    <span className="t-title sm">0{p.n}</span>
                  )}
                  {p.status === "active" && <Cursor />}
                </span>
                <span className="quest-name">
                  <ZText>{p.name}</ZText>
                </span>
                <span className="quest-state">{p.status === "cleared" ? "Cleared" : p.status === "active" ? "In Progress" : "Locked"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TOKEN ============ */}
      <section className="section" id="token">
        <div className="container">
          <div className="token-panel">
            <div className="token-coin" aria-hidden="true">
              <img src="/brand/zuba-coin.png" alt="" />
            </div>
            <div className="token-info">
              <Runes text="Zuba Token" />
              <h2 className="t-title lg">
                <ZText>$ZUBA</ZText>
              </h2>
              <Divider variant="notched" align="left" />
              <p className="t-lead">
                The key to the village. Copy the contract address below, open your wallet, swap and you&apos;re in. Always check the
                address before you buy.
              </p>
              <CopyCA />
              <div className="hero-actions">
                <Link href="/token" className="btn primary">
                  How to Buy
                </Link>
                <a href={site.socials.x.url} target="_blank" rel="noopener noreferrer" className="btn">
                  Follow {site.socials.x.handle}
                </a>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 70 }}>
            <Heading runes="Listed" title="Where to Find ZUBA" size="md" />
            <ListingGrid items={listings} />
          </div>
        </div>
      </section>

      {/* ============ PARTNERS ============ */}
      <section className="section">
        <div className="container">
          <Heading runes="Allies" title="Allies of the Village" size="md" lead="The studios, platforms and creators walking this road with us." />
          <PartnerGrid items={partners} />
        </div>
      </section>

      {/* ============ DEV NOTES ============ */}
      <section className="section">
        <div className="container">
          <Heading runes="Notebook" title="From the Builders' Notebook" size="md" lead="Straight from the developers: what we shipped and where we're heading." />
          <div className="grid cols-3" style={{ marginTop: 36 }}>
            {notes.map((n) => (
              <Link key={n.slug} href={`/dev-notes/${n.slug}`}>
                <Frame hoverable>
                  <div className="mini-note">
                    <span className="note-stamp">{formatDate(n.date)}</span>
                    <span className="t-label">
                      Phase 0{n.phase} · {n.location}
                    </span>
                    <h3 className="t-title sm">
                      <ZText>{n.title}</ZText>
                    </h3>
                    <p className="t-muted">{n.summary}</p>
                  </div>
                </Frame>
              </Link>
            ))}
          </div>
          <div className="center" style={{ marginTop: 30 }}>
            <Link href="/dev-notes" className="btn">
              Open the Notebook
            </Link>
          </div>
        </div>
      </section>

      {/* ============ COMMUNITY CTA ============ */}
      <section className="section">
        <div className="container">
          <div className="village-cta" style={{ backgroundImage: `url(${media["zuba-campfire"]})` }}>
            <div className="village-veil" />
            <div className="village-copy">
              <Runes text="Ubuntu" />
              <h2 className="t-title lg">
                <ZText>Join the Village</ZText>
              </h2>
              <p className="t-lead">The fire is lit and the griot is ready. Pull up a seat. Every legend needs its people.</p>
              <SocialRow />
              <Link href="/community" className="btn primary">
                Enter the Village
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
