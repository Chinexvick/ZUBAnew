import { blobEnabled, readBlob } from "@/lib/blob";

// Serves images uploaded from the admin (stored in the private blob store) to the public site.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!blobEnabled() || parts[0] !== "uploads" || parts.some((p) => p === ".." || p.includes("/"))) {
    return new Response("Not found", { status: 404 });
  }
  const file = await readBlob(parts.join("/")).catch(() => null);
  if (!file || !file.contentType.startsWith("image/")) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
