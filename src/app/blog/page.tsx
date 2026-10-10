import type { Metadata } from "next";
import Link from "next/link";
import { getPosts, formatDate } from "@/lib/content";
import { media } from "@/content/media";
import { Delta, Frame, Heading, ZText } from "@/components/ui/Glyphs";

export const metadata: Metadata = {
  title: "Blog",
  description: "Stories, announcements and thoughts from the ZUBA village.",
};

export default async function Blog() {
  const posts = await getPosts();
  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${media["sundiata-backdrop"]})` }} aria-hidden="true" />
        <div className="container">
          <Heading as="h1" runes="Griot" title="The Griot's Scroll" size="xl" lead="News, announcements and stories from the ZUBA village. The griot remembers everything." />
        </div>
      </section>
      <div className="container" style={{ paddingBottom: 100 }}>
        {posts.length === 0 ? (
          <p className="center t-muted">The first scroll is being written.</p>
        ) : (
          <div className="grid cols-3">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`}>
                <Frame hoverable bodyClassName="post-card">
                  <div className="post-cover">
                    {p.cover ? (
                      <img src={p.cover} alt="" loading="lazy" />
                    ) : (
                      <span className="placeholder">
                        <Delta className="delta" />
                      </span>
                    )}
                  </div>
                  <div className="post-body">
                    <span className="t-label">
                      {p.category} · {formatDate(p.date)}
                    </span>
                    <h2 className="t-title sm">
                      <ZText>{p.title}</ZText>
                    </h2>
                    <p className="t-muted" style={{ margin: 0 }}>
                      {p.excerpt}
                    </p>
                  </div>
                </Frame>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
