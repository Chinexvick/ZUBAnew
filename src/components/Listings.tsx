import type { Partner } from "@/lib/site";

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
