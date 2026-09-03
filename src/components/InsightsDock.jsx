import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Send, X } from 'lucide-react';
import logo from '../assets/logo.svg';
import { askDashboard, summarizeDashboard } from '../lib/geminiApi';
import { INK, STATUS } from '../lib/vizTheme';

// Gemini as a presence in the corner rather than a card in the page: the
// Alita Flow mark sits bottom-right, offers what it makes of the range on
// screen in a speech bubble, and opens into a conversation about that same
// slice when tapped.
//
// A thread belongs to one slice (section + range + refresh). Change the range
// and the answers still on screen would describe numbers that are no longer
// there, so the thread goes with it.

const PLACEHOLDERS = {
  shop: 'Which items should I reorder first?',
  trolley: 'Am I cooking too much on quiet days?',
};

// The popover surface, repeated here for the bubble tail — a rotated square
// only lines up with the bubble if it is painted the same solid color.
const SURFACE = '#16241d';
const HAIRLINE = '1px solid rgba(255, 255, 255, 0.14)';

let lastId = 0;
const nextId = () => (lastId += 1);

export default function InsightsDock({ section, cacheKey, digest, accent }) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState([]);
  const [summaryState, setSummaryState] = useState('idle'); // idle | loading | error
  const [error, setError] = useState(null);
  const [peekDismissed, setPeekDismissed] = useState(false);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState(null);

  // Summaries already paid for, keyed by the slice they describe, so going
  // back to a range already looked at costs nothing.
  const cache = useRef(new Map());
  const inFlight = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const opener = thread.find((m) => m.role === 'assistant');

  const runSummary = useCallback(
    async (key, force = false) => {
      // Writing it again restarts the conversation: what was asked before was
      // asked of a reading that no longer stands.
      if (!force && cache.current.has(key)) {
        setThread([{ id: nextId(), role: 'assistant', text: cache.current.get(key) }]);
        setSummaryState('idle');
        setError(null);
        return;
      }

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setSummaryState('loading');
      setError(null);
      try {
        const text = await summarizeDashboard(digest, controller.signal);
        if (controller.signal.aborted) return;
        cache.current.set(key, text);
        setThread([{ id: nextId(), role: 'assistant', text }]);
        setSummaryState('idle');
      } catch (err) {
        if (controller.signal.aborted || err.name === 'AbortError') return;
        setError(err.message);
        setSummaryState('error');
      }
    },
    [digest]
  );

  useEffect(() => {
    setThread([]);
    setAskError(null);
    setPeekDismissed(false);
    runSummary(cacheKey);
    // runSummary changes with every digest rebuild; the slice key is what
    // decides whether this is worth another call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => () => inFlight.current?.abort(), []);

  // Newest turn in view, the way a conversation reads.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread, asking, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function handleAsk(e) {
    e.preventDefault();
    const asked = question.trim();
    if (!asked || asking) return;

    setThread((prev) => [...prev, { id: nextId(), role: 'user', text: asked }]);
    setQuestion('');
    setAsking(true);
    setAskError(null);
    try {
      const text = await askDashboard(digest, asked);
      setThread((prev) => [...prev, { id: nextId(), role: 'assistant', text }]);
    } catch (err) {
      setAskError(err.message);
    } finally {
      setAsking(false);
    }
  }

  const busy = summaryState === 'loading' || asking;

  return (
    <>
      {/* What it made of the range, offered rather than inserted — it can be
          waved away without opening anything. */}
      {!open && opener && !peekDismissed && (
        <div className="fixed z-40 bottom-24 right-5 w-[min(17rem,calc(100vw-2.5rem))]">
          <div className="popover relative rounded-[20px] pl-4 pr-9 py-3.5">
            <button
              onClick={() => setPeekDismissed(true)}
              className="absolute top-2.5 right-2.5 text-ink-3 hover:text-ink transition-colors"
              aria-label="Dismiss note"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <button onClick={() => setOpen(true)} className="block w-full text-left">
              <p
                className="text-[13px] leading-relaxed line-clamp-4"
                style={{ color: INK.secondary }}
              >
                {opener.text}
              </p>
              <span className="mt-2 block text-[10px]" style={{ color: accent }}>
                Tap to ask about it
              </span>
            </button>

            <span
              aria-hidden="true"
              className="absolute -bottom-[7px] right-7 w-3.5 h-3.5 rotate-45"
              style={{ backgroundColor: SURFACE, borderRight: HAIRLINE, borderBottom: HAIRLINE }}
            />
          </div>
        </div>
      )}

      {/* The dialogue space. Opaque like the app's other floating surfaces —
          glass over a page of charts is unreadable. */}
      {open && (
        <div
          role="dialog"
          aria-label={`Ask Gemini about the ${section} numbers`}
          className="popover fixed z-40 inset-x-3 bottom-24 sm:left-auto sm:right-5 sm:w-[26rem] rounded-[26px] flex flex-col max-h-[68dvh]"
        >
          <header className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
            <span className="photo-tile w-7 h-7 rounded-full p-1 shrink-0 grid place-items-center">
              <img src={logo} alt="" className="w-full h-full object-contain" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-ink leading-tight">
                Alita Flow
              </span>
              <span className="block text-[10px]" style={{ color: INK.muted }}>
                Reading the {section} numbers on screen
              </span>
            </span>
            <button
              onClick={() => runSummary(cacheKey, true)}
              disabled={busy}
              className="p-1.5 rounded-full text-ink-3 hover:text-ink transition-colors disabled:opacity-40"
              aria-label="Read the period again"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${summaryState === 'loading' ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 -mr-1 rounded-full text-ink-3 hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-2.5"
            aria-live="polite"
          >
            {thread.map((message) => (
              <Bubble key={message.id} role={message.role} text={message.text} accent={accent} />
            ))}

            {busy && <Typing />}

            {summaryState === 'error' && <Problem text={error} />}
            {askError && <Problem text={askError} />}
          </div>

          <form onSubmit={handleAsk} className="flex items-center gap-2 px-3 pb-3 pt-1">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder={PLACEHOLDERS[section] ?? 'Ask about this period…'}
              aria-label={`Ask about the ${section} numbers on screen`}
              className="flex-1 min-w-0 rounded-full border border-white/12 bg-white/[0.06] text-sm text-ink placeholder:text-ink-3/70 py-2.5 px-4 focus:outline-none focus:border-white/25"
            />
            <button
              type="submit"
              disabled={!question.trim() || asking}
              className="shrink-0 w-10 h-10 rounded-full grid place-items-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`,
                color: accent,
              }}
              aria-label="Ask"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <p className="px-4 pb-3 text-[10px]" style={{ color: INK.muted }}>
            Written from the figures on this page. Check anything you'd act on.
          </p>
        </div>
      )}

      {/* The mark itself is the handle. The bob lives on the wrapper so the
          button is free to use transform for its own press feedback. */}
      <span className={`fixed z-40 bottom-5 right-5 ${open ? '' : 'dock-bob'}`}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={open ? 'Close Alita Flow insights' : 'Ask Alita Flow about these numbers'}
          className="glass-strong relative block w-14 h-14 rounded-full grid place-items-center shadow-2xl transition-transform duration-200 active:scale-95 hover:bg-white/[0.13]"
          style={{ borderColor: `color-mix(in srgb, ${accent} 34%, transparent)` }}
        >
          <span className="photo-tile w-9 h-9 rounded-full p-1.5 grid place-items-center">
            <img src={logo} alt="" className="w-full h-full object-contain" />
          </span>
          {summaryState === 'loading' && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full animate-ping"
              style={{ border: `1px solid ${accent}`, opacity: 0.35 }}
            />
          )}
        </button>
      </span>
    </>
  );
}

function Bubble({ role, text, accent }) {
  const mine = role === 'user';
  // The model is asked for plain sentences; it still breaks them into
  // paragraphs, so keep those and drop any bullet character it adds.
  const paragraphs = text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);

  return (
    <div
      className={`max-w-[88%] px-3.5 py-2.5 border ${
        mine
          ? 'self-end rounded-[18px] rounded-br-[6px]'
          : 'self-start rounded-[18px] rounded-bl-[6px] border-white/10 bg-white/[0.05]'
      }`}
      style={
        mine
          ? {
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
            }
          : undefined
      }
    >
      {paragraphs.map((line, i) => (
        <p
          key={i}
          className={`text-[13px] leading-relaxed ${i ? 'mt-1.5' : ''}`}
          style={{ color: mine ? INK.primary : INK.secondary }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function Typing() {
  return (
    <div className="self-start flex items-center gap-1 rounded-[18px] rounded-bl-[6px] border border-white/10 bg-white/[0.05] px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: INK.muted, animationDelay: `${i * 140}ms` }}
        />
      ))}
      <span className="sr-only">Thinking</span>
    </div>
  );
}

function Problem({ text }) {
  return (
    <p
      className="self-start flex items-start gap-2 text-xs px-1"
      style={{ color: STATUS.critical }}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      {text}
    </p>
  );
}
