import type { Metadata } from "next";
import Link from "next/link";
import { media } from "@/content/media";
import Shards from "@/components/Shards";
import { Divider, Frame, Heading, Runes, ZText } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "About",
  description: "ZUBA is a gaming and animation token telling the world that Africa belongs on the global stage of anime and games.",
};

const values = [
  { r: "Ubuntu", t: "Ubuntu", d: "I am because we are. ZUBA is community-first: the village builds, the village decides, the village wins." },
  { r: "Sankofa", t: "Sankofa", d: "Go back and fetch it. We dig into the past to find the stories the world forgot, and bring them forward." },
  { r: "Craft", t: "Craft", d: "No cheap knock-offs. African stories deserve world-class art, animation and gameplay." },
  { r: "Open", t: "Open Trail", d: "We build in public. Every step is logged in the Developer Notebook for anyone to read." },
];

export default function About() {
  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${media["world-hero"]})` }} aria-hidden="true" />
        <div className="container">
          <Heading
            as="h1"
            runes="About"
            title="The Legend of ZUBA"
            size="xl"
            lead="A gaming and animation token with one story to tell: Africa has a place in the global world of anime and games, and we're here to claim it."
          />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 30 }}>
        <div className="container split">
          <div className="stack">
            <Runes text="Origin" />
            <h2 className="t-title lg">
              <ZText>The Origin Story</ZText>
            </h2>
            <Divider variant="notched" align="left" />
            <p className="t-lead">
              Every great franchise starts with a myth. Ours starts with a small white pup and a gold coin.
            </p>
            <p>
              They say that when the elders finished telling a story, the last echo of it fell into a coin of gold. Over a thousand
              years the coin filled with every legend the continent ever told: tricksters and sky gods, river queens, lion kings and the
              heroes who fought for a free Africa.
            </p>
            <p>
              Then the world stopped listening. African stories were left out of the cartoons, the consoles and the cinemas. The coin
              grew quiet.
            </p>
            <p>
              <span className="hl">ZUBA</span> is the pup who heard it hum again. Dressed in the purple and gold of royalty, he carries
              the coin back to the world, and everyone who holds $ZUBA holds a piece of that story.
            </p>
            <p className="t-lore">In Kinyarwanda and Kirundi, izuba means &ldquo;the sun.&rdquo; Every morning it rises over Africa first.</p>
          </div>
          <Shards src={media["zuba-campfire"]} alt="ZUBA sitting by a campfire with an old griot as story spirits rise from the flames" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Heading runes="Mission" title="The Mission" lead="Three quests, one destination." />
          <div className="grid cols-3" style={{ marginTop: 40 }}>
            {[
              ["Games", "Build and back original games rooted in African myth, history and modern life, playable by the whole world."],
              ["Animation", "Bring African legends to screens worldwide with animation that matches the best studios on Earth."],
              ["Ownership", "Let the community that believes in these stories hold a real stake in where they go next."],
            ].map(([t, d], i) => (
              <Frame key={t} hoverable>
                <div className="pillar">
                  <span className="pillar-num">0{i + 1}</span>
                  <h3 className="t-title md">
                    <ZText>{t}</ZText>
                  </h3>
                  <Divider variant="simple" align="left" />
                  <p className="t-muted">{d}</p>
                </div>
              </Frame>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <Shards src={media["zuba-game-backdrop"]} alt="Floating ancient African kingdom with stone ancestor masks" />
          <div className="stack">
            <Runes text="Why now" />
            <h2 className="t-title lg">
              <ZText>Why Africa, Why Now</ZText>
            </h2>
            <Divider variant="notched" align="left" />
            <p>
              Africa is the youngest continent on Earth. Hundreds of millions of gamers, artists and dreamers are coming of age with a
              phone in their hand and a story in their blood.
            </p>
            <p>
              The world is finally hungry for new myths. Anime proved that culture travels when it&apos;s told with pride and
              craft. Africa&apos;s turn is here.
            </p>
            <p className="t-lead" style={{ color: "#fff" }}>
              We were never the side quest. <span className="hl">We are the main story.</span>
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Heading runes="Code" title="The Village Code" lead="The values every ZUBA holder carries." />
          <div className="values" style={{ marginTop: 40 }}>
            {values.map((v) => (
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
          <div className="center" style={{ marginTop: 50 }}>
            <Link href="/roadmap" className="btn primary">
              See the Quest Line
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
