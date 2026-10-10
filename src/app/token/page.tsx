import type { Metadata } from "next";
import Link from "next/link";
import { listings, site, token, trust } from "@/lib/site";
import { media } from "@/content/media";
import { utilities } from "@/content/utilities";
import CopyCA from "@/components/CopyCA";
import Donut, { donutColors } from "@/components/Donut";
import UtilityRing from "@/components/UtilityRing";
import { Icon } from "@/components/Icons";
import { ListingGrid } from "@/components/Listings";
import { Chev, Divider, Runes, ZText } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "The $ZUBA Token",
  description: "The coin that carries a continent's stories: supply, allocation, security, utility and where to find $ZUBA on BNB Chain.",
};

function Chapter({ n, runes, title, line, children, id, art, wide }: { n: string; runes: string; title: string; line: string; children: React.ReactNode; id: string; art?: string; wide?: boolean }) {
  return (
    <section className="tchapter" id={id}>
      <div className={`container tchapter-grid ${wide ? "wide" : ""}`}>
        <header className="tchapter-head">
          <span className="tchapter-n">Chapter {n}</span>
          <Runes text={runes} />
          <h2 className="t-title lg">
            <ZText>{title}</ZText>
          </h2>
          <Divider variant="simple" align="left" />
          <p className="t-lead">{line}</p>
          {art && <img className="tchapter-art" src={art} alt="" aria-hidden="true" />}
        </header>
        <div className="tchapter-body">{children}</div>
      </div>
    </section>
  );
}

const steps = [
  { icon: "wallet", t: "Open your wallet", d: "MetaMask, Trust Wallet or any BNB Chain wallet, funded with a little BNB." },
  { icon: "copy", t: "Check the contract", d: "This is the only real $ZUBA. Compare the last characters: …994A4." },
  { icon: "swap", t: "Swap on PancakeSwap", d: "Tap the button below. $ZUBA is pre-filled; choose an amount of BNB and swap." },
];

export default function TokenPage() {
  return (
    <>
      {/* ---------- item card ---------- */}
      <section className="tcard-wrap">
        <div className="container">
          <div className="tcard rise">
            <div className="tcard-art" aria-hidden="true">
              <span className="tcard-glow" />
              <img src={media["zuba-stand-2d-a"]} alt="" />
            </div>
            <div className="tcard-info">
              <p className="t-label">Legendary item · BEP-20 on BNB Chain</p>
              <h1 className="t-title xl tcard-title">
                <ZText>$ZUBA</ZText>
              </h1>
              <p className="tcard-line">The coin that carries a continent&apos;s stories.</p>
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
                    <a href="#guarded" className="tstats-link">
                      Audited ✓
                    </a>
                  </dd>
                </div>
              </dl>
              <CopyCA />
              <div className="hero-actions">
                <a href={site.links.buy} target="_blank" rel="noopener noreferrer" className="btn primary">
                  <Chev /> Buy on PancakeSwap
                </a>
                <a href={site.links.chart} target="_blank" rel="noopener noreferrer" className="btn">
                  Live Chart
                </a>
              </div>
            </div>
          </div>
          <nav className="tindex" aria-label="On this page">
            {["Forged", "Guarded", "Unlocked", "Join", "Found"].map((w, i) => (
              <a key={w} href={`#${w.toLowerCase()}`}>
                <span>{["I", "II", "III", "IV", "V"][i]}</span> {w}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ---------- I. supply ---------- */}
      <Chapter
        id="forged"
        n="I"
        runes="Forged"
        title="Forged"
        line={`${token.supplyLabel} $ZUBA were minted once. No more can ever be made, and 85% went to the open market at a fair launch.`}
      >
        <div className="tforge">
          <Donut
            slices={token.allocation}
            center={
              <>
                <span className="donut-big">500B</span>
                <span className="donut-small">total supply</span>
              </>
            }
          />
          <ul className="talloc">
            {token.allocation.map((a, i) => (
              <li key={a.label}>
                <span className="talloc-dot" style={{ background: donutColors[i], boxShadow: `0 0 10px ${donutColors[i]}` }} />
                <span className="talloc-pct">{a.pct}%</span>
                <span className="talloc-text">
                  <strong>{a.label}</strong>
                  <span>{a.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Chapter>

      {/* ---------- II. security ---------- */}
      <Chapter id="guarded" n="II" runes="Guarded" title="Guarded" line="Checked by independent security firms, so you don't have to take our word for it.">
        <div className="tseals">
          {trust.map((t) => (
            <a key={t.name} href={t.url} target="_blank" rel="noopener noreferrer" className="tseal">
              <span className="tseal-badge">
                <Icon name={t.name.includes("KYC") ? "id" : "shield"} size={30} />
              </span>
              <span className="tseal-text">
                <strong>{t.name}</strong>
                <span>by {t.by}</span>
              </span>
              <Icon name="external" size={18} className="tseal-ext" />
            </a>
          ))}
        </div>
      </Chapter>

      {/* ---------- III. utility ---------- */}
      <section className="tchapter tchapter-wide" id="unlocked">
        <div className="container">
          <header className="tchapter-head center">
            <span className="tchapter-n">Chapter III</span>
            <Runes text="Unlocked" />
            <h2 className="t-title lg">
              <ZText>What the Coin Unlocks</ZText>
            </h2>
            <Divider variant="notched" />
            <p className="t-lead">One key for the whole ZUBA universe. Most doors are still being built: choose a slot to see what each one opens and where it stands.</p>
          </header>
          <UtilityRing items={utilities} />
        </div>
      </section>

      {/* ---------- IV. how to buy ---------- */}
      <Chapter id="join" n="IV" runes="Join" title="Join the Quest" line="Three steps, about two minutes." art={media["zuba-explorer"]}>
        <ol className="tsteps">
          {steps.map((s, i) => (
            <li key={s.t}>
              <span className="tstep-n">{i + 1}</span>
              <span className="tstep-icon">
                <Icon name={s.icon} size={22} />
              </span>
              <strong>{s.t}</strong>
              <span>{s.d}</span>
              {i === 1 && (
                <span className="tstep-ca">
                  <CopyCA />
                </span>
              )}
            </li>
          ))}
        </ol>
        <a href={site.links.buy} target="_blank" rel="noopener noreferrer" className="btn primary tbuy">
          <Chev /> Buy on PancakeSwap
        </a>
        <p className="tscam">
          <Icon name="shield" size={18} /> The team will never DM you first or ask for your seed phrase. If someone does, it is a scam.
        </p>
      </Chapter>

      {/* ---------- V. listings ---------- */}
      <Chapter wide id="found" n="V" runes="Found" title="Find $ZUBA" line="Trade it, chart it and verify it on the platforms where $ZUBA is live.">
        <ListingGrid items={listings} />
      </Chapter>

      <section className="section">
        <div className="container twp">
          <img src={media["zuba-griot"]} alt="" aria-hidden="true" className="twp-art" />
          <div className="twp-text">
            <Runes text="Whitepaper" />
            <h2 className="t-title md">
              <ZText>The Full Story</ZText>
            </h2>
            <p className="t-muted">Vision, tokenomics, utility and the road ahead, all in the ZUBA whitepaper.</p>
            <div>
              <Link href="/whitepaper" className="btn primary">
                <Icon name="read" size={18} /> Read the Whitepaper
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
