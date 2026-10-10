import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/unsubscribe"] },
    sitemap: "https://www.zubatoken.com/sitemap.xml",
    host: "https://www.zubatoken.com",
  };
}
