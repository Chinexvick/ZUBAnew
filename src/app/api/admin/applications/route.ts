import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { blobEnabled, listPaths, readJson, removeBlob } from "@/lib/blob";
import { trackById } from "@/content/partner";

export const dynamic = "force-dynamic";

type App = { track: string; trackName: string; at: string; answers: Record<string, string> };

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!blobEnabled()) return NextResponse.json({ items: [] });
  const paths = (await listPaths("partners/")).sort().reverse().slice(0, 300);
  const items = (
    await Promise.all(
      paths.map(async (id) => {
        const a = await readJson<App>(id).catch(() => null);
        if (!a) return null;
        const labels = Object.fromEntries((trackById(a.track)?.fields ?? []).map((f) => [f.id, f.label]));
        return { id, ...a, labels };
      })
    )
  ).filter(Boolean);
  return NextResponse.json({ items });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^partners\/[\w.-]+\.json$/.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  await removeBlob(id);
  return NextResponse.json({ ok: true });
}
