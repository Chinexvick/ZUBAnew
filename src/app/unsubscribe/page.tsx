import type { Metadata } from "next";
import Unsubscribe from "./Unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; s?: string }> }) {
  const { e = "", s = "" } = await searchParams;
  return <Unsubscribe e={e} s={s} />;
}
