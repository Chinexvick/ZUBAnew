/* Tokenomics ring. Segments are drawn with stroke-dasharray on one circle per slice. */
const COLORS = ["#c86bff", "#ffb627", "#7ab0ff", "#ff8a4c"];

export default function Donut({ slices, center }: { slices: { label: string; pct: number }[]; center: React.ReactNode }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = 1.2; // % of circumference between slices
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={slices.map((s) => `${s.label} ${s.pct}%`).join(", ")}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(203,189,240,0.08)" strokeWidth="9" />
        {slices.map((s, i) => {
          const len = (Math.max(s.pct - gap, 0.5) / 100) * c;
          const el = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth="9"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-((offset + gap / 2) / 100) * c}
              transform="rotate(-90 50 50)"
              style={{ filter: `drop-shadow(0 0 2.5px ${COLORS[i % COLORS.length]})` }}
            />
          );
          offset += s.pct;
          return el;
        })}
      </svg>
      <div className="donut-center">{center}</div>
    </div>
  );
}

export const donutColors = COLORS;
