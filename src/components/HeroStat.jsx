import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import Sparkline from './charts/Sparkline';
import { INK, STATUS, formatPercent } from '../lib/vizTheme';

// The one number the panel leads with, at hero size in the same sans as
// everything else, with the two figures it's made of underneath and the
// shape of how it got there beside it.
export default function HeroStat({ label, value, caption, delta, deltaLabel, breakdown, spark, tone }) {
  const flat = delta != null && Math.abs(delta) < 0.005;
  const up = (delta ?? 0) > 0;
  const DeltaIcon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const deltaColor = flat ? INK.muted : up ? STATUS.good : STATUS.critical;

  return (
    <div className="glass rounded-[26px] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[11px]" style={{ color: INK.muted }}>
          {label}
        </p>
        <p
          className="text-4xl sm:text-5xl font-semibold leading-none mt-1.5"
          style={{ color: tone ? STATUS[tone] : INK.primary }}
        >
          {value}
        </p>

        {delta != null && (
          <p className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: deltaColor }}>
            <DeltaIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="font-medium">
              {flat ? 'No change' : `${up ? '+' : '−'}${formatPercent(Math.abs(delta))}`}
            </span>
            {deltaLabel && <span style={{ color: INK.muted }}>{deltaLabel}</span>}
          </p>
        )}

        {caption && (
          <p className="mt-2 text-[11px]" style={{ color: INK.muted }}>
            {caption}
          </p>
        )}

        {breakdown && (
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {breakdown.map((entry) => (
              <li key={entry.label} className="flex items-center gap-1.5 text-[11px]">
                <span
                  aria-hidden="true"
                  className="inline-block shrink-0"
                  style={{ width: 10, height: 2, borderRadius: 999, backgroundColor: entry.color }}
                />
                <span style={{ color: INK.muted }}>{entry.label}</span>
                <span className="font-medium text-ink tabular-nums">{entry.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {spark && spark.values.length > 1 && (
        <div className="w-full sm:w-48 shrink-0">
          <Sparkline values={spark.values} color={spark.color} label={spark.label} />
        </div>
      )}
    </div>
  );
}
