import type { Listing, Partner } from "@/lib/site";

/* Partner logos on an endless, slow scroll. Pauses on hover; static when motion is reduced. */
export function PartnerMarquee({ items }: { items: Partner[] }) {
  const row = [...items, ...items];
  return (
    <div className="pmarquee" aria-label="Our partners">
      <ul className="pmarquee-track">
        {row.map((p, i) => (
          <li key={i} className="pmarquee-item" aria-hidden={i >= items.length}>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" tabIndex={i >= items.length ? -1 : 0}>
                <img src={p.logo} alt={p.name === "Partner" ? "Partner logo" : `${p.name} logo`} />
              </a>
            ) : (
              <img src={p.logo} alt={p.name === "Partner" ? "Partner logo" : `${p.name} logo`} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Static grid of identical partner tiles, with a caption when the name is known. */
export function PartnerGrid({ items }: { items: Partner[] }) {
  return (
    <ul className="pgrid">
      {items.map((p) => {
        const known = p.name !== "Partner";
        const tile = (
          <>
            <span className="pgrid-logo">
              <img src={p.logo} alt={known ? `${p.name} logo` : "Partner logo"} />
            </span>
            {known && <span className="pgrid-name">{p.name}</span>}
          </>
        );
        return (
          <li key={p.logo}>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="pgrid-tile">
                {tile}
              </a>
            ) : (
              <span className="pgrid-tile">{tile}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListingMedal({ l }: { l: Listing }) {
  return (
    <span className={`lmedal${l.fit === "pad" ? " pad" : ""}`}>
      <img src={l.logo} alt="" loading="lazy" />
    </span>
  );
}

/* Where $ZUBA is listed: notched tiles with each platform's logo in a glowing medallion. */
export function ListingGrid({ items, compact = false }: { items: Listing[]; compact?: boolean }) {
  return (
    <ul className={`lgrid${compact ? " compact" : ""}`}>
      {items.map((l) => (
        <li key={l.id}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="lgrid-tile" aria-label={`$ZUBA on ${l.name} (opens in a new tab)`}>
            <ListingMedal l={l} />
            <span className="lgrid-name">{l.name}</span>
            <span className="lgrid-kind">{l.kind}</span>
            {!compact && <span className="lgrid-detail">{l.detail}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

/* Endless slow strip of platform medallions for the home page. Pauses on hover; static when motion is reduced. */
export function ListingMarquee({ items }: { items: Listing[] }) {
  const row = [...items, ...items];
  return (
    <div className="lmarquee" aria-label="Where $ZUBA is listed">
      <ul className="lmarquee-track">
        {row.map((l, i) => {
          const dup = i >= items.length;
          return (
            <li key={i} className="lmarquee-item" aria-hidden={dup}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" tabIndex={dup ? -1 : 0} aria-label={`$ZUBA on ${l.name}`}>
                <ListingMedal l={l} />
                <span className="lmarquee-name">{l.name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Two endless rows of partner medallions drifting in opposite directions. */
export function PartnerRows({ items }: { items: Partner[] }) {
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];
  return (
    <div className="prows" aria-label="Our partners">
      {rows.map((row, r) => (
        <div key={r} className={`prow ${r === 0 ? "ltr" : "rtl"}`}>
          <ul className="prow-track">
            {[...row, ...row, ...row, ...row].map((p, i) => {
              const dup = i >= row.length;
              const known = p.name !== "Partner";
              return (
                <li key={i} className="prow-item" aria-hidden={dup}>
                  <span className="pgrid-logo">
                    <img src={p.logo} alt={dup ? "" : known ? `${p.name} logo` : "Partner logo"} loading="lazy" />
                  </span>
                  {known && <span className="pgrid-name">{p.name}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
