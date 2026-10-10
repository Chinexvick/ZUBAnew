import type { Metadata } from "next";
import { whitepaper } from "@/content/whitepaper";
import { media } from "@/content/media";
import Codex from "@/components/Codex";
import { Cormorant_Garamond } from "next/font/google";

const book = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-book" });

export const metadata: Metadata = {
  title: "Whitepaper",
  description: whitepaper.abstract,
};

export default function WhitepaperPage() {
  return (
    <div className={`codex-shell ${book.variable}`} style={{ ["--parchment" as string]: media["parchment"] ? `url(${media["parchment"]})` : "none" }}>
      <div className="codex-desk" aria-hidden="true" />
      <div className="container">
        <Codex wp={whitepaper} griot={media["zuba-griot"]} />
      </div>
    </div>
  );
}
