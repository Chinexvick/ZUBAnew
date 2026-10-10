import type { Metadata } from "next";
import Link from "next/link";
import { media } from "@/content/media";
import { art } from "@/content/art";
import { Icon } from "@/components/Icons";
import { Divider, Heading, Runes, ZText } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "About",
  description: "ZUBA was created from the heart of African imagination: a gaming and animation universe where African culture meets future technology.",
};

const building = [
  { icon: "play", t: "Story-driven games" },
  { icon: "shield", t: "Action-packed battle mechanics" },
  { icon: "watch", t: "Animated films and series" },
  { icon: "id", t: "African characters and creatures" },
  { icon: "map", t: "Digital worlds to explore" },
  { icon: "brush", t: "Community-driven creative studios" },
];

export default function About() {
  return (
    <>
      <section className="a-hero">
        <div className="container a-hero-grid">
          <div className="a-hero-copy">
            <Runes text="Who we are" />
            <h1 className="t-title xl">
              <ZText>Who We Are</ZText>
            </h1>
            <Divider variant="notched" align="left" />
            <p className="t-lead">
              ZUBA was created from the heart of African imagination: a place where stories are not just told, but felt, seen and played.
            </p>
          </div>
          <img className="a-hero-zuba" src={media["zuba-griot"]} alt="ZUBA the white pup in a violet griot robe, holding a glowing storybook" />
        </div>
      </section>

      <section className="section a-origin">
        <div className="container a-narrow">
          <p className="a-big">
            We grew up on games, cartoons and animated legends that never looked like us, never sounded like us, and never carried our
            worlds.
          </p>
          <p className="t-lead">
            But Africa has always been full of heroes, monsters, gods, warriors, spirits and stories powerful enough to shake the world.
          </p>
          <p className="t-lead">
            So we built <span className="hl">ZUBA</span>: a gaming and animation universe where African culture meets future technology.
            Playable worlds, cinematic characters and animated legends inspired by real myths, real cities and real history.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container a-mv">
          <div className="a-mv-card">
            <Runes text="Mission" />
            <h2 className="t-title md">
              <ZText>Our Mission</ZText>
            </h2>
            <p>
              To build world-class African-inspired games and animated universes that inspire, entertain, and give creatives and players
              real ownership in the worlds they help grow.
            </p>
          </div>
          <div className="a-mv-card">
            <Runes text="Vision" />
            <h2 className="t-title md">
              <ZText>Our Vision</ZText>
            </h2>
            <p>
              To become the leading blockchain-powered gaming and animation studio emerging from Africa, creating global franchises that
              stand alongside the biggest names in entertainment.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Heading runes="Forge" title="What We Are Building" size="md" />
          <ul className="a-build">
            {building.map((b) => (
              <li key={b.t}>
                <span className="a-build-icon">
                  <Icon name={b.icon} size={24} />
                </span>
                {b.t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section a-why-band" style={{ backgroundImage: `url(${art("sundiata-still-1")})` }}>
        <div className="container a-why">
          <Runes text="Why Zuba" />
          <h2 className="t-title md">
            <ZText>Why ZUBA Exists</ZText>
          </h2>
          <ul>
            <li>
              Because African stories deserve <span className="hl">global screens</span>.
            </li>
            <li>
              Because African heroes deserve <span className="hl">global gameplay</span>.
            </li>
            <li>
              Because African imagination deserves <span className="hl">powerful engines</span>.
            </li>
          </ul>
        </div>
      </section>

      <section className="section a-manifesto">
        <div className="container center">
          <p className="a-not">Not a meme. Not a pump. Not a trend.</p>
          <p className="t-title xl a-world">
            <ZText>A World. A Story.</ZText>
          </p>
          <div className="hero-actions" style={{ justifyContent: "center", marginTop: 30 }}>
            <Link href="/whitepaper" className="btn primary">
              <Icon name="read" size={18} /> Read the Whitepaper
            </Link>
            <Link href="/theatre" className="btn">
              Enter the Theatre
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
