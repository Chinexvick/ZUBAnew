import type { Listing, Partner } from "@/lib/site";
import { Frame, Runes, ZText } from "./ui/Glyphs";

function Monogram({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <span className="monogram">{letters}</span>;
}

export function ListingGrid({ items }: { items: Listing[] }) {
  return (
    <div className="listing-grid">
      {items.map((l) => {
        const inner = (
          <Frame hoverable={l.status === "live"} className={`listing ${l.status}`}>
            <div className="listing-body">
              <span className="medal">
                <Monogram name={l.name} />
              </span>
              <span className="listing-name">
                <ZText>{l.name}</ZText>
              </span>
              <span className="t-label">{l.kind}</span>
              <span className={`chip ${l.status}`}>{l.status === "live" ? "● Live" : "Coming soon"}</span>
            </div>
          </Frame>
        );
        return l.status === "live" && l.url ? (
          <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        ) : (
          <div key={l.name}>{inner}</div>
        );
      })}
    </div>
  );
}

export function PartnerGrid({ items }: { items: Partner[] }) {
  return (
    <div className="partner-grid">
      {items.map((p, i) => {
        const open = !p.logo;
        const inner = (
          <Frame hoverable className={`partner ${open ? "open" : ""}`}>
            <div className="partner-body">
              {p.logo ? (
                <img src={p.logo} alt={`${p.name} logo`} className="partner-logo" />
              ) : (
                <span className="partner-empty" aria-hidden="true">
                  <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M8 28 L20 8 L32 28 Z" />
                    <path d="M4 34 H36" />
                  </svg>
                </span>
              )}
              <span className="partner-name">{p.logo ? p.name : <Runes text="Ally" />}</span>
              <span className="t-label">{open ? `${p.role} · Open` : p.role}</span>
            </div>
          </Frame>
        );
        return p.url ? (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        ) : (
          <div key={i}>{inner}</div>
        );
      })}
    </div>
  );
}
