import { redirect } from "next/navigation";

// The dashboard is the ZUBA app itself: games, earnings, leaderboard and staking in one place.
export default function DashboardPage() {
  redirect("/play");
}
