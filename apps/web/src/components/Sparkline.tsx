/**
 * Sparkline sebagai SVG polyline murni — tanpa library chart, karena yang
 * dibutuhkan cuma bentuk kasarnya di ruang 96×28.
 */
export function Sparkline({
  points,
  tone,
  width = 96,
  height = 28,
}: {
  points: number[];
  tone: 'up' | 'down' | 'flat';
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <div style={{ width, height }} aria-hidden />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;

  const coords = points.map((value, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const stroke = tone === 'up' ? '#6EE787' : tone === 'down' ? '#FF8080' : '#6E6E6E';
  const gradientId = `spark-${tone}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${coords.join(' ')} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={coords.join(' ')}
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
