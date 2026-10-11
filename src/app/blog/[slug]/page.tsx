import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getPosts, formatDate, renderMarkdown } from "@/lib/content";
import { Chev, Divider, Runes, ZText } from "@/components/ui/Glyphs";
import { art } from "@/content/art";
import Share from "@/components/Share";
import { siteUrl } from "@/lib/mailer";

const FALLBACK = ["anansi-backdrop", "zuba-game-backdrop", "impundulu-backdrop", "oware-backdrop", "grootslang-backdrop"];

type Params = { slug: string };

export async function generateStaticParams() {
  return (await getPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await getPost((await params).slug);
  if (!p) return {};
  const image = p.cover || art(FALLBACK[p.slug.length % FALLBACK.length]);
  const url = `/blog/${p.slug}`;
  return {
    title: p.title,
    description: p.excerpt,
    alternates: { canonical: url },
    openGraph: { type: "article", title: p.title, description: p.excerpt, url, images: [{ url: image, alt: p.title }], publishedTime: p.date, authors: [p.author] },
    twitter: { card: "summary_large_image", title: p.title, description: p.excerpt, images: [image] },
  };
}

export default async function PostPage({ params }: { params: Promise<Params> }) {
  const p = await getPost((await params).slug);
  if (!p) notFound();

  return (
    <div className="page">
      <article className="container article">
        <Link href="/blog" className="back-link">
          <Chev dir="left" /> All scrolls
        </Link>
        <header className="heading" style={{ marginTop: 30 }}>
          <Runes text={p.category} />
          <h1 className="t-title lg">
            <ZText>{p.title}</ZText>
          </h1>
          <Divider variant="notched" align="left" />
          <p className="t-muted" style={{ margin: 0 }}>
            {formatDate(p.date)} · {p.author} · {p.category}
          </p>
        </header>
        <div className="article-cover">
          <img src={p.cover || art(FALLBACK[p.slug.length % FALLBACK.length])} alt="" />
        </div>
        <p className="t-lead" style={{ marginTop: 30 }}>
          {p.excerpt}
        </p>
        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.body) }} />
        <Share url={`${siteUrl()}/blog/${p.slug}`} title={p.title} />
        <Divider variant="diamond" />
        <div className="center stack" style={{ marginTop: 30 }}>
          <Runes text="Next" />
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <Link href="/community" className="btn primary">
              Join the Village
            </Link>
            <Link href="/roadmap" className="btn">
              Follow the Roadmap
            </Link>
          </div>
          <Link href="/blog" className="back-link" style={{ justifyContent: "center" }}>
            <Chev dir="left" /> All scrolls
          </Link>
        </div>
      </article>
    </div>
  );
}
