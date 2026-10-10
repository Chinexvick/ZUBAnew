import type { Metadata } from "next";
import { listings, partners, site } from "@/lib/site";
import { media } from "@/content/media";
import CopyCA from "@/components/CopyCA";
import { ListingGrid, PartnerGrid } from "@/components/Listings";
import { Divider, Frame, Heading, Runes, ZText } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "Token",
  description: "The $ZUBA contract address, how to buy, where it's listed and our partners.",
};

const steps = [
  { t: "Ready Your Wallet", d: "Install a trusted wallet such as MetaMask or Trust Wallet and keep your seed phrase offline. Never share it." },
  { t: "Load Your Pouch", d: "Fund the wallet with the network's native coin from an exchange or another wallet to pay for the swap and gas." },
  { t: "Copy the Contract", d: "Copy the official ZUBA contract address from this page. Paste it into the swap so you get the real token." },
  { t: "Swap & Join", d: "Swap for $ZUBA, add the token to your wallet using the same address, then come and say hello in the village." },
];

export default function Token() {
  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${media["oware-backdrop"]})` }} aria-hidden="true" />
        <div className="container">
          <div className="token-panel">
            <div className="token-coin" aria-hidden="true">
              <img src="/brand/zuba-coin.png" alt="" />
            </div>
            <div className="token-info">
              <Runes text="Zuba Token" />
              <h1 className="t-title xl">
                <ZText>$ZUBA</ZText>
              </h1>
              <Divider variant="notched" align="left" />
              <p className="t-lead">
                The key to the village. Hold it, and you hold a piece of the story Africa is about to tell the world.
              </p>
              <CopyCA />
              <p className="t-muted" style={{ fontSize: "0.9rem", margin: 0 }}>
                Official X: <a href={site.socials.x.url} target="_blank" rel="noopener noreferrer" className="hl">{site.socials.x.handle}</a>. Only
                trust addresses posted here or on our official channels.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <Heading runes="How to buy" title="How to Join the Quest" lead="Four steps from zero to holder." />
          <div className="steps" style={{ marginTop: 40 }}>
            {steps.map((s, i) => (
              <Frame key={s.t} hoverable>
                <div className="step">
                  <span className="medal">{i + 1}</span>
                  <h3 className="t-title sm">
                    <ZText>{s.t}</ZText>
                  </h3>
                  <p className="t-muted" style={{ margin: 0 }}>
                    {s.d}
                  </p>
                </div>
              </Frame>
            ))}
          </div>
          <p className="warning" style={{ marginTop: 30 }}>
            ⚠ Scam guard: the ZUBA team will never DM you first, ask for your seed phrase or ask you to send tokens. If in doubt, check
            the address on this page.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Heading runes="Listed" title="Where ZUBA Is Listed" lead="Trackers and exchanges where you can find $ZUBA. New listings light up as they go live." />
          <ListingGrid items={listings} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Heading runes="Allies" title="Partners" lead="Studios, platforms and creators building alongside the village." />
          <PartnerGrid items={partners} />
          <p className="center t-muted" style={{ marginTop: 26 }}>
            Want to partner with ZUBA? Reach us on X at{" "}
            <a href={site.socials.x.url} target="_blank" rel="noopener noreferrer" className="hl">
              {site.socials.x.handle}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
