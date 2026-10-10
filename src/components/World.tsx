/* Fixed backdrop: violet gradient, giant faint greatness triangles and grain. */
export default function World() {
  return (
    <div className="world" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="rgba(203,189,240,0.05)" strokeWidth="2">
          <path d="M-120 860 L280 120 L680 860 Z" />
          <path d="M820 900 L1180 260 L1540 900 Z" />
          <path d="M-160 900 H760" />
        </g>
        <g fill="rgba(150,70,255,0.05)">
          <path d="M980 -40 L1260 470 L700 470 Z" />
          <path d="M120 -60 L330 300 L-90 300 Z" />
        </g>
      </svg>
    </div>
  );
}
