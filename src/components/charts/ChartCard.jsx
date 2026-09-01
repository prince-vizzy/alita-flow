import { useId, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { INK } from '../../lib/vizTheme';

// The frame every chart on the dashboard sits in: title, one line of context,
// the legend (always present for two or more series, so identity never rests
// on color alone), and a chart/table toggle — the table is the WCAG-clean
// twin, so no value on this page is reachable only by hovering.
export default function ChartCard({ title, subtitle, legend, table, empty, dim, children }) {
  const [view, setView] = useState('chart');
  const headingId = useId();
  const isEmpty = Boolean(empty);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-white/10 bg-[#0d0f12] p-4 sm:p-5 transition-opacity duration-200"
      style={{ opacity: dim ? 0.55 : 1 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-semibold text-white">
            {title}
          </h3>
          {subtitle && <p className="text-[11px] mt-0.5" style={{ color: INK.muted }}>{subtitle}</p>}
        </div>

        {table && !isEmpty && (
          <div className="shrink-0 flex rounded-lg border border-white/10 p-0.5">
            <ToggleButton
              active={view === 'chart'}
              onClick={() => setView('chart')}
              icon={BarChart3}
              label="Chart view"
            />
            <ToggleButton
              active={view === 'table'}
              onClick={() => setView('table')}
              icon={Table2}
              label="Table view"
            />
          </div>
        )}
      </div>

      {legend && legend.length > 1 && !isEmpty && view === 'chart' && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3">
          {legend.map((item) => (
            <li key={item.name} className="flex items-center gap-1.5 text-[11px]" style={{ color: INK.secondary }}>
              <span
                aria-hidden="true"
                className="inline-block shrink-0"
                style={
                  item.shape === 'line'
                    ? { width: 12, height: 2, borderRadius: 999, backgroundColor: item.color }
                    : { width: 10, height: 10, borderRadius: 3, backgroundColor: item.color }
                }
              />
              {item.name}
            </li>
          ))}
        </ul>
      )}

      {isEmpty ? (
        <p className="text-xs py-6 text-center" style={{ color: INK.muted }}>
          {empty}
        </p>
      ) : view === 'table' ? (
        <DataTable {...table} />
      ) : (
        children
      )}
    </section>
  );
}

function ToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="p-1.5 rounded-md transition-colors"
      style={{
        backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: active ? '#ffffff' : INK.muted,
      }}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

// Numbers align vertically here, so this is the one place tabular figures
// belong (stat tiles and the hero keep proportional ones).
export function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 max-h-72 overflow-y-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="sticky top-0 bg-[#0d0f12] py-2 pr-3 font-medium text-left whitespace-nowrap"
                style={{
                  color: INK.muted,
                  textAlign: col.align ?? 'left',
                  borderBottom: `1px solid ${INK.grid}`,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key ?? index}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="py-1.5 pr-3 whitespace-nowrap tabular-nums"
                  style={{
                    color: col.align === 'right' ? INK.primary : INK.secondary,
                    textAlign: col.align ?? 'left',
                    borderBottom: `1px solid ${INK.grid}`,
                  }}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
