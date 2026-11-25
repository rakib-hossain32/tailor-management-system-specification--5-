/** Hand-drawn brand mark: a needle threading a tape-measure loop. */
export function Logo({ size = 40, className = "", label = "দোকানের লোগো" }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label}
    >
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* tape ticks around the ring */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 24;
        const inner = i % 3 === 0 ? 15.5 : 18;
        return (
          <line
            key={i}
            x1={Number((24 + Math.cos(a) * inner).toFixed(3))}
            y1={Number((24 + Math.sin(a) * inner).toFixed(3))}
            x2={Number((24 + Math.cos(a) * 21).toFixed(3))}
            y2={Number((24 + Math.sin(a) * 21).toFixed(3))}
            stroke="currentColor"
            strokeWidth={i % 3 === 0 ? 1.6 : 0.9}
            opacity={i % 3 === 0 ? 0.9 : 0.55}
          />
        );
      })}
      {/* needle */}
      <path
        d="M14 34 L31 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <ellipse
        cx="32.4"
        cy="15.6"
        rx="2.6"
        ry="1.6"
        transform="rotate(-45 32.4 15.6)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* thread */}
      <path
        d="M14 34 C 10 30, 16 26, 13 22 C 11 19, 15 17, 18 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
