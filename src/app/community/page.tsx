import type { Metadata } from "next";
import Link from "next/link";
import { art } from "@/content/art";
import { socialLinks } from "@/components/Social";
import CopyCA from "@/components/CopyCA";
import { Divider, Frame, Heading, Runes, ZText } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "Community",
  description: "Join the ZUBA village on X, Telegram and WhatsApp.",
};

const blurbs: Record<string, string> = {
  x: "Announcements, memes, art drops and raids. The village square.",
  telegram: "The war room. Chat with holders and builders in real time.",
  whatsapp: "Community updates straight to your phone. The talking drum.",
};

const roles = [
  { r: "Griot", t: "Griots", d: "Storytellers, writers and meme lords who spread the legend." },
  { r: "Smith", t: "Smiths", d: "Artists, animators and developers who forge new worlds." },
  { r: "Warrior", t: "Warriors", d: "Raiders and defenders who carry the flag across every timeline." },
  { r: "Elder", t: "Elders", d: "Long-term holders whose patience keeps the fire burning." },
];

export default function Community() {
  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${art("anansi-still-2")})`, opacity: 0.6 }} aria-hidden="true" />
        <div className="container">
          <Heading
            as="h1"
            runes="Ubuntu"
            title="Join the Village"
            size="xl"
            lead="ZUBA is community-driven to its core. No one builds a legend alone. Pick your fire and pull up a seat."
          />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <div className="grid cols-3">
            {socialLinks.map(({ key, label, handle, url, Icon }) => {
              const card = (
                <Frame hoverable={!!url} active={key === "x"}>
                  <div className="social-card">
                    <span className="medal">
                      <Icon />
                    </span>
                    <h2 className="t-title md">
                      <ZText>{label}</ZText>
                    </h2>
                    <span className="hl">{handle}</span>
                    <Divider variant="simple" />
                    <p className="t-muted" style={{ margin: 0 }}>
                      {blurbs[key]}
                    </p>
                    <span className={url ? "btn primary" : "btn"} style={url ? undefined : { opacity: 0.6 }}>
                      {url ? "Enter" : "Link coming soon"}
                    </span>
                  </div>
                </Frame>
              );
              return url ? (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer">
                  {card}
                </a>
              ) : (
                <div key={key}>{card}</div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Heading runes="Roles" title="Find Your Role" lead="Every village needs all kinds of heroes. Which one are you?" />
          <div className="values" style={{ marginTop: 40 }}>
            {roles.map((v) => (
              <Frame key={v.t} hoverable>
                <div className="stack">
                  <Runes text={v.r} />
                  <h3 className="t-title sm">
                    <ZText>{v.t}</ZText>
                  </h3>
                  <p className="t-muted">{v.d}</p>
                </div>
              </Frame>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container center stack" style={{ maxWidth: 720 }}>
          <Runes text="Contract" />
          <h2 className="t-title lg">
            <ZText>Carry the Coin</ZText>
          </h2>
          <Divider variant="notched" />
          <CopyCA />
          <p className="t-muted">
            Read the <Link href="/dev-notes" className="hl">Developer Notebook</Link> to see what the builders are working on right now.
          </p>
        </div>
      </section>
    </>
  );
}
