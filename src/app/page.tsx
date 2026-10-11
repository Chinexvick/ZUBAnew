import Link from "next/link";
import { media } from "@/content/media";
import { art } from "@/content/art";
import { allTitles, games } from "@/content/theatre";
import { phases } from "@/content/roadmap";
import { listings, partners, site, token } from "@/lib/site";
import CopyCA from "@/components/CopyCA";
import TitleRow from "@/components/TitleRow";
import { ListingMarquee, PartnerRows } from "@/components/Listings";
import { Icon } from "@/components/Icons";
import { Chev, Cursor, Divider, Heading, Runes, ZText } from "@/components/ui/Glyphs";

const worlds = [
  { href: "/theatre#films", label: "Watch", title: "Animated Legends", line: "Gods, tricksters and heroes, drawn by African hands.", img: () => art("sundiata-still-2") },
  { href: "/theatre#games", label: "Play", title: "African Games", line: "Myths you don't just hear. You play them.", img: () => art("impundulu-still-1") },
  { href: "/community", label: "Own", title: "Owned by Holders", line: "The village backs, shapes and grows the universe.", img: () => art("anansi-still-2") },
];

export default function Home() {
  const flagship = games.find((g) => g.slug === "zuba") ?? games[0];
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="h-hero hv">
        <video className="hv-video" autoPlay muted loop playsInline preload="auto" poster="/video/hero-poster.jpg" aria-hidden="true">
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>
        <div className="hv-tone" aria-hidden="true" />
        <div className="container hv-inner">
          <div className="hv-copy">
            <p className="t-label rise">Gaming &amp; Animation · BNB Chain</p>
            <h1 className="t-title xl hv-title rise rise-2">
              <ZText>ZUBA</ZText>
            </h1>
            <p className="hv-line rise rise-2">African myths and heroes, built into games and animation the whole world can play.</p>
            <div className="hv-ca rise rise-3">
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
            <Heading runes="Theatre" title="Coming to the Theatre" size="md" align="left" divider={false} />
            <Link href="/theatre" className="prompt">
              See all titles <Chev />
            </Link>
          </div>
          <TitleRow title="Films & Games" items={allTitles.filter((t) => t.slug !== flagship.slug)} hideHead />
        </div>
      </section>

      {/* ============ IN PRODUCTION ============ */}
      <section className="section">
        <div className="container">
          <Link href={`/theatre/games/${flagship.slug}`} className="h-forge">
            <span className="h-forge-art" style={{ backgroundImage: `url(${flagship.backdrop})` }} />
            <span className="h-forge-text">
              <Runes text="Forge" />
              <span className="t-label">Our flagship game</span>
              <span className="t-title lg">
                <ZText>{flagship.title.split(":")[0]}</ZText>
              </span>
              {flagship.title.includes(":") && (
                <span className="h-forge-sub">
                  <ZText>{flagship.title.split(":")[1].trim()}</ZText>
                </span>
              )}
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
                  <dt>Fair launch</dt>
                  <dd>{token.allocation[0].pct}%</dd>
                </div>
                <div>
                  <dt>Security</dt>
                  <dd>
                    <Link href="/token#guarded" className="tstats-link">
                      Audited ✓
                    </Link>
                  </dd>
                </div>
              </dl>
              <div className="hero-actions">
                <a href={site.links.buy} target="_blank" rel="noopener noreferrer" className="btn primary">
                  <Chev /> Buy $ZUBA
                </a>
                <Link href="/token" className="btn">
                  Explore the Token
                </Link>
              </div>
              <a href={site.links.chart} target="_blank" rel="noopener noreferrer" className="prompt h-chart-link">
                <Icon name="chart" size={16} /> Live chart on DEX Screener ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ QUEST LINE ============ */}
      <section className="section">
        <div className="container">
          <div className="h-row-head">
            <Heading runes="Roadmap" title="The Quest Line" size="md" align="left" divider={false} lead="Five phases from first spark to the world stage." />
            <Link href="/roadmap" className="prompt">
              Full roadmap <Chev />
            </Link>
          </div>
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
                <span className="quest-quest">{p.quest}</span>
                <span className="quest-state">{p.status === "cleared" ? "Cleared" : p.status === "active" ? "In progress" : "Locked"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PARTNERS ============ */}
      <section className="section h-partners" id="allies">
        <div className="container">
          <Heading runes="Allies" title="Allies of the Village" size="md" lead="Projects and communities building alongside ZUBA." />
          <PartnerRows items={partners} />
        </div>
      </section>

      {/* ============ LISTINGS ============ */}
      <section className="section h-listings">
        <div className="container">
          <Heading runes="Markets" title="Find ZUBA On" size="md" lead="Trade, track and verify $ZUBA across the platforms that list it." />
        </div>
        <ListingMarquee items={listings} />
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
              <div className="hero-actions">
                <a href={site.socials.telegram.url} target="_blank" rel="noopener noreferrer" className="btn primary">
                  Join the Telegram
                </a>
                <a href={site.socials.x.url} target="_blank" rel="noopener noreferrer" className="btn">
                  Follow on X
                </a>
                <a href={site.socials.whatsapp.url} target="_blank" rel="noopener noreferrer" className="btn">
                  WhatsApp
                </a>
              </div>
            </div>
            <img src={media["zuba-explorer"]} alt="" className="h-join-zuba" />
          </div>
        </div>
      </section>
    </>
  );
}
