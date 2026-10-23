import type { NextConfig } from "next";

// Old game pages, replaced by the playable ZUBA Arcade games.
const retiredGames = ["ninki-nanka-swamp-legend", "impundulu-storm-riders", "oware-clash-of-kings", "grootslang-cave-of-a-thousand-gems"];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/theatre/games/zuba-rise-of-the-ancestors", destination: "/theatre/games/zuba-run", permanent: true },
      { source: "/theatre/games/zuba", destination: "/theatre/games/zuba-run", permanent: true },
      ...retiredGames.map((slug) => ({ source: `/theatre/games/${slug}`, destination: "/theatre#games", permanent: true })),
      { source: "/arcade", destination: "/play", permanent: false },
    ];
  },
  async rewrites() {
    // ZUBA Arcade is a static Flutter web app in public/play.
    return [{ source: "/play", destination: "/play/index.html" }];
  },
  async headers() {
    return [
      {
        // Cross-origin isolation lets the game engine use several threads (smoother play).
        source: "/play/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        // The page and loader change with every release: always check for a new copy.
        source: "/play/:file(index.html|flutter_bootstrap.js|main.dart.js|main.dart.mjs|main.dart.wasm|version.json)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/play",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        // Pictures, sounds and the engine rarely change: cache for a day, refresh in the background.
        source: "/play/:dir(assets|canvaskit|icons)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
