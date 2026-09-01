import { useState } from 'react';
import { INK, SURFACE } from '../../lib/vizTheme';
import { Tooltip } from './BarChart';

// Line chart for change over time — 2px strokes, a 10% wash under a lone
// series, an end marker ringed in the surface color, and a crosshair that
// snaps to the nearest date and reads out every series at once.
const WIDTH = 680;
const PLOT_H = 190;
const PAD = { top: 14, right: 14, bottom: 28, left: 54 };
const HEIGHT = PLOT_H + PAD.top + PAD.bottom;
const MAX_TICK_LABELS = 12;

function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = value / magnitude;
  const nice = step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10;
  return nice * magnitude;
}

export default function TrendChart({
  categories,
  series,
  valueFormatter = (v) => v.toLocaleString(),
  ariaLabel = 'Line chart',
}) {
  const [active, setActive] = useState(null);

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const count = categories.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  const x = (i) => (count === 1 ? PAD.left + plotWidth / 2 : PAD.left + (plotWidth * i) / (count - 1));
  const y = (v) => PAD.top + PLOT_H * (1 - v / max);
  const labelStep = Math.ceil(count / MAX_TICK_LABELS);
  const slotWidth = plotWidth / Math.max(count, 1);

  const describe = (index) =>
    `${categories[index]}: ${series
      .map((s) => `${s.name} ${valueFormatter(s.values[index] || 0)}`)
      .join(', ')}`;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 0 ? INK.axis : INK.grid}
            strokeWidth="1"
          />
        ))}
        {ticks.map((t) => (
          <text
            key={t}
            x={PAD.left - 8}
            y={y(t) + 3.5}
            textAnchor="end"
            fontSize="10"
            fill={INK.muted}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {valueFormatter(t)}
          </text>
        ))}

        {series.length === 1 && count > 1 && (
          <path
            d={`M${x(0)},${PAD.top + PLOT_H} ${series[0].values
              .map((v, i) => `L${x(i)},${y(v)}`)
              .join(' ')} L${x(count - 1)},${PAD.top + PLOT_H} Z`}
            fill={series[0].color}
            opacity={0.1}
          />
        )}

        {series.map((s) => (
          <g key={s.name}>
            {count > 1 ? (
              <path
                d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={active === null ? 1 : 0.75}
              />
            ) : null}
            {/* End marker, ringed in the surface color so it stays readable
                where two series finish on top of each other. */}
            <circle
              cx={x(count - 1)}
              cy={y(s.values[count - 1] || 0)}
              r={4}
              fill={s.color}
              stroke={SURFACE}
              strokeWidth="2"
            />
          </g>
        ))}

        {active !== null && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke={INK.axis}
              strokeWidth="1"
            />
            {series.map((s) => (
              <circle
                key={s.name}
                cx={x(active)}
                cy={y(s.values[active] || 0)}
                r={4}
                fill={s.color}
                stroke={SURFACE}
                strokeWidth="2"
              />
            ))}
          </g>
        )}

        {categories.map((category, i) =>
          i % labelStep === 0 ? (
            <text
              key={`${category}-${i}`}
              x={x(i)}
              y={HEIGHT - PAD.bottom + 15}
              textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}
              fontSize="10"
              fill={INK.muted}
            >
              {category}
            </text>
          ) : null
        )}

        {/* The crosshair finds the X: one full-height hit band per date, so
            the pointer only has to be closest, never on the line. */}
        {categories.map((category, i) => (
          <rect
            key={`hit-${category}-${i}`}
            x={PAD.left + i * slotWidth}
            y={PAD.top}
            width={slotWidth}
            height={PLOT_H}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={describe(i)}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            style={{ cursor: 'crosshair', outline: 'none' }}
          />
        ))}
      </svg>

      {active !== null && (
        <Tooltip
          x={x(active) / WIDTH}
          title={categories[active]}
          rows={series.map((s) => ({
            name: s.name,
            color: s.color,
            value: valueFormatter(s.values[active] || 0),
          }))}
        />
      )}
    </div>
  );
}
