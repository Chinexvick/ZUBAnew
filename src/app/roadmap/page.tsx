import type { Metadata } from "next";
import Link from "next/link";
import { phases } from "@/content/roadmap";
import { art } from "@/content/art";
import { media } from "@/content/media";
import SkillTree from "@/components/SkillTree";
import { Heading } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Five phases from The Awakening to Africa to the World.",
};

export default function Roadmap() {
  const cleared = phases.filter((p) => p.status === "cleared").length;
  const panelArt = [art("anansi-backdrop"), art("sundiata-backdrop"), art("zuba-game-backdrop"), art("impundulu-backdrop"), art("world-hero")];
  return (
    <>
      <section className="a-hero r-hero">
        <div className="container a-hero-grid">
          <Heading
            as="h1"
            runes="Roadmap"
            title="The Quest Line"
            size="xl"
            align="left"
            lead={
              <>
                Five phases stand between us and the main stage.{" "}
                <span className="hl">
                  {cleared} of {phases.length} cleared.
                </span>
              </>
            }
          />
          <img className="a-hero-zuba" src={media["zuba-fire"]} alt="ZUBA as a fire guardian in crimson and gold armour, holding a flame" />
        </div>
      </section>
      <div className="container" style={{ paddingBottom: 100 }}>
        <SkillTree phases={phases} art={panelArt} />
        <div className="center" style={{ marginTop: 60 }}>
          <p className="t-muted">Want the day-to-day progress behind each phase?</p>
          <Link href="/dev-notes" className="btn primary">
            Open the Dev Notes
          </Link>
        </div>
      </div>
    </>
  );
}
