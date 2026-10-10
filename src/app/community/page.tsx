import type { Metadata } from "next";
import { art } from "@/content/art";
import { socialLinks } from "@/components/Social";
import CopyCA from "@/components/CopyCA";
import { site } from "@/lib/site";
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
  { r: "Griot", t: "Griots", d: "Storytellers, writers and meme lords who spread the legend.", cta: "Spread the word on X", href: site.socials.x.url },
  { r: "Smith", t: "Smiths", d: "Artists, animators and developers who forge new worlds.", cta: "Read the Dev Notes", href: "/dev-notes" },
  { r: "Warrior", t: "Warriors", d: "Raiders and defenders who carry the flag across every timeline.", cta: "Join the Telegram", href: site.socials.telegram.url },
  { r: "Elder", t: "Elders", d: "Long-term holders whose patience keeps the fire burning.", cta: "See the token", href: "/token" },
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
                <Frame hoverable={!!url}>
                  <div className="social-card">
                    <span className="medal">
                      <Icon />
                    </span>
                    <h2 className="t-title md">
                      <ZText>{key === "x" ? "X (Twitter)" : label}</ZText>
                    </h2>
                    <span className="hl">{key === "telegram" ? "t.me/zubacommunitychat" : key === "whatsapp" ? "Village group chat" : handle}</span>
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
          <Heading runes="Roles" title="Find Your Role" lead="Every village needs all kinds of heroes. Pick yours and find your fire." />
          <div className="values" style={{ marginTop: 40 }}>
            {roles.map((v) => (
              <a key={v.t} href={v.href} {...(v.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                <Frame hoverable>
                  <div className="stack">
                    <Runes text={v.r} />
                    <h3 className="t-title sm">
                      <ZText>{v.t}</ZText>
                    </h3>
                    <p className="t-muted">{v.d}</p>
                    <span className="prompt">{v.cta} →</span>
                  </div>
                </Frame>
              </a>
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
            Always check the full address before you swap.{" "}
            <a href={site.links.bscscan} target="_blank" rel="noopener noreferrer" className="hl">
              Verify on BscScan ↗
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
