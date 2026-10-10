import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { readItems, storageMode, writeItems } from "@/lib/store";
import { cleanNotes, cleanPosts } from "@/lib/validate";
import type { ContentType } from "@/lib/content";

export const dynamic = "force-dynamic";

function parseType(v: string | null): ContentType | null {
  return v === "devnotes" || v === "blog" ? v : null;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const type = parseType(new URL(req.url).searchParams.get("type"));
  if (!type) return NextResponse.json({ error: "Unknown type." }, { status: 400 });
  try {
    return NextResponse.json({ items: await readItems(type), mode: storageMode() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { type?: string; items?: unknown; message?: string } | null;
  const type = parseType(body?.type ?? null);
  if (!type) return NextResponse.json({ error: "Unknown type." }, { status: 400 });
  try {
    const items = type === "devnotes" ? cleanNotes(body!.items) : cleanPosts(body!.items);
    const message = (body!.message || `Update ${type} from admin`).slice(0, 120);
    await writeItems(type, items, message);
    if (storageMode() !== "github") {
      // Blob and local saves are live immediately; refresh every page that lists content.
      revalidatePath("/", "layout");
    }
    return NextResponse.json({ ok: true, items, mode: storageMode() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
