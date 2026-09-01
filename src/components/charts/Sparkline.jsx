import { INK, SURFACE } from '../../lib/vizTheme';

// A trend shape, not a chart: no axes, no labels, no hover. It rides along a
// hero figure to say "and here is how it got there" — the real numbers live
// in the trend chart below.
const WIDTH = 220;
const HEIGHT = 44;

export default function Sparkline({ values, color, label }) {
  const points = values.length ? values : [0];
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const span = max - min || 1;
  const x = (i) => (points.length === 1 ? WIDTH / 2 : (WIDTH * i) / (points.length - 1));
  const y = (v) => HEIGHT - 4 - ((v - min) / span) * (HEIGHT - 8);

  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-11"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path d={`M${x(0)},${HEIGHT} ${line.slice(1)} L${x(points.length - 1)},${HEIGHT} Z`} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="0" x2={WIDTH} y1={y(0)} y2={y(0)} stroke={INK.grid} strokeWidth="1" />
      <circle
        cx={x(points.length - 1)}
        cy={y(points[points.length - 1])}
        r={3.5}
        fill={color}
        stroke={SURFACE}
        strokeWidth="2"
      />
    </svg>
  );
}
