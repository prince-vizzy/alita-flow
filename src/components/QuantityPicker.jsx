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
              className="min-w-9 h-9 shrink-0 rounded-full px-2 text-sm font-semibold transition-colors"
              style={
                active
                  ? { backgroundColor: accent, color: '#000' }
                  : { backgroundColor: '#1a1a1a', color: '#9ca3af', border: '1px solid #2a2a2a' }
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
        className="w-full max-w-[11rem] bg-[#d9d9d9] text-black text-sm font-medium py-2.5 px-4 rounded-full focus:outline-none text-center"
      />
    </div>
  );
}
