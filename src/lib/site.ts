// Central site configuration. Edit links, listings and partners here.

export const CONTRACT = "0xE1bf97baCF682AE17cA3E239aB68a7b525f994A4";

export const site = {
  name: "ZUBA",
  tagline: "The Motherland Has Entered the Game",
  description:
    "ZUBA is a gaming and animation token on BNB Chain, building African games, films and stories for a global audience. Community-driven. Story-first.",
  contractAddress: CONTRACT,
  chain: "BNB Smart Chain (BEP-20)",
  socials: {
    x: { label: "X", handle: "@zubatoken", url: "https://x.com/zubatoken" },
    telegram: { label: "Telegram", handle: "ZUBA Community", url: "https://t.me/zubacommunitychat" },
    whatsapp: { label: "WhatsApp", handle: "ZUBA Community", url: "https://chat.whatsapp.com/CnHq8ujSJCVEpTtT5ih4cZ" },
  },
  links: {
    buy: `https://pancakeswap.finance/swap?outputCurrency=${CONTRACT}`,
    chart: "https://dexscreener.com/bsc/0xdcc6c7cb227dc0d3544717902dcd92e4bac15a7e",
    bscscan: `https://bscscan.com/token/${CONTRACT}`,
    audit: "https://github.com/VBS-Labs/Audit-Report/blob/main/ZUBA%20TOKEN%20CONTRACT%20AUDIT%20REPORT.pdf",
    kyc: "https://gitlab.com/vital-block-security/Project-KYC-Verification/-/blob/main/ZUBA_TOKEN_KYC_CERTIFICATE.pdf",
  },
};

export const token = {
  symbol: "ZUBA",
  supply: 500_000_000_000,
  supplyLabel: "500,000,000,000",
  supplyShort: "500B",
  allocation: [
    { label: "Liquidity & Fair Launch", pct: 85, note: "The trading pool on PancakeSwap, launched fair for everyone." },
    { label: "Marketing", pct: 10, note: "Listings, creator campaigns, events and community growth." },
    { label: "Development", pct: 5, note: "Games, animation and the tools that power the ZUBA universe." },
  ],
};

export type Listing = {
  name: string;
  kind: string;
  url: string;
  logo?: string;
};

// Where $ZUBA is live today.
export const listings: Listing[] = [
  { name: "PancakeSwap", kind: "Trade", url: site.links.buy },
  { name: "DEX Screener", kind: "Live chart", url: site.links.chart },
  { name: "BscScan", kind: "Contract", url: site.links.bscscan },
];

// Security documents.
export const trust = [
  { name: "Contract Audit", by: "VBS Labs", url: site.links.audit },
  { name: "KYC Certificate", by: "Vital Block Security", url: site.links.kyc },
];

export type Partner = { name: string; logo: string; url?: string };

// Partner logos live in /public/partners.
export const partners: Partner[] = [
  { name: "Partner", logo: "/partners/partner-1.png" },
  { name: "Partner", logo: "/partners/partner-2.png" },
  { name: "LightSpeedCat", logo: "/partners/partner-3.png" },
  { name: "Phenomenal Cat Coin", logo: "/partners/partner-4.png" },
  { name: "Partner", logo: "/partners/partner-5.png" },
  { name: "uTrading", logo: "/partners/partner-6.png" },
];

export const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/theatre", label: "Movies & Games" },
  { href: "/token", label: "Token" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/dev-notes", label: "Dev Notes" },
  { href: "/blog", label: "Blog" },
  { href: "/community", label: "Community" },
];
