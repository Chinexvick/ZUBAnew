import { marked } from "marked";
import { readItems, type ContentType } from "./store";

export type { ContentType };

export type DevNote = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  phase: number; // 1-5, matches the roadmap
  status: "cleared" | "in-progress" | "planned";
  location: string; // map label, e.g. "Base Camp"
  summary: string;
  achievements: string[];
  next: string[];
  body: string; // markdown
};

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  category: string;
  author: string;
  cover: string;
  excerpt: string;
  body: string; // markdown
};

async function readJson<T>(type: ContentType): Promise<T[]> {
  try {
    return (await readItems(type)) as T[];
  } catch (e) {
    console.error(`Could not read ${type}`, e);
    return [];
  }
}

const byDateDesc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export async function getDevNotes() {
  return (await readJson<DevNote>("devnotes")).sort(byDateDesc);
}

export async function getDevNote(slug: string) {
  return (await getDevNotes()).find((n) => n.slug === slug);
}

export async function getPosts() {
  return (await readJson<BlogPost>("blog")).sort(byDateDesc);
}

export async function getPost(slug: string) {
  return (await getPosts()).find((p) => p.slug === slug);
}

export function renderMarkdown(md: string) {
  return marked.parse(md ?? "", { async: false }) as string;
}

export function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
