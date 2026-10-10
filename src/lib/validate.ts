import type { BlogPost, DevNote } from "./content";

const str = (v: unknown, max = 20000) => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 500)).filter(Boolean).slice(0, 50) : []);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Date().toISOString().slice(0, 10));

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueSlugs<T extends { slug: string; title: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.map((it) => {
    let base = slugify(it.slug || it.title) || "entry";
    let s = base;
    let i = 2;
    while (seen.has(s)) s = `${base}-${i++}`;
    seen.add(s);
    base = s;
    return { ...it, slug: s };
  });
}

export function cleanNotes(raw: unknown): DevNote[] {
  if (!Array.isArray(raw)) throw new Error("Expected a list");
  const items = raw.map((r: Record<string, unknown>) => {
    const status = ["cleared", "in-progress", "planned"].includes(r.status as string) ? (r.status as DevNote["status"]) : "in-progress";
    const phase = Math.min(5, Math.max(1, Number(r.phase) || 1));
    return {
      slug: str(r.slug, 80),
      title: str(r.title, 200) || "Untitled entry",
      date: date(r.date),
      phase,
      status,
      location: str(r.location, 80),
      summary: str(r.summary, 600),
      achievements: list(r.achievements),
      next: list(r.next),
      body: str(r.body),
    };
  });
  return uniqueSlugs(items);
}

export function cleanPosts(raw: unknown): BlogPost[] {
  if (!Array.isArray(raw)) throw new Error("Expected a list");
  const items = raw.map((r: Record<string, unknown>) => ({
    slug: str(r.slug, 80),
    title: str(r.title, 200) || "Untitled post",
    date: date(r.date),
    category: str(r.category, 60) || "News",
    author: str(r.author, 80) || "ZUBA Team",
    cover: str(r.cover, 500),
    excerpt: str(r.excerpt, 600),
    body: str(r.body),
  }));
  return uniqueSlugs(items);
}
