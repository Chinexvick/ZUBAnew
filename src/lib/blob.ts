// Private Vercel Blob storage: the site's small database (content, subscribers, uploads).
// Active when BLOB_READ_WRITE_TOKEN is set (Vercel injects it once the store is connected).
import { del, get, list, put } from "@vercel/blob";

export function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export async function readBlob(pathname: string) {
  const r = await get(pathname, { access: "private", useCache: false });
  if (!r || !r.stream) return null;
  return { body: await streamToBuffer(r.stream), contentType: r.blob.contentType ?? "application/octet-stream" };
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  const r = await readBlob(pathname);
  return r ? (JSON.parse(r.body.toString("utf8")) as T) : null;
}

export async function writeJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function writeFile(pathname: string, body: Buffer, contentType: string) {
  await put(pathname, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
}

export async function removeBlob(pathname: string) {
  await del(pathname);
}

/* Every pathname under a prefix, following pagination. */
export async function listPaths(prefix: string) {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}
