import type { Metadata } from "next";
import Link from "next/link";
import { phases } from "@/content/roadmap";
import { art } from "@/content/art";
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
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${art("world-hero")})` }} aria-hidden="true" />
        <div className="container">
          <Heading
            as="h1"
            runes="Roadmap"
            title="The Quest Line"
            size="xl"
            lead={
              <>
                Every great journey is mapped before it is walked. Five phases stand between us and the main stage.{" "}
                <span className="hl">
                  {cleared} of {phases.length} cleared.
                </span>
              </>
            }
          />
        </div>
      </section>
      <div className="container" style={{ paddingBottom: 100 }}>
        <SkillTree phases={phases} art={panelArt} />
        <div className="center" style={{ marginTop: 60 }}>
          <p className="t-muted">Want the day-to-day progress behind each phase?</p>
          <Link href="/dev-notes" className="btn primary">
            Read the Developer Notebook
          </Link>
        </div>
      </div>
    </>
  );
}
