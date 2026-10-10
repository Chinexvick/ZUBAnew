// Central site configuration. Edit links, listings and partners here.

export const site = {
  name: "ZUBA",
  tagline: "The Motherland Has Entered the Game",
  description:
    "ZUBA is the gaming and animation token carrying Africa's stories onto the world stage of anime and games. Community-driven. Story-first. Rooted in the Motherland.",
  contractAddress: "0xE1bf97baCF682AE17cA3E239aB68a7b525f994A4",
  socials: {
    x: { label: "X", handle: "@zubatoken", url: "https://x.com/zubatoken" },
    // Paste the real invite links here when they are ready.
    telegram: { label: "Telegram", handle: "ZUBA Village", url: "" },
    whatsapp: { label: "WhatsApp", handle: "ZUBA Community", url: "" },
  },
};

export type Listing = {
  name: string;
  kind: "DEX" | "Tracker" | "CEX";
  url: string;
  status: "live" | "soon";
};

// Where the token is listed. Set status to "live" and add the url once each listing is real.
export const listings: Listing[] = [
  { name: "DEX Screener", kind: "Tracker", url: "", status: "soon" },
  { name: "DEXTools", kind: "Tracker", url: "", status: "soon" },
  { name: "CoinGecko", kind: "Tracker", url: "", status: "soon" },
  { name: "CoinMarketCap", kind: "Tracker", url: "", status: "soon" },
  { name: "Uniswap", kind: "DEX", url: "", status: "soon" },
  { name: "PancakeSwap", kind: "DEX", url: "", status: "soon" },
];

export type Partner = {
  name: string;
  logo?: string; // path under /public, e.g. "/partners/acme.png"
  url?: string;
  role: string;
};

// Partner logos go in /public/partners. Empty slots show as "Open Slot" cards.
export const partners: Partner[] = [
  { name: "Open Slot", role: "Studio Partner" },
  { name: "Open Slot", role: "Launch Partner" },
  { name: "Open Slot", role: "Creator Guild" },
  { name: "Open Slot", role: "Exchange" },
  { name: "Open Slot", role: "Media" },
  { name: "Open Slot", role: "Community" },
];

export const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/theatre", label: "Movies & Games" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/dev-notes", label: "Dev Notes" },
  { href: "/blog", label: "Blog" },
  { href: "/token", label: "Token" },
  { href: "/community", label: "Community" },
];
