import type { MetadataRoute } from "next";
import { allTitles } from "@/content/theatre";
import { getDevNotes, getPosts } from "@/lib/content";

const BASE = "https://www.zubatoken.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/about", "/token", "/whitepaper", "/theatre", "/roadmap", "/dev-notes", "/blog", "/community"].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.8,
  }));
  const titles = allTitles.map((t) => ({ url: `${BASE}/theatre/${t.kind === "game" ? "games" : "movies"}/${t.slug}`, priority: 0.6 }));
  const notes = (await getDevNotes()).map((n) => ({ url: `${BASE}/dev-notes/${n.slug}`, lastModified: n.date, priority: 0.6 }));
  const posts = (await getPosts()).map((p) => ({ url: `${BASE}/blog/${p.slug}`, lastModified: p.date, priority: 0.6 }));
  return [...pages, ...titles, ...notes, ...posts];
}
