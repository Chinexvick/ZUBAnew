// Content storage for the admin dashboard. Three modes, picked from the environment:
//   blob   — BLOB_READ_WRITE_TOKEN set (production): content lives in the private Vercel Blob store and
//            pages refresh instantly on save. The JSON files in /content are the starting seed.
//   github — GITHUB_TOKEN + GITHUB_REPO set: changes are committed to the repo and Vercel redeploys.
//   local  — neither (development): changes are written straight to disk.
import { promises as fs } from "fs";
import path from "path";
import { blobEnabled, readJson, writeFile, writeJson } from "./blob";

export type ContentType = "devnotes" | "blog";

export const CONTENT_FILES: Record<ContentType, string> = {
  devnotes: "content/devnotes.json",
  blog: "content/blog.json",
};

const deletedFile = (type: ContentType) => `content/${type}-deleted.json`;

const GH_API = "https://api.github.com";

function gh() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/name"
  const branch = process.env.GITHUB_BRANCH || "main";
  return token && repo ? { token, repo, branch } : null;
}

export function storageMode(): "blob" | "github" | "local" {
  return blobEnabled() ? "blob" : gh() ? "github" : "local";
}

async function ghGet(file: string) {
  const g = gh()!;
  const res = await fetch(`${GH_API}/repos/${g.repo}/contents/${file}?ref=${encodeURIComponent(g.branch)}`, {
    headers: { Authorization: `Bearer ${g.token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
  const json = (await res.json()) as { content: string; sha: string };
  return { text: Buffer.from(json.content, "base64").toString("utf8"), sha: json.sha };
}

async function ghPut(file: string, base64: string, message: string) {
  const g = gh()!;
  const existing = await ghGet(file).catch(() => null);
  const res = await fetch(`${GH_API}/repos/${g.repo}/contents/${file}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${g.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: base64, branch: g.branch, ...(existing ? { sha: existing.sha } : {}) }),
  });
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

async function readDisk(type: ContentType): Promise<unknown[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), CONTENT_FILES[type]), "utf8"));
  } catch {
    return [];
  }
}

export async function readItems(type: ContentType): Promise<unknown[]> {
  const file = CONTENT_FILES[type];
  const mode = storageMode();
  if (mode === "blob") {
    // The live store wins; entries added to the repo's JSON later are merged in unless deleted in the admin.
    const live = await readJson<{ slug: string }[]>(file);
    if (!live) return readDisk(type);
    const deleted = new Set((await readJson<string[]>(deletedFile(type))) ?? []);
    const have = new Set(live.map((i) => i.slug));
    const extra = ((await readDisk(type)) as { slug: string }[]).filter((i) => !have.has(i.slug) && !deleted.has(i.slug));
    return [...live, ...extra];
  }
  if (mode === "github") {
    const r = await ghGet(file);
    return r ? JSON.parse(r.text) : [];
  }
  return readDisk(type);
}

export async function writeItems(type: ContentType, items: unknown[], message: string) {
  const file = CONTENT_FILES[type];
  const mode = storageMode();
  if (mode === "blob") {
    // Remember entries removed in the admin so repo seeds don't bring them back.
    const before = ((await readItems(type)) as { slug: string }[]).map((i) => i.slug);
    const now = new Set((items as { slug: string }[]).map((i) => i.slug));
    const removed = before.filter((sl) => !now.has(sl));
    if (removed.length) {
      const prev = (await readJson<string[]>(deletedFile(type))) ?? [];
      await writeJson(deletedFile(type), Array.from(new Set([...prev, ...removed])));
    }
    return writeJson(file, items);
  }
  const text = JSON.stringify(items, null, 2) + "\n";
  if (mode === "github") return ghPut(file, Buffer.from(text).toString("base64"), message);
  await fs.writeFile(path.join(process.cwd(), file), text, "utf8");
}

export async function saveUpload(name: string, data: Buffer, contentType: string) {
  const safe = name.toLowerCase().replace(/[^a-z0-9.\-]+/g, "-").replace(/^-+|-+$/g, "");
  const file = `uploads/${Date.now()}-${safe}`;
  const mode = storageMode();
  if (mode === "blob") {
    await writeFile(file, data, contentType);
    return `/api/media/${file}`;
  }
  if (mode === "github") {
    await ghPut(`public/${file}`, data.toString("base64"), `Upload ${safe} from admin`);
  } else {
    await fs.mkdir(path.join(process.cwd(), "public/uploads"), { recursive: true });
    await fs.writeFile(path.join(process.cwd(), "public", file), data);
  }
  return `/${file}`;
}
