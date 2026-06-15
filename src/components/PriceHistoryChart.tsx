"use client";

interface Series {
  label: string;
  color: string;
  points: { date: string; value: number | null }[];
}

interface Props {
  series: Series[];
  height?: number;
  unit?: string;
}

/**
 * Dependency-free SVG line chart for 30-day price history. Skips missing days
 * rather than drawing them as zero. Used by the /history page and reusable for
 * a per-station sparkline.
 */
export default function PriceHistoryChart({ series, height = 180, unit = "¢/L" }: Props) {
  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v != null);

  if (values.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-10 text-center">
        No history yet — daily snapshots build up over the coming days.
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const W = 600;
  const H = height;
  const padL = 6;
  const padR = 6;
  const padT = 8;
  const padB = 18;
  const n = series[0]?.points.length ?? 0;

  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  const gridVals = [hi, (hi + lo) / 2, lo];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="30-day price history">
        {gridVals.map((v, idx) => (
          <g key={idx}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padL} y={y(v) - 2} fontSize={10} fill="#9ca3af">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.points
            .map((p, i) => (p.value == null ? null : `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`))
            .filter((p): p is string => p !== null)
            .join(" ");
          return (
            <polyline
              key={s.label}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="flex gap-4 mt-1 text-xs text-gray-600">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-0.5" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-gray-400">{unit}</span>
      </div>
    </div>
  );
}
