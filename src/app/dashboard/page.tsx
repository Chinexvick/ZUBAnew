import type { Metadata } from "next";
import { Nunito, JetBrains_Mono } from "next/font/google";
import StakeApp from "../stake/StakeApp";
import "../stake/stake.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your ZUBA account: games and staking in one place.",
  robots: { index: false, follow: false },
};

const display = Nunito({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-stk-num" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-stk-mono" });

export default function DashboardPage() {
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <StakeApp start="hub" />
    </div>
  );
}
