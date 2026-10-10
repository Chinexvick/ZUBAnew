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
