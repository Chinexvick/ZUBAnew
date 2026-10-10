import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/theatre/games/zuba-rise-of-the-ancestors",
        destination: "/theatre/games/zuba",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
