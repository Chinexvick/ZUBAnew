import Link from "next/link";
import { nav, site } from "@/lib/site";
import { SocialRow } from "./Social";
import { Runes, ZText } from "./ui/Glyphs";

const resources = [
  { href: "/whitepaper", label: "Whitepaper" },
  { href: site.links.chart, label: "Live Chart", ext: true },
  { href: site.links.audit, label: "Audit Report", ext: true },
  { href: site.links.kyc, label: "KYC Certificate", ext: true },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack">
            <Link href="/" className="nav-logo">
              <img src="/brand/zuba-coin.png" alt="" width={44} height={44} style={{ borderRadius: "50%" }} />
              <span className="t-title md">
                <ZText>ZUBA</ZText>
              </span>
            </Link>
            <p className="t-muted" style={{ maxWidth: 340 }}>
              Story-first. Community-driven. Africa to the world.
            </p>
            <SocialRow />
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              {nav.slice(1, 5).map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Village</h4>
            <ul>
              {nav.slice(5).map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul>
              {resources.map((r) =>
                r.ext ? (
                  <li key={r.label}>
                    <a href={r.href} target="_blank" rel="noopener noreferrer">
                      {r.label} ↗
                    </a>
                  </li>
                ) : (
                  <li key={r.label}>
                    <Link href={r.href}>{r.label}</Link>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
        <div className="center" style={{ marginTop: 50 }}>
          <Runes text="Africa to the world" />
        </div>
      </div>
      <div className="footer-bar">
        <div className="container">
          <span>© {new Date().getFullYear()} ZUBA. Community-driven.</span>
          <span>Crypto is volatile. Nothing here is financial advice.</span>
        </div>
      </div>
    </footer>
  );
}
