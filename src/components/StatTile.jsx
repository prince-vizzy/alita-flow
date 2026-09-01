import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { INK, STATUS, formatPercent } from '../lib/vizTheme';

// KPI tile: label (sentence case, no colon), the value in proportional
// figures, an optional change against the previous window, and one line of
// context underneath.
//
// `tone` colors the value from the fixed status palette only — never a chart
// categorical color, so a tile can't be mistaken for a series. The change cue
// always ships as arrow + wording, so the color is never carrying it alone.
export default function StatTile({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  delta,
  deltaLabel,
  // On spend-style tiles, up is the bad direction.
  invertDelta = false,
}) {
  return (
    <div className="glass rounded-[22px] px-3.5 py-3">
      <p className="text-[11px] flex items-center gap-1.5" style={{ color: INK.muted }}>
        {Icon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
        {label}
      </p>
      <p
        className="text-xl font-semibold mt-1 leading-tight"
        style={{ color: tone ? STATUS[tone] : INK.primary }}
      >
        {value}
      </p>

      {delta != null && <Delta value={delta} label={deltaLabel} invert={invertDelta} />}
      {hint && (
        <p className="text-[10px] mt-1" style={{ color: INK.muted }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Delta({ value, label, invert }) {
  const flat = Math.abs(value) < 0.005;
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const color = flat ? INK.muted : good ? STATUS.good : STATUS.critical;
  const sign = flat ? '' : up ? '+' : '−';

  return (
    <p className="mt-1 flex items-center gap-1 text-[10px]" style={{ color }}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="font-medium">
        {flat ? 'No change' : `${sign}${formatPercent(Math.abs(value))}`}
      </span>
      {label && <span style={{ color: INK.muted }}>{label}</span>}
    </p>
  );
}
