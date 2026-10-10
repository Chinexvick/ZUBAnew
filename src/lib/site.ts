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

export const PAIR = "0xdcc6c7cb227dc0d3544717902dcd92e4bac15a7e";

export type Listing = {
  id: string;
  name: string;
  kind: string;
  detail: string;
  url: string;
  /** Official brand logo in /public/listings. */
  logo: string;
  /** "fill": the logo is a full-bleed square tile; "pad": transparent mark shown on a light disc. */
  fit?: "fill" | "pad";
};

// Where $ZUBA is live today. Trackers index the PancakeSwap pool automatically.
export const listings: Listing[] = [
  { id: "pancakeswap", name: "PancakeSwap", kind: "Trade", detail: "Swap BNB for $ZUBA", url: site.links.buy, logo: "/listings/pancakeswap.png" },
  { id: "geckoterminal", name: "CoinGecko DEX", kind: "GeckoTerminal", detail: "Live on CoinGecko's GeckoTerminal", url: `https://www.geckoterminal.com/bsc/pools/${PAIR}`, logo: "/listings/geckoterminal.png" },
  { id: "dexscreener", name: "DEX Screener", kind: "Live chart", detail: "Price, volume and liquidity", url: site.links.chart, logo: "/listings/dexscreener.png" },
  { id: "dextools", name: "DEXTools", kind: "Pair explorer", detail: "Trades and pool analytics", url: `https://www.dextools.io/app/en/bnb/pair-explorer/${PAIR}`, logo: "/listings/dextools.png" },
  { id: "firescreener", name: "FireScreener", kind: "Screener", detail: "BSC token tracker", url: `https://www.firescreener.com/bsc/${CONTRACT}`, logo: "/listings/firescreener.png", fit: "pad" },
  { id: "coinpaprika", name: "Coinpaprika", kind: "Tracker", detail: "Tracked on DexPaprika by Coinpaprika", url: `https://dexpaprika.com/bsc/token/${CONTRACT.toLowerCase()}`, logo: "/listings/coinpaprika.svg", fit: "pad" },
  { id: "poocoin", name: "PooCoin", kind: "BSC charts", detail: "Charts and wallet tracker", url: `https://poocoin.app/tokens/${CONTRACT}`, logo: "/listings/poocoin.png", fit: "pad" },
  { id: "ave", name: "Ave.ai", kind: "Screener", detail: "Multi-chain token data", url: `https://ave.ai/token/${CONTRACT}-bsc`, logo: "/listings/ave.png" },
  { id: "gmgn", name: "GMGN", kind: "Screener", detail: "Holders and smart-money flow", url: `https://gmgn.ai/bsc/token/${CONTRACT}`, logo: "/listings/gmgn.png" },
  { id: "livecoinwatch", name: "LiveCoinWatch", kind: "Price tracker", detail: "Listed as Zubathesuperdog", url: "https://www.livecoinwatch.com/price/Zubathesuperdog-_ZUBA", logo: "/listings/livecoinwatch.png", fit: "pad" },
  { id: "dexrabbit", name: "DEXRabbit", kind: "Bitquery", detail: "On-chain trades and holders", url: `https://dexrabbit.bitquery.io/bsc/token/${CONTRACT.toLowerCase()}`, logo: "/listings/dexrabbit.png", fit: "pad" },
  { id: "peniwallet", name: "Peniwallet", kind: "Wallet", detail: "Hold and send $ZUBA in-app", url: "https://apps.apple.com/us/app/peniwallet/id6473462922", logo: "/listings/peniwallet.png" },
  { id: "giantwallet", name: "Giant Wallet", kind: "Wallet", detail: "Listed in the BNB Chain wallet", url: "https://play.google.com/store/apps/details?id=com.GiantWallet", logo: "/listings/giantwallet.png" },
  { id: "bscscan", name: "BscScan", kind: "Contract", detail: "0xE1bf…994A4", url: site.links.bscscan, logo: "/listings/bscscan.png", fit: "pad" },
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
  { name: "Phoenix Token", logo: "/partners/partner-2.png" },
  { name: "Light Speed Cat Token", logo: "/partners/partner-3.png" },
  { name: "Phenomenal Cat Coin", logo: "/partners/partner-4.png" },
  { name: "Kinesis Flow", logo: "/partners/partner-5.png" },
  { name: "uTrading", logo: "/partners/partner-6.png" },
  { name: "Mamba Coin", logo: "/partners/mamba.webp" },
  { name: "Gracia Token", logo: "/partners/gracia.webp" },
  { name: "Catademia", logo: "/partners/catademia.webp" },
  { name: "Unity Makes One Token", logo: "/partners/unity.webp" },
  { name: "Snow Cat", logo: "/partners/snowcat.webp" },
  { name: "Luminous AI", logo: "/partners/luminous.webp" },
  { name: "IAped Token", logo: "/partners/iaped.webp" },
  { name: "Cat Cake Token", logo: "/partners/catcake.webp" },
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
