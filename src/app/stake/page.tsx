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

export default function StakePage() {
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <StakeApp start="staking" />
    </div>
  );
}
