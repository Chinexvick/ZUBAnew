import type { Metadata } from "next";
import Link from "next/link";
import { getPosts, formatDate } from "@/lib/content";
import { art } from "@/content/art";
import { Chev, Frame, Heading, ZText } from "@/components/ui/Glyphs";
import type { BlogPost } from "@/lib/content";

const FALLBACK = ["anansi-backdrop", "zuba-game-backdrop", "impundulu-backdrop", "oware-backdrop", "grootslang-backdrop"];
const coverFor = (p: BlogPost) => p.cover || art(FALLBACK[p.slug.length % FALLBACK.length]);

export const metadata: Metadata = {
  title: "Blog",
  description: "Stories, announcements and thoughts from the ZUBA village.",
};

export default async function Blog() {
  const posts = await getPosts();
  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${art("sundiata-backdrop")})` }} aria-hidden="true" />
        <div className="container">
          <Heading as="h1" runes="Griot" title="The Griot's Scroll" size="xl" lead="News, announcements and stories from the ZUBA village. The griot remembers everything." />
        </div>
      </section>
      <div className="container" style={{ paddingBottom: 100 }}>
        {posts.length === 0 ? (
          <p className="center t-muted">The first scroll is being written.</p>
        ) : (
          <>
            <Link href={`/blog/${posts[0].slug}`} className="b-feature">
              <span className="b-feature-art" style={{ backgroundImage: `url(${coverFor(posts[0])})` }} />
              <span className="b-feature-text">
                <span className="t-label">
                  {posts[0].category} · {formatDate(posts[0].date)}
                </span>
                <span className="t-title md">
                  <ZText>{posts[0].title}</ZText>
                </span>
                <span className="t-muted">{posts[0].excerpt}</span>
                <span className="prompt">
                  Read the scroll <Chev />
                </span>
              </span>
            </Link>
            {posts.length > 1 && (
              <div className="grid cols-3" style={{ marginTop: 30 }}>
                {posts.slice(1).map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`}>
                    <Frame hoverable bodyClassName="post-card">
                      <div className="post-cover">
                        <img src={coverFor(p)} alt="" loading="lazy" />
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
            <p className="center t-muted" style={{ marginTop: 40 }}>
              More scrolls are being written. Meanwhile, see what the builders shipped in{" "}
              <Link href="/dev-notes" className="hl">
                Dev Notes
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </>
  );
}
