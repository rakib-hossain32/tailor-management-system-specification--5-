"use client";

/**
 * Hand-drawn garment diagram on kraft paper. The chalk highlight follows the
 * field the tailor is typing into — the moment that makes entry feel physical.
 */

type Hint =
  | "length"
  | "chest"
  | "bust"
  | "underbust"
  | "waist"
  | "hip"
  | "hem"
  | "shoulder"
  | "sleeve"
  | "cuff"
  | "bicep"
  | "neck"
  | "front_neck_depth"
  | "back_neck_depth"
  | "collar"
  | "collar_height"
  | "armhole"
  | "slit_height"
  | "dart_point"
  | "thigh"
  | "knee"
  | "bottom"
  | "crotch";

const TOP_POINTS: Record<string, { x: number; y: number; label: string; r?: number }> = {
  neck: { x: 100, y: 44, label: "গলা", r: 13 },
  front_neck_depth: { x: 100, y: 58, label: "গলার গভীরতা", r: 11 },
  back_neck_depth: { x: 100, y: 40, label: "পেছনের গলা", r: 11 },
  collar: { x: 100, y: 38, label: "কলার", r: 14 },
  collar_height: { x: 100, y: 34, label: "কলার উচ্চতা", r: 10 },
  shoulder: { x: 132, y: 62, label: "কাঁধ", r: 13 },
  armhole: { x: 140, y: 86, label: "আর্মহোল", r: 13 },
  chest: { x: 100, y: 104, label: "বুক", r: 24 },
  bust: { x: 100, y: 104, label: "বুক/বাস্ট", r: 24 },
  underbust: { x: 100, y: 126, label: "আন্ডারবাস্ট", r: 20 },
  bicep: { x: 156, y: 108, label: "বাইসেপ", r: 14 },
  waist: { x: 100, y: 148, label: "কোমর", r: 20 },
  hip: { x: 100, y: 180, label: "হিপ", r: 24 },
  dart_point: { x: 86, y: 132, label: "ডার্ট", r: 10 },
  sleeve: { x: 168, y: 140, label: "হাতা", r: 14 },
  cuff: { x: 172, y: 168, label: "মুহুরি", r: 12 },
  slit_height: { x: 74, y: 214, label: "স্লিট", r: 12 },
  hem: { x: 100, y: 232, label: "ঘের", r: 20 },
  length: { x: 100, y: 232, label: "লম্বা", r: 20 },
};

const BOTTOM_POINTS: Record<string, { x: number; y: number; label: string; r?: number }> = {
  waist: { x: 100, y: 52, label: "কোমর", r: 22 },
  hip: { x: 100, y: 92, label: "হিপ", r: 24 },
  crotch: { x: 100, y: 124, label: "ক্রচ", r: 16 },
  thigh: { x: 76, y: 158, label: "উরু", r: 18 },
  knee: { x: 78, y: 226, label: "হাঁটু", r: 16 },
  bottom: { x: 78, y: 296, label: "মুহুরি", r: 16 },
  length: { x: 122, y: 296, label: "লম্বা", r: 18 },
};

function topPath(stroke: string) {
  return (
    <>
      <path
        d="M74 46 L58 54 L34 78 L52 96 L64 84 L64 240 L136 240 L136 84 L148 96 L166 78 L142 54 L126 46 C120 62 80 62 74 46 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M100 52 L100 240" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="4 5" opacity="0.5" />
      <path d="M64 148 L136 148" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="4 5" opacity="0.45" />
      <path d="M74 46 C86 66 114 66 126 46" fill="none" stroke={stroke} strokeWidth="1.6" />
      <path d="M64 196 L136 196" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="4 5" opacity="0.45" />
    </>
  );
}

function bottomPath(stroke: string) {
  return (
    <>
      <path
        d="M64 40 L136 40 L142 130 L128 306 L96 306 L100 176 L92 176 L88 306 L56 306 L44 130 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M64 62 L136 62" fill="none" stroke={stroke} strokeWidth="1.6" />
      <path d="M100 62 L100 176" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="4 5" opacity="0.5" />
      <path d="M56 306 L88 306" fill="none" stroke={stroke} strokeWidth="3" />
      <path d="M96 306 L128 306" fill="none" stroke={stroke} strokeWidth="3" />
    </>
  );
}

export function GarmentDiagram({
  kind,
  activeHint,
  activeLabel,
}: {
  kind: "top" | "bottom";
  activeHint?: string;
  activeLabel?: string;
}) {
  const points = kind === "top" ? TOP_POINTS : BOTTOM_POINTS;
  const active = activeHint ? points[activeHint] : undefined;
  const stroke = "#142033";

  return (
    <svg
      viewBox="0 0 200 330"
      className="h-auto w-full max-w-[300px]"
      role="img"
      aria-label={activeLabel ? `${activeLabel} মাপের অবস্থান` : "পোশাকের স্কেচ"}
    >
      <defs>
        <pattern id="kraft" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#EFE5D6" />
          <circle cx="1" cy="1" r="0.5" fill="#D9CBB3" opacity="0.7" />
        </pattern>
      </defs>
      <rect x="4" y="4" width="192" height="322" fill="url(#kraft)" stroke="#D9CBB3" />

      <g className="chalk-draw">{kind === "top" ? topPath(stroke) : bottomPath(stroke)}</g>

      {/* dimension guides */}
      <g stroke="#8A6408" strokeWidth="1" opacity="0.65">
        <line x1="18" y1="46" x2="18" y2={kind === "top" ? 240 : 306} />
        <line x1="14" y1="46" x2="22" y2="46" />
        <line x1="14" y1={kind === "top" ? 240 : 306} x2="22" y2={kind === "top" ? 240 : 306} />
      </g>

      {Object.entries(points).map(([hint, p]) => (
        <g key={hint} opacity={hint === activeHint ? 1 : 0.28}>
          <circle
            cx={p.x}
            cy={p.y}
            r={hint === activeHint ? (p.r ?? 14) + 6 : (p.r ?? 14)}
            fill={hint === activeHint ? "rgba(217,162,27,0.28)" : "none"}
            stroke={hint === activeHint ? "#8A6408" : "#5B6472"}
            strokeWidth={hint === activeHint ? 2 : 1}
            strokeDasharray={hint === activeHint ? "none" : "3 4"}
          />
        </g>
      ))}

      {active && (
        <g>
          <line
            x1={active.x}
            y1={active.y}
            x2={kind === "top" ? 186 : 186}
            y2={active.y}
            stroke="#B23A2E"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
          <text
            x={192}
            y={active.y - 6}
            textAnchor="end"
            fill="#B23A2E"
            fontSize="11"
            fontFamily="'Hind Siliguri', sans-serif"
          >
            {active.label}
          </text>
        </g>
      )}
    </svg>
  );
}
