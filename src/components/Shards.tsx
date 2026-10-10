/* Shattered-triangle image mosaic: one image split into glowing glass shards. */
const LAYOUT = [
  { clip: "polygon(0% 30%, 46% 0%, 52% 78%)", dx: -10, dy: 6 },
  { clip: "polygon(46% 0%, 100% 6%, 52% 78%)", dx: 4, dy: -10 },
  { clip: "polygon(100% 6%, 96% 70%, 52% 78%)", dx: 12, dy: 2 },
  { clip: "polygon(0% 30%, 52% 78%, 8% 100%)", dx: -14, dy: 10 },
  { clip: "polygon(52% 78%, 96% 70%, 70% 100%)", dx: 8, dy: 12 },
  { clip: "polygon(8% 100%, 52% 78%, 70% 100%)", dx: -2, dy: 16 },
];

export default function Shards({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`shard-mosaic ${className}`} role="img" aria-label={alt}>
      {LAYOUT.map((s, i) => (
        <span key={i} className="shard-wrap" style={{ transform: `translate(${s.dx}px, ${s.dy}px)` }}>
          <span className="shard" style={{ clipPath: s.clip, backgroundImage: src ? `url(${src})` : undefined }} />
        </span>
      ))}
      <span className="shard-chip a" />
      <span className="shard-chip b" />
      <span className="shard-chip c" />
    </div>
  );
}
