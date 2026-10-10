import Link from "next/link";
import { nav, site } from "@/lib/site";
import { SocialRow } from "./Social";
import { Divider, Runes, ZText } from "./ui/Glyphs";
import CopyCA from "./CopyCA";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack">
            <Link href="/" className="nav-logo">
              <img src="/brand/zuba-coin.png" alt="" width={46} height={46} style={{ borderRadius: "50%" }} />
              <span className="t-title md">
                <ZText>ZUBA</ZText>
              </span>
            </Link>
            <p className="t-muted" style={{ maxWidth: 360 }}>
              {site.description}
            </p>
            <SocialRow />
          </div>
          <div>
            <h4>The Map</h4>
            <ul>
              {nav.slice(0, 4).map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>The Village</h4>
            <ul>
              {nav.slice(4).map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="stack">
            <h4>Contract</h4>
            <CopyCA />
            <p className="t-muted" style={{ fontSize: "0.82rem" }}>
              Always verify the contract address. ZUBA will never DM you first.
            </p>
          </div>
        </div>
        <div style={{ marginTop: 50 }}>
          <Divider variant="notched" />
          <div className="center" style={{ marginTop: 14 }}>
            <Runes text="Africa to the world" />
          </div>
        </div>
      </div>
      <div className="footer-bar">
        <div className="container">
          <span>© {new Date().getFullYear()} ZUBA. Community-driven. Made with pride for the Motherland.</span>
          <span>Crypto assets are volatile. Nothing here is financial advice.</span>
        </div>
      </div>
    </footer>
  );
}
