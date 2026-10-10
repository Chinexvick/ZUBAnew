import type { ReactNode } from "react";

/* The greatness symbol: triangle over a bar. Used as the letter A in every title. */
export function Delta({ className = "delta" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 19" fill="none" aria-hidden="true">
      <path d="M3.4 13 L10 2.2 L16.6 13 Z" strokeWidth="2" strokeLinejoin="miter" />
      <path d="M1 17.4 H19" strokeWidth="2" />
    </svg>
  );
}

/* Title text with every A inside a word swapped for the greatness symbol (a lone "A" stays a letter).
   Each word is kept whole so lines never break next to a glyph. */
export function ZText({ children }: { children: string }) {
  const isLetter = (c?: string) => !!c && /[a-z0-9]/i.test(c);
  const words = children.split(/(\s+)/);
  return (
    <>
      <span aria-hidden="true">
        {words.map((w, wi) => {
          if (/^\s+$/.test(w)) return w;
          // The name ZUBA is always written in plain letters.
          if (/zuba/i.test(w)) return (
            <span key={wi} className="zword">
              {w}
            </span>
          );
          const chars = w.split("");
          return (
            <span key={wi} className="zword">
              {chars.map((c, i) =>
                (c === "a" || c === "A") && (isLetter(chars[i - 1]) || isLetter(chars[i + 1])) ? <Delta key={i} /> : c
              )}
            </span>
          );
        })}
      </span>
      <span className="sr-only">{children}</span>
    </>
  );
}

/* ZUBA runes: a constructed script, one glyph per Latin letter. */
const RUNE: Record<string, string> = {
  A: "M1 13L5 3l4 10M5 7v2",
  B: "M2 1v12M2 3l5 3-5 3M8 13H4",
  C: "M8 1L3 4v6l5 3M1 7h3",
  D: "M2 1l6 6-6 6M2 4v6",
  E: "M8 1L2 4l6 3-6 3 6 3",
  F: "M2 13V1h6M2 7l5-3",
  G: "M8 2L2 7l6 5M5 7h4",
  H: "M2 1v12M8 1v12M2 9l6-4",
  I: "M5 1v12M3 4l2-3 2 3",
  J: "M7 1v10l-3 2-2-2M5 5h4",
  K: "M8 1v12M8 7L2 1M8 7l-6 6",
  L: "M8 1L2 13h6M5 4h3",
  M: "M1 1l4 6 4-6M1 13l4-6 4 6",
  N: "M2 1v8l6 4V5",
  O: "M5 1l4 6-4 6-4-6zM5 6v2",
  P: "M2 13V1l6 3-6 3M6 10h2",
  Q: "M5 1l4 6-4 6-4-6zM5 7l4 6",
  R: "M2 13V1l6 3-6 3 6 6",
  S: "M8 1L2 5l6 4-6 4",
  T: "M1 5l4-4 4 4M5 1v12",
  U: "M1 1l4 4 4-4M5 5v8M2 13h6",
  V: "M1 1v8l4 4 4-4V1",
  W: "M1 1l4 5 4-5M5 6v7M2 13h6",
  X: "M1 1l8 6-8 6M5 1v12",
  Y: "M1 13l4-6 4 6M5 7V1",
  Z: "M1 1l8 3-8 3 8 3-8 3",
};

export function Runes({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`runes ${className}`} aria-hidden="true">
      {text
        .toUpperCase()
        .split("")
        .map((ch, i) =>
          RUNE[ch] ? (
            <svg key={i} viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square">
              <path d={RUNE[ch]} />
            </svg>
          ) : (
            <span key={i} className="gap" />
          )
        )}
    </span>
  );
}

type DividerVariant = "notched" | "simple" | "diamond";

/* Glowing ornamental divider: fades at both ends, notched drops and a centre diamond. */
export function Divider({ variant = "notched", align = "center" }: { variant?: DividerVariant; align?: "center" | "left" }) {
  const id = `fade-${variant}-${align}`;
  return (
    <div className={`divider ${align === "left" ? "left" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 760 18" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset={align === "left" ? "0.02" : "0.18"} stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="0.82" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="5" width="760" height="1.6" fill={`url(#${id})`} />
        {variant !== "simple" && (
          <g fill="currentColor">
            <path d="M374 5.8 L380 0 L386 5.8 L380 11.6 Z" />
          </g>
        )}
        {variant === "notched" && (
          <g stroke="currentColor" fill="none" strokeWidth="1.4">
            <path d="M210 6.6 h40 l-5 6 h-30 z" />
            <path d="M224 9 l6 3 l6 -3" />
            <path d="M510 6.6 h40 l-5 6 h-30 z" />
            <path d="M524 9 l6 3 l6 -3" />
            <path d="M150 11h18M176 11h6M582 11h6M596 11h18" />
            <path d="M316 1.5v3M321 1.5v3M326 1.5v3M434 1.5v3M439 1.5v3M444 1.5v3" />
          </g>
        )}
        {variant === "diamond" && (
          <g stroke="currentColor" strokeWidth="1.3" fill="none">
            <path d="M350 5.8 l-10 -4 M350 5.8 l-10 4 M410 5.8 l10 -4 M410 5.8 l10 4" />
          </g>
        )}
      </svg>
    </div>
  );
}

/* Rune line + glowing title + divider + optional lead, the standard section header. */
export function Heading({
  runes,
  title,
  size = "lg",
  lead,
  align = "center",
  divider = "notched",
  as: Tag = "h2",
}: {
  runes?: string;
  title: string;
  size?: "xl" | "lg" | "md" | "sm";
  lead?: ReactNode;
  align?: "center" | "left";
  divider?: DividerVariant | false;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <header className={`heading ${align === "center" ? "center" : ""}`}>
      <Runes text={runes ?? title} />
      <Tag className={`t-title ${size}`}>
        <ZText>{title}</ZText>
      </Tag>
      {divider && <Divider variant={divider} align={align} />}
      {lead && <p className="t-lead" style={{ margin: "6px 0 0" }}>{lead}</p>}
    </header>
  );
}

/* Notched frame: rounded card whose stroke breaks at the sides and bottom. */
export function Frame({
  children,
  active,
  hoverable,
  className = "",
  bodyClassName = "frame-body",
  style,
}: {
  children: ReactNode;
  active?: boolean;
  hoverable?: boolean;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`frame ${active ? "active" : ""} ${hoverable ? "hoverable" : ""} ${className}`} style={style}>
      <span className="frame-line" aria-hidden="true" />
      {active && <span className="frame-inner" aria-hidden="true" />}
      <span className="frame-orn frame-orn-b" aria-hidden="true">
        <svg viewBox="0 0 96 6"><path d="M0 3h20M28 3h6M40 3h16M62 3h6M76 3h20" /></svg>
      </span>
      <span className="frame-orn frame-orn-l" aria-hidden="true">
        <svg viewBox="0 0 6 52"><path d="M3 0v8M3 44v8M0 22h6M0 26h6M0 30h6" /></svg>
      </span>
      <span className="frame-orn frame-orn-r" aria-hidden="true">
        <svg viewBox="0 0 6 52"><path d="M3 0v8M3 44v8M0 22h6M0 26h6M0 30h6" /></svg>
      </span>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function Keycap({ k, round }: { k: string; round?: boolean }) {
  return <span className={`keycap ${round ? "round" : ""}`}>{k}</span>;
}

export function Chev({ dir = "right" }: { dir?: "left" | "right" }) {
  return (
    <svg className="chev-ic" width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {dir === "right" ? <path d="M1.5 1.5 L10.5 7 L1.5 12.5 Z" /> : <path d="M10.5 1.5 L1.5 7 L10.5 12.5 Z" />}
    </svg>
  );
}

/* The triangle cursor with a dot, placed at the bottom-right of focused items. */
export function Cursor({ className = "" }: { className?: string }) {
  return (
    <svg className={`cursor ${className}`} width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M3 4 L21 12 L8 21 Z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M8 9 L15 12.5 L10 16 Z" fill="#d58bff" />
      <circle cx="23" cy="23" r="2" fill="#fff" />
    </svg>
  );
}
