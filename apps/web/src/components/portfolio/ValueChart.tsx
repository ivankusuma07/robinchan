import type { PortfolioPoint } from '@robinchan/shared';
import { formatPrice } from '@robinchan/shared';

/**
 * Portfolio value over time (plan §7): one accent line with a soft gradient
 * under it. The series starts at the wallet's first snapshot — there is no
 * back-filled history from before Robinchan first saw the wallet, since that
 * would be a fabricated line.
 */
export function ValueChart({
  points,
  height = 220,
}: {
  points: PortfolioPoint[];
  height?: number;
}) {
  const width = 1000; // viewBox units; the SVG scales to its container.

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-text-3"
        style={{ height }}
      >
        The chart starts after the first daily snapshot.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 12;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={`Portfolio value from ${formatPrice(values[0])} to ${formatPrice(values[values.length - 1])}`}
      >
        <defs>
          <linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A3E635" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#D4F450" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${line} ${width},${height}`} fill="url(#portfolio-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#65A30D"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-text-3">
        <span>{formatPrice(min)}</span>
        <span>{formatPrice(max)}</span>
      </div>
    </div>
  );
}
