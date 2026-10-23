import Link from "next/link";
import { media } from "@/content/media";
import { art } from "@/content/art";
import { allTitles } from "@/content/theatre";
import ArcadeBanner from "@/components/ArcadeBanner";
import { phases } from "@/content/roadmap";
import { listings, partners, site, token } from "@/lib/site";
import CopyCA from "@/components/CopyCA";
import TitleRow from "@/components/TitleRow";
import { ListingMarquee, PartnerRows } from "@/components/Listings";
import { Icon } from "@/components/Icons";
import { Chev, Cursor, Divider, Heading, Runes, ZText } from "@/components/ui/Glyphs";

const homeFaq = [
  { q: "What is ZUBA?", a: "ZUBA is a gaming and animation token on BNB Smart Chain. It powers an African universe of games, anime, films and stories, starting with ZUBA Arcade: five African games you can play free in your browser at zubatoken.com/play." },
  { q: "How do I buy $ZUBA?", a: "Open a BNB Chain wallet such as MetaMask or Trust Wallet, add a little BNB, then swap for $ZUBA on PancakeSwap using the Buy button on this site. Always check the contract address first." },
  { q: "What is the official contract address?", a: `${site.contractAddress} on BNB Smart Chain (BEP-20). This is the only real $ZUBA; compare the last characters …994A4 before you trade.` },
  { q: "What is the total supply?", a: `${token.supplyLabel} $ZUBA. 85% went to liquidity and a fair launch, 10% to marketing and 5% to development.` },
  { q: "Is ZUBA audited and KYC verified?", a: "Yes. The contract was audited by VBS Labs and the team completed KYC with Vital Block Security. Both reports are linked on the Token page." },
  { q: "What can I do with $ZUBA?", a: "Use it across the ZUBA universe: early access and items in our games, premieres and stories, collectibles, events and competitions, and our African language app as they launch." },
  { q: "Where can I follow progress?", a: "The Dev Notes map is updated by the builders as work ships. Subscribe there to get every new note by email, and join us on Telegram and X." },
  { q: "How can my project partner with ZUBA?", a: "Visit Partner With Us. Studios, game projects, marketers, testers, creators, developers and animators each have their own application." },
];

const worlds = [
  { href: "/theatre#films", label: "Watch", title: "Animated Legends", line: "Gods, tricksters and heroes, drawn by African hands.", img: () => art("sundiata-still-2") },
  { href: "/theatre#games", label: "Play", title: "African Games", line: "Five games, free in your browser. Play them now.", img: () => "/media/games/arcade-banner.webp" },
  { href: "/community", label: "Own", title: "Owned by Holders", line: "The village backs, shapes and grows the universe.", img: () => art("anansi-still-2") },
];

export default function Home() {
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
          <TitleRow title="Films & Games" items={allTitles} hideHead />
        </div>
      </section>

      {/* ============ IN PRODUCTION ============ */}
      <section className="section">
        <div className="container">
          <ArcadeBanner />
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
      {/* ============ FAQ ============ */}
      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <Heading runes="Questions" title="Questions" size="md" lead="Everything new travellers ask before joining the village." />
          <div className="pw-faq">
            {homeFaq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
