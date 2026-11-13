import type { Metadata } from "next";
import { Nunito, JetBrains_Mono } from "next/font/google";
import StakeApp from "./StakeApp";
import "./stake.css";

export const metadata: Metadata = {
  title: "Staking",
  description: "Stake $ZUBA and earn $ZUBA.",
  robots: { index: false, follow: false },
};

const display = Nunito({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-stk-num" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-stk-mono" });

export default async function StakePage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const embed = (await searchParams).embed === "1"; // shown inside the ZUBA app as its Stake tab
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <StakeApp embedded={embed} />
    </div>
  );
}
