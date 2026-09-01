import { DIVERGING, INK } from '../../lib/vizTheme';

// Horizontal ranked bars. One hue for a plain magnitude ranking; the
// blue/red diverging pair when values cross zero, drawn from a centre
// baseline so "made money" and "cost money" read as opposite directions
// rather than as two lengths of the same bar.
//
// Values are direct-labelled at the row end, so this form needs no tooltip:
// every number is already on screen.
export default function RankedBarChart({ items, color, valueFormatter, diverging = false, caption }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));

  return (
    <div className="w-full flex flex-col gap-2">
      {items.map((item) => {
        const share = Math.abs(item.value) / max;
        const negative = item.value < 0;
        const fill = diverging ? (negative ? DIVERGING.negative : DIVERGING.positive) : color;
        // Half the track per side once the axis is centred.
        const width = `${Math.max(share * (diverging ? 50 : 100), 1.5)}%`;

        return (
          <div
            key={item.name}
            tabIndex={0}
            className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            aria-label={`${item.name}: ${valueFormatter(item.value)}${item.note ? `, ${item.note}` : ''}`}
          >
            <span
              className="w-24 sm:w-32 shrink-0 text-[11px] truncate text-right"
              style={{ color: INK.secondary }}
              title={item.name}
            >
              {item.name}
            </span>

            <div className="relative flex-1 h-4 min-w-0">
              {diverging && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-1/2 w-px"
                  style={{ backgroundColor: INK.axis }}
                />
              )}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 block transition-opacity group-hover:opacity-100 opacity-90"
                style={{
                  width,
                  backgroundColor: fill,
                  ...(diverging
                    ? negative
                      ? { right: '50%', borderRadius: '4px 0 0 4px' }
                      : { left: '50%', borderRadius: '0 4px 4px 0' }
                    : { left: 0, borderRadius: '0 4px 4px 0' }),
                }}
              />
            </div>

            <span className="w-16 sm:w-20 shrink-0 text-right text-[11px] font-medium text-white tabular-nums">
              {valueFormatter(item.value)}
            </span>
          </div>
        );
      })}

      {caption && (
        <p className="text-[10px] mt-1" style={{ color: INK.muted }}>
          {caption}
        </p>
      )}
    </div>
  );
}
