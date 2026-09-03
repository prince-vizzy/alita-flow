import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Send, Sparkles } from 'lucide-react';
import { askDashboard, summarizeDashboard } from '../lib/geminiApi';
import { INK, STATUS } from '../lib/vizTheme';

// Gemini's read of whatever slice the dashboard is showing, plus a box for
// asking it something specific about that same slice.
//
// The summary is written once per section+range and then kept, so flipping
// between tabs or back to a range already looked at costs nothing. Only the
// refresh button and a genuinely new slice spend a call.

const PLACEHOLDERS = {
  shop: 'Which items should I reorder first?',
  trolley: 'Am I cooking too much on quiet days?',
};

export default function InsightsPanel({ section, cacheKey, digest, accent }) {
  const [summary, setSummary] = useState(null);
  const [summaryState, setSummaryState] = useState('idle'); // idle | loading | error
  const [error, setError] = useState(null);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState(null);

  // Summaries already paid for, keyed by the slice they describe.
  const cache = useRef(new Map());
  const inFlight = useRef(null);

  const runSummary = useCallback(
    async (key, force = false) => {
      if (!force && cache.current.has(key)) {
        setSummary(cache.current.get(key));
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
        setSummary(text);
        setSummaryState('idle');
      } catch (err) {
        if (controller.signal.aborted || err.name === 'AbortError') return;
        setError(err.message);
        setSummaryState('error');
      }
    },
    [digest]
  );

  // A new slice means the previous answer is about numbers no longer on
  // screen, so it goes with it.
  useEffect(() => {
    setAnswer(null);
    setAskError(null);
    runSummary(cacheKey);
    // runSummary changes with every digest rebuild; the slice key is what
    // actually decides whether this is worth another call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function handleAsk(e) {
    e.preventDefault();
    const asked = question.trim();
    if (!asked || asking) return;

    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const text = await askDashboard(digest, asked);
      setAnswer({ question: asked, text });
      setQuestion('');
    } catch (err) {
      setAskError(err.message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="glass rounded-[26px] p-5" aria-label="Gemini insights">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
        <h2 className="flex-1 text-[11px] tracking-[0.14em] uppercase" style={{ color: INK.muted }}>
          What the numbers say
        </h2>
        <button
          onClick={() => runSummary(cacheKey, true)}
          disabled={summaryState === 'loading'}
          className="p-1.5 -mr-1.5 rounded-full text-ink-3 hover:text-ink transition-colors disabled:opacity-50"
          aria-label="Write the summary again"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${summaryState === 'loading' ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {summaryState === 'loading' && !summary && (
        <p className="mt-3 text-sm" style={{ color: INK.muted }}>
          Reading the period…
        </p>
      )}

      {summary && <Prose text={summary} dim={summaryState === 'loading'} />}

      {summaryState === 'error' && (
        <p className="mt-3 flex items-start gap-2 text-xs" style={{ color: STATUS.critical }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </p>
      )}

      <form onSubmit={handleAsk} className="mt-4 flex items-center gap-2">
        <input
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
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
          aria-label="Ask"
        >
          {asking ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      {answer && (
        <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-[11px]" style={{ color: INK.muted }}>
            {answer.question}
          </p>
          <Prose text={answer.text} tight />
        </div>
      )}

      {askError && (
        <p className="mt-3 flex items-start gap-2 text-xs" style={{ color: STATUS.critical }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {askError}
        </p>
      )}

      {/* Said once, quietly, and always — a written read of a ledger is worth
          having but is not the ledger. */}
      <p className="mt-3 text-[10px]" style={{ color: INK.muted }}>
        Written by Gemini from the figures on this page. Check anything you'd act on.
      </p>
    </section>
  );
}

// The model is asked for plain sentences, but it still breaks them into
// paragraphs — keep those and drop any stray bullet character it adds.
function Prose({ text, dim, tight }) {
  const paragraphs = text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);

  return (
    <div
      className={tight ? 'mt-1.5 flex flex-col gap-1.5' : 'mt-3 flex flex-col gap-2'}
      style={{ opacity: dim ? 0.5 : 1, transition: 'opacity 200ms' }}
    >
      {paragraphs.map((line, i) => (
        <p key={i} className="text-sm leading-relaxed" style={{ color: INK.secondary }}>
          {line}
        </p>
      ))}
    </div>
  );
}
