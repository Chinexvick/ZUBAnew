import type { Metadata } from "next";
import { Unbounded, JetBrains_Mono } from "next/font/google";
import StakeApp from "./StakeApp";
import "./stake.css";

export const metadata: Metadata = {
  title: "Staking",
  description: "Stake $ZUBA and earn $ZUBA.",
  robots: { index: false, follow: false },
};

const display = Unbounded({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-stk-num" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-stk-mono" });

export default function StakePage() {
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <StakeApp />
    </div>
  );
}
