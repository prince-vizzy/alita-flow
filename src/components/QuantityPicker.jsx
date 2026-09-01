// Quick-pick buttons for the common case, with a number input right below
// for anything else — covers the actual distribution of trolley quantities
// (or prices, via `options`) without forcing a scroll through a long
// dropdown every time.
const DEFAULT_OPTIONS = [1, 2, 3, 4, 5];

export default function QuantityPicker({
  value,
  onChange,
  accent,
  options = DEFAULT_OPTIONS,
  placeholder = 'Or type a number',
}) {
  return (
    <div className="w-full flex flex-col items-center gap-2.5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {options.map((n) => {
          const active = String(value) === String(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              aria-pressed={active}
              className="min-w-10 h-10 shrink-0 rounded-2xl px-2.5 text-sm font-semibold transition-colors border"
              style={
                active
                  ? {
                      backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`,
                      borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
                      color: accent,
                    }
                  : {
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: 'var(--color-ink-3)',
                    }
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full max-w-[13rem] rounded-full border border-white/12 bg-white/[0.06] text-ink placeholder:text-ink-3/70 text-sm py-2.5 px-4 text-center focus:outline-none focus:border-white/25"
      />
    </div>
  );
}
