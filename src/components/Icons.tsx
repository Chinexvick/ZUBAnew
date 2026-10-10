/* Line icons used across the token page and medallions. 24×24, stroke = currentColor. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const paths: Record<string, React.ReactNode> = {
  watch: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M3 8l2.5-4.5h3L6 8M10 8l2.5-4.5h3L13 8M17 8l2.5-4.5H21" />
      <path d="M10.5 11.5v5l4-2.5z" />
    </>
  ),
  read: (
    <>
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
      <path d="M12 6.5V19.5" />
    </>
  ),
  play: (
    <>
      <path d="M7 8h10a4 4 0 0 1 3.9 4.8l-1 4.6a2.2 2.2 0 0 1-3.8 1L14 16h-4l-2.1 2.4a2.2 2.2 0 0 1-3.8-1l-1-4.6A4 4 0 0 1 7 8z" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="16" cy="11.5" r=".6" fill="currentColor" />
      <circle cx="17.5" cy="13.5" r=".6" fill="currentColor" />
    </>
  ),
  own: (
    <>
      <path d="M6 4h12l3 5-9 11L3 9z" />
      <path d="M3 9h18M9 4l3 16 3-16" />
    </>
  ),
  gather: (
    <>
      <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />
      <path d="M14 7v10" strokeDasharray="1.5 2" />
    </>
  ),
  compete: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  speak: (
    <>
      <path d="M4 5h11v8H9l-4 3v-3H4z" />
      <path d="M13 16h3l4 3v-3h0V9h-2" />
      <path d="M7 9h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  id: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.3" />
      <path d="M5.5 16.5c.7-1.8 2-2.6 3.5-2.6s2.8.8 3.5 2.6M14.5 10h4M14.5 13h3" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z" />
      <path d="M4 7l11-3v3M16 13.5h4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  chart: <path d="M4 19h16M6 16l4-5 3 3 5-7" />,
  scroll: (
    <>
      <path d="M7 4h11a2 2 0 0 1 2 2v1h-4M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
      <path d="M9 9h7M9 12h7M9 15h5" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

export function Icon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...P}>
      {paths[name]}
    </svg>
  );
}
