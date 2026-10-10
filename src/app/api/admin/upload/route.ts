import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { saveUpload } from "@/lib/store";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Use PNG, JPG, WEBP or GIF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 4 MB." }, { status: 400 });
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const url = await saveUpload(file.name || "image.png", base64);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
