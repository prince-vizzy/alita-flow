// Gemini sits behind this function so the API key never leaves the server —
// anything in the Vite bundle is readable by whoever opens the site.
//
//   GET  → { configured }  so the dashboard can stay quiet until the key is set
//   POST → { text }        a written read of, or an answer about, the digest
//                          the dashboard sends up
//
// Set GEMINI_API_KEY in the Vercel project's environment variables (and in
// .env.local for `vercel dev`). GEMINI_MODEL optionally overrides the model.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_MODEL = 'gemini-3.8-flash';

// The digest is aggregates only and normally lands well under 8KB. The cap is
// here because this route is public: it's the one way a stranger could run up
// a bill on someone else's key.
const MAX_DIGEST_BYTES = 24 * 1024;
const MAX_QUESTION_CHARS = 500;
const TIMEOUT_MS = 20_000;

export const maxDuration = 30;

const SYSTEM_INSTRUCTION = [
  'You are the analyst for Alita Flow, a small hardware shop and food trolley in Kenya.',
  'You are given a JSON digest of exactly what the owner is looking at on their dashboard:',
  'one section (shop or trolley) over one date range, already aggregated.',
  'Answer only from that digest. If it does not contain what was asked, say so plainly',
  'and name what the owner would have to open instead — never guess a number and never',
  'invent an item name.',
  'Money is Kenyan shillings, written as "KES 1,200".',
  'Write plain sentences for a busy shopkeeper: no markdown, no headings, no bold, no bullet',
  'characters, no preamble like "Based on the data". Be specific — name the item and the figure.',
].join(' ');

const SUMMARY_TASK = [
  'Write the read on this period in at most four short sentences.',
  'Lead with whether it made or lost money and what drove that.',
  'Then the one or two items that mattered most, anything that needs restocking soon,',
  'and anything that is losing money.',
  'Leave out anything the digest does not support, and do not list figures the owner',
  'can already see on the tiles — tell them what the figures mean.',
].join(' ');

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (req.method === 'GET') {
    return res.status(200).json({ configured: Boolean(apiKey) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!apiKey) {
    return res
      .status(503)
      .json({ error: 'GEMINI_API_KEY is not set on the server, so insights are switched off.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Body must be JSON.' });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body must be JSON.' });
  }

  const { mode, digest, question } = body;

  if (mode !== 'summary' && mode !== 'ask') {
    return res.status(400).json({ error: 'mode must be "summary" or "ask".' });
  }
  if (!digest || typeof digest !== 'object') {
    return res.status(400).json({ error: 'A digest of the dashboard is required.' });
  }

  const digestJson = JSON.stringify(digest);
  if (Buffer.byteLength(digestJson, 'utf8') > MAX_DIGEST_BYTES) {
    return res.status(413).json({ error: 'That view is too large to summarise.' });
  }

  let task = SUMMARY_TASK;
  if (mode === 'ask') {
    const asked = typeof question === 'string' ? question.trim() : '';
    if (!asked) return res.status(400).json({ error: 'Type a question first.' });
    if (asked.length > MAX_QUESTION_CHARS) {
      return res.status(400).json({ error: 'That question is too long.' });
    }
    task = `Answer this question in at most three short sentences: ${asked}`;
  }

  const input = `${task}\n\nDashboard digest:\n${digestJson}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        input,
        system_instruction: SYSTEM_INSTRUCTION,
        // Reading a table of totals is not a reasoning problem, and the owner
        // is waiting on the answer.
        generation_config: { temperature: 0.4, thinking_level: 'low' },
        stream: false,
      }),
      signal: controller.signal,
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      // Google's message is aimed at whoever holds the key, not at the
      // shopkeeper, so it goes to the server log and a plain line comes back.
      console.error('Gemini error', upstream.status, payload);
      return res.status(502).json({
        error:
          upstream.status === 429
            ? 'Gemini is rate-limiting this key — try again in a moment.'
            : 'Gemini could not answer that just now.',
      });
    }

    const text = extractText(payload);
    if (!text) return res.status(502).json({ error: 'Gemini sent back an empty answer.' });

    return res.status(200).json({ text });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Gemini took too long to answer.' });
    }
    console.error('Gemini request failed', err);
    return res.status(502).json({ error: 'Could not reach Gemini.' });
  } finally {
    clearTimeout(timer);
  }
}

// The SDKs expose an `output_text` shortcut, but the raw REST response only
// carries `steps` — model output is one step among thoughts and tool calls.
function extractText(payload) {
  if (!payload || !Array.isArray(payload.steps)) return '';
  return payload.steps
    .filter((step) => step?.type === 'model_output' && Array.isArray(step.content))
    .flatMap((step) => step.content)
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text.trim())
    .join('\n')
    .trim();
}
