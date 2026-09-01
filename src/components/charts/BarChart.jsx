import { useState } from 'react';
import { INK, SURFACE } from '../../lib/vizTheme';

// Grouped column chart for 1–4 series over a shared time (or category) axis.
//
// Mark specs come from the dataviz reference: bars capped at 24px with a 4px
// rounded cap and a square baseline, a 2px surface gap between neighbours,
// hairline solid gridlines, and one tooltip per category listing *every*
// series — the reader never has to land on a specific bar to read a value.
const WIDTH = 680;
const PLOT_H = 190;
const PAD = { top: 14, right: 10, bottom: 28, left: 54 };
const HEIGHT = PLOT_H + PAD.top + PAD.bottom;
const BAR_MAX = 24;
const GAP = 2;
const MAX_TICK_LABELS = 12;

function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = value / magnitude;
  const nice = step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10;
  return nice * magnitude;
}

// Square at the baseline, rounded at the data end — a fully rounded bar
// detaches visually from the axis it is measured against.
function barPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height);
  return [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${y + height}`,
    'Z',
  ].join(' ');
}

// Stacked segments: a 2px gap in the surface color does the separating (never
// a stroke), and only the topmost segment carries the rounded cap.
function renderStack(series, ci, x, width, max, bright) {
  const parts = series
    .map((s) => ({ name: s.name, color: s.color, value: s.values[ci] || 0 }))
    .filter((part) => part.value > 0);

  let baseline = PAD.top + PLOT_H;
  return parts.map((part, k) => {
    const raw = (part.value / max) * PLOT_H;
    const gap = k > 0 ? GAP : 0;
    const height = Math.max(raw - gap, 1.5);
    const top = baseline - raw + gap;
    baseline -= raw;
    const isTop = k === parts.length - 1;
    return (
      <path
        key={part.name}
        d={
          isTop
            ? barPath(x, top, width, height, 4)
            : `M${x},${top} h${width} v${height} h${-width} Z`
        }
        fill={part.color}
        opacity={bright ? 1 : 0.45}
      />
    );
  });
}

export default function BarChart({
  categories,
  series,
  valueFormatter = (v) => v.toLocaleString(),
  ariaLabel = 'Bar chart',
  // Stack the series into one column per category (part-to-whole) instead of
  // standing them side by side. Side-by-side wins for comparing a handful of
  // categories; past a couple of weeks of days it turns into a picket fence.
  stacked = false,
}) {
  const [active, setActive] = useState(null); // category index | null

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const totals = categories.map((_, ci) => series.reduce((sum, s) => sum + (s.values[ci] || 0), 0));
  const max = niceMax(Math.max(1, ...(stacked ? totals : series.flatMap((s) => s.values))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  const count = categories.length;
  const slotWidth = plotWidth / count;
  const barWidth = stacked
    ? Math.max(1.5, Math.min(BAR_MAX, slotWidth * 0.72))
    : Math.max(1.5, Math.min(BAR_MAX, (slotWidth * 0.72 - GAP * (series.length - 1)) / series.length));
  const groupWidth = stacked ? barWidth : barWidth * series.length + GAP * (series.length - 1);

  const y = (v) => PAD.top + PLOT_H * (1 - v / max);
  const labelStep = Math.ceil(count / MAX_TICK_LABELS);

  // Only ever one direct label: the tallest column. Everything else is
  // carried by the axis, the tooltip and the table view.
  const headline = stacked ? totals : series[0].values;
  const peak = headline.reduce((best, v, i) => (v > headline[best] ? i : best), 0);
  const showPeakLabel = headline[peak] > 0;

  const describe = (index) =>
    `${categories[index]}: ${series
      .map((s) => `${s.name} ${valueFormatter(s.values[index] || 0)}`)
      .join(', ')}${stacked && series.length > 1 ? `, total ${valueFormatter(totals[index])}` : ''}`;

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

        {categories.map((category, ci) => {
          const slotX = PAD.left + ci * slotWidth;
          const groupStart = slotX + (slotWidth - groupWidth) / 2;
          const isActive = active === ci;

          return (
            <g key={`${category}-${ci}`}>
              {isActive && (
                <rect
                  x={slotX}
                  y={PAD.top}
                  width={slotWidth}
                  height={PLOT_H}
                  fill="rgba(255,255,255,0.04)"
                />
              )}

              {stacked
                ? renderStack(series, ci, groupStart, barWidth, max, active === null || isActive)
                : series.map((s, si) => {
                    const value = s.values[ci] || 0;
                    if (value <= 0) return null;
                    // Keep a hairline of a bar for real-but-tiny values, so a
                    // 20-bob sale on a 20,000 axis still reads as "something".
                    const height = Math.max((value / max) * PLOT_H, 2);
                    return (
                      <path
                        key={s.name}
                        d={barPath(
                          groupStart + si * (barWidth + GAP),
                          PAD.top + PLOT_H - height,
                          barWidth,
                          height,
                          4
                        )}
                        fill={s.color}
                        opacity={active === null || isActive ? 1 : 0.45}
                      />
                    );
                  })}

              {ci % labelStep === 0 && (
                <text
                  x={slotX + slotWidth / 2}
                  y={HEIGHT - PAD.bottom + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill={INK.muted}
                >
                  {category}
                </text>
              )}

              {/* One hit target per category, full plot height — bigger than
                  the marks, so nobody has to aim at a 6px column. */}
              <rect
                x={slotX}
                y={PAD.top}
                width={slotWidth}
                height={PLOT_H}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={describe(ci)}
                onPointerEnter={() => setActive(ci)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(ci)}
                onBlur={() => setActive(null)}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            </g>
          );
        })}

        {showPeakLabel && (
          <text
            x={PAD.left + peak * slotWidth + slotWidth / 2}
            y={y(headline[peak]) - 6}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill={INK.secondary}
          >
            {valueFormatter(headline[peak])}
          </text>
        )}
      </svg>

      {active !== null && (
        <Tooltip
          x={(PAD.left + (active + 0.5) * slotWidth) / WIDTH}
          title={categories[active]}
          rows={[
            ...series.map((s) => ({
              name: s.name,
              color: s.color,
              value: valueFormatter(s.values[active] || 0),
            })),
            ...(stacked && series.length > 1
              ? [{ name: 'Total', color: 'transparent', value: valueFormatter(totals[active]) }]
              : []),
          ]}
        />
      )}
    </div>
  );
}

// Shared by the bar and trend charts: value leads, series name follows, and
// identity is a short stroke of the series color rather than a filled box.
export function Tooltip({ x, title, rows }) {
  const left = Math.min(Math.max(x * 100, 12), 88);
  return (
    <div
      className="absolute top-1 pointer-events-none z-10 rounded-xl border border-white/10 px-3 py-2 shadow-xl"
      style={{ left: `${left}%`, transform: 'translateX(-50%)', backgroundColor: SURFACE }}
    >
      <p className="text-[10px] mb-1 whitespace-nowrap" style={{ color: INK.muted }}>
        {title}
      </p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-2 whitespace-nowrap text-xs">
          <span
            aria-hidden="true"
            className="inline-block shrink-0"
            style={{ width: 10, height: 2, borderRadius: 999, backgroundColor: row.color }}
          />
          <span className="font-semibold text-ink tabular-nums">{row.value}</span>
          <span style={{ color: INK.muted }}>{row.name}</span>
        </p>
      ))}
    </div>
  );
}
