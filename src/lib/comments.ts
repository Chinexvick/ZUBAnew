// Reader comments on blog posts and dev notes: one private blob per comment.
import { randomBytes } from "crypto";
import { listPaths, readJson, removeBlob, writeJson } from "./blob";

export type CommentKind = "blog" | "devnotes";
export type Comment = { id: string; kind: CommentKind; slug: string; name: string; text: string; at: string; admin?: boolean };

const SLUG_RE = /^[a-z0-9-]{1,80}$/;
export const validTarget = (kind: unknown, slug: unknown): kind is CommentKind =>
  (kind === "blog" || kind === "devnotes") && typeof slug === "string" && SLUG_RE.test(slug);

const prefix = (kind: CommentKind, slug: string) => `comments/${kind}/${slug}/`;

export async function listComments(kind: CommentKind, slug: string) {
  const paths = (await listPaths(prefix(kind, slug))).sort();
  return (await Promise.all(paths.map((p) => readJson<Comment>(p).catch(() => null)))).filter(Boolean) as Comment[];
}

export async function listAllComments() {
  const paths = (await listPaths("comments/")).sort().reverse().slice(0, 300);
  return (await Promise.all(paths.map((p) => readJson<Comment>(p).catch(() => null)))).filter(Boolean) as Comment[];
}

export async function addComment(c: Omit<Comment, "id" | "at">) {
  const at = new Date().toISOString();
  const id = `${prefix(c.kind, c.slug)}${at.replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.json`;
  const comment: Comment = { ...c, id, at };
  await writeJson(id, comment);
  return comment;
}

export async function deleteComment(id: string) {
  if (!/^comments\/(blog|devnotes)\/[a-z0-9-]+\/[\w.-]+\.json$/.test(id)) throw new Error("Bad id");
  await removeBlob(id);
}
