// Content storage for the admin dashboard.
// With GITHUB_TOKEN + GITHUB_REPO set (production), changes are committed to the repo and Vercel redeploys.
// Without them (local development), changes are written straight to disk.
import { promises as fs } from "fs";
import path from "path";
import { CONTENT_FILES, type ContentType } from "./content";

const GH_API = "https://api.github.com";

function gh() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/name"
  const branch = process.env.GITHUB_BRANCH || "main";
  return token && repo ? { token, repo, branch } : null;
}

export function storageMode() {
  return gh() ? "github" : "local";
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

export async function readItems(type: ContentType): Promise<unknown[]> {
  const file = CONTENT_FILES[type];
  if (gh()) {
    const r = await ghGet(file);
    return r ? JSON.parse(r.text) : [];
  }
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), file), "utf8"));
  } catch {
    return [];
  }
}

export async function writeItems(type: ContentType, items: unknown[], message: string) {
  const file = CONTENT_FILES[type];
  const text = JSON.stringify(items, null, 2) + "\n";
  if (gh()) return ghPut(file, Buffer.from(text).toString("base64"), message);
  await fs.writeFile(path.join(process.cwd(), file), text, "utf8");
}

export async function saveUpload(name: string, base64: string) {
  const safe = name.toLowerCase().replace(/[^a-z0-9.\-]+/g, "-").replace(/^-+|-+$/g, "");
  const file = `public/uploads/${Date.now()}-${safe}`;
  if (gh()) {
    await ghPut(file, base64, `Upload ${safe} from admin`);
  } else {
    await fs.mkdir(path.join(process.cwd(), "public/uploads"), { recursive: true });
    await fs.writeFile(path.join(process.cwd(), file), Buffer.from(base64, "base64"));
  }
  return file.replace(/^public/, "");
}
