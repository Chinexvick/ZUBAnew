import Link from "next/link";
import { media } from "@/content/media";
import { art } from "@/content/art";
import { allTitles, games, movies } from "@/content/theatre";
import { phases } from "@/content/roadmap";
import { partners, site, token } from "@/lib/site";
import CopyCA from "@/components/CopyCA";
import TitleRow from "@/components/TitleRow";
import { PartnerMarquee } from "@/components/Listings";
import { SocialRow } from "@/components/Social";
import { Icon } from "@/components/Icons";
import { Chev, Cursor, Divider, Heading, Runes, ZText } from "@/components/ui/Glyphs";

const worlds = [
  { href: "/theatre#films", label: "Watch", title: "Animated Legends", line: "Gods, tricksters and heroes, drawn by African hands.", img: () => movies[1]?.poster },
  { href: "/theatre#games", label: "Play", title: "African Games", line: "Myths you don't just hear. You play them.", img: () => games[0]?.poster },
  { href: "/community", label: "Own", title: "A Village That Owns It", line: "Holders build, vote and grow the universe.", img: () => media["zuba-explorer"] },
];

export default function Home() {
  const flagship = games.find((g) => g.slug === "zuba-rise-of-the-ancestors") ?? games[0];
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="h-hero">
        <div className="h-hero-bg" style={{ backgroundImage: `url(${art("world-hero")})` }} aria-hidden="true" />
        <div className="h-hero-veil" aria-hidden="true" />
        <div className="container h-hero-grid">
          <div className="h-hero-copy">
            <p className="t-label rise">Gaming &amp; Animation · BNB Chain</p>
            <h1 className="t-title xl h-hero-title rise rise-2">
              <ZText>ZUBA</ZText>
            </h1>
            <p className="h-hero-tag rise rise-2">
              <ZText>{site.tagline}</ZText>
            </p>
            <p className="h-hero-line rise rise-3">African myths and heroes, built into games and animation the whole world can play.</p>
            <div className="h-hero-ca rise rise-3">
              <CopyCA />
            </div>
            <div className="hero-actions rise rise-4">
              <Link href="/whitepaper" className="btn primary">
                <Icon name="read" size={18} /> Read Whitepaper
              </Link>
              <Link href="/theatre" className="btn">
                Enter the Theatre
              </Link>
            </div>
            <Link href="/token#guarded" className="h-trust rise rise-4">
              <span>
                <Icon name="shield" size={15} /> Audited
              </span>
              <span>
                <Icon name="id" size={15} /> KYC verified
              </span>
              <span>{token.supplyShort} supply</span>
            </Link>
          </div>

          <div className="h-hero-art" aria-hidden="true">
            <svg className="h-hero-delta" viewBox="0 0 400 380">
              <path d="M60 268 L200 30 L340 268 Z" />
              <path d="M20 340 H380" />
            </svg>
            <div className="h-hero-glow" />
            <img className="h-hero-zuba" src={media["zuba-stand-2d-b"]} alt="" />
          </div>
        </div>
        <a href="#worlds" className="h-scroll" aria-label="Scroll to explore">
          <span />
        </a>
      </section>

      {/* ============ WORLDS ============ */}
      <section className="section" id="worlds">
        <div className="container">
          <Heading runes="Universe" title="One Universe, Three Doors" lead="Everything ZUBA makes lives in one shared world." />
          <div className="h-worlds">
            {worlds.map((w) => (
              <Link key={w.href} href={w.href} className="h-world">
                <span className="h-world-img" style={{ backgroundImage: `url(${w.img()})` }} />
                <span className="h-world-shade" />
                <span className="h-world-text">
                  <span className="t-label">{w.label}</span>
                  <span className="t-title md">
                    <ZText>{w.title}</ZText>
                  </span>
                  <span className="h-world-line">{w.line}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ NOW SHOWING ============ */}
      <section className="section">
        <div className="container">
          <div className="h-row-head">
            <Heading runes="Theatre" title="Now Showing" size="md" align="left" divider={false} />
            <Link href="/theatre" className="prompt">
              See all <Chev />
            </Link>
          </div>
          <TitleRow title="Films & Games" items={allTitles} hideHead />
        </div>
      </section>

      {/* ============ IN PRODUCTION ============ */}
      <section className="section">
        <div className="container">
          <Link href={`/theatre/games/${flagship.slug}`} className="h-forge">
            <span className="h-forge-art" style={{ backgroundImage: `url(${flagship.backdrop})` }} />
            <span className="h-forge-text">
              <Runes text="Forge" />
              <span className="t-label">In the Forge · Our flagship game</span>
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
              <span className="prompt">
                <span className="keycap round">A</span> Explore the game
              </span>
            </span>
          </Link>
        </div>
      </section>

      {/* ============ TOKEN ============ */}
      <section className="section">
        <div className="container">
          <div className="h-token">
            <img src="/brand/zuba-coin.png" alt="" className="h-token-coin" />
            <div className="h-token-text">
              <Runes text="Zuba" />
              <h2 className="t-title lg">
                <ZText>$ZUBA</ZText>
              </h2>
              <p className="t-lead">One coin for the whole universe: films, stories, games, collectibles, events and more.</p>
              <dl className="tstats">
                <div>
                  <dt>Supply</dt>
                  <dd>{token.supplyShort}</dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>BNB</dd>
                </div>
                <div>
                  <dt>Liquidity</dt>
                  <dd>{token.allocation[0].pct}%</dd>
                </div>
              </dl>
              <div className="hero-actions">
                <Link href="/token" className="btn primary">
                  Explore the Token
                </Link>
                <a href={site.links.chart} target="_blank" rel="noopener noreferrer" className="btn">
                  Live Chart
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ QUEST LINE ============ */}
      <section className="section">
        <div className="container">
          <Heading runes="Roadmap" title="The Quest Line" size="md" lead="Five phases from first spark to the world stage." />
          <div className="quest-strip">
            {phases.map((p) => (
              <Link href={`/roadmap#phase-${p.n}`} key={p.n} className={`quest-node ${p.status}`}>
                <span className="quest-medal">
                  {p.status === "locked" ? <Icon name="lock" size={22} /> : <span className="t-title sm">0{p.n}</span>}
                  {p.status === "active" && <Cursor />}
                </span>
                <span className="quest-name">
                  <ZText>{p.name}</ZText>
                </span>
                <span className="quest-state">{p.status === "cleared" ? "Cleared" : p.status === "active" ? "In progress" : "Locked"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PARTNERS ============ */}
      <section className="section h-partners">
        <div className="container">
          <Heading runes="Allies" title="Allies of the Village" size="md" />
        </div>
        <PartnerMarquee items={partners} />
      </section>

      {/* ============ JOIN ============ */}
      <section className="section">
        <div className="container">
          <div className="h-join">
            <div className="h-join-copy">
              <Runes text="Ubuntu" />
              <h2 className="t-title lg">
                <ZText>Join the Village</ZText>
              </h2>
              <Divider variant="simple" align="left" />
              <p className="t-lead">The fire is lit. Every legend needs its people.</p>
              <SocialRow />
            </div>
            <img src={media["zuba-explorer"]} alt="" className="h-join-zuba" />
          </div>
        </div>
      </section>
    </>
  );
}
