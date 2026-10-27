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
        // The page and loader change with every release: always check for a new copy.
        source: "/play/:file(index.html|flutter_bootstrap.js|main.dart.js|main.dart.mjs|main.dart.wasm|version.json)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // No cross-origin isolation: the game engine runs on one thread (the multi-threaded mode
        // dropped letters on some phones), and isolation would only block outside fonts and pictures.
        source: "/play",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // Pictures and sounds: cache for an hour. (A changed picture gets a new file name, so it is never stale.)
        source: "/play/:dir(assets|icons)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
      {
        // Files that must always match the game code: the graphics engine, the font list, the list of
        // pictures, and the fonts. Always check for a newer copy (a quick 304 when nothing changed),
        // so a phone can never mix an old engine or font list with a new game.
        source: "/play/canvaskit/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/play/assets/:file(AssetManifest.bin|AssetManifest.bin.json|AssetManifest.json|FontManifest.json|NOTICES)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // game data (sizes, rules, levels) keeps its file name between releases: always check
        source: "/play/:path(.*\\.json)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/play/assets/:dir(fonts|assets/fonts)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
