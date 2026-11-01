// Gemini sits behind this function so the API key never leaves the server —
// anything in the Vite bundle is readable by whoever opens the site.
//
//   GET  → { configured }  so the dashboard can stay quiet until the key is set
//   POST → { text }        a written read of, or an answer about, the digest
//                          the dashboard sends up
//
// Behind the dashboard PIN, both verbs (see api/_pin.js). This route spends
// money on someone else's key and it is a public URL — for a while it
// answered anyone who found it.
//
// Set GEMINI_API_KEY in the Vercel project's environment variables (and in
// .env.local for `vercel dev`). GEMINI_MODEL optionally overrides the model.

import { callGemini, isGeminiConfigured } from './_gemini.js';
import { checkPin } from './_pin.js';

const MAX_DIGEST_BYTES = 250 * 1024;
const MAX_QUESTION_CHARS = 500;

// Twenty seconds was under what this model needs. Measured against the live
// function, a one-word answer round-trips in about eleven; four sentences off
// a real digest goes well past twenty, so every summary aborted and the owner
// only ever saw "took too long". This is a ceiling for a hung call, not a
// budget — nothing normally runs near it.
const TIMEOUT_MS = 50_000;

export const maxDuration = 60;

// Shared by both modes. The part describing "book" is only true when the book
// travels, so it is added per request rather than promised here.
const SYSTEM_INSTRUCTION = [
  'You are the analyst for Alita Flow, a small hardware shop and food trolley in Kenya.',
  '"onScreen" is exactly what the owner is looking at right now: one section (shop or trolley)',
  'over one date range, already aggregated.',
  'Answer from that JSON and nothing else — if it does not contain what was asked, say so',
  'plainly rather than guessing a number or inventing an item.',
  'Note that stock counts can be negative where more was sold than the sheet recorded arriving;',
  'that is a bookkeeping gap, not stock on the shelf.',
  'Money is Kenyan shillings, written as "KES 1,200".',
  'Write plain sentences for a busy shopkeeper: no markdown, no headings, no bold, no bullet',
  'characters, no preamble like "Based on the data". Be specific — name the item and the figure.',
].join(' ');

const BOOK_INSTRUCTION = [
  '"book" is everything the business holds — the full price list with item codes and current',
  'stock, the trolley items, every item ever traded with its lifetime revenue, units, spend and',
  'the day it last sold, monthly totals per business, and the trolley spoilt stock log.',
  'Use "onScreen" for anything about the current view, and "book" for everything else:',
  'prices, stock levels, item codes, history outside the range, and the other section.',
].join(' ');

const SUMMARY_TASK = [
  'Write the read on the "onScreen" period in at most four short sentences.',
  'Lead with whether it made or lost money and what drove that.',
  'Then the one or two items that mattered most, anything that needs restocking soon,',
  'and anything that is losing money.',
  'Leave out anything the digest does not support, and do not list figures the owner',
  'can already see on the tiles — tell them what the figures mean.',
].join(' ');

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const access = checkPin(req);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.method === 'GET') {
    return res.status(200).json({ configured: isGeminiConfigured() });
  }

  if (!isGeminiConfigured()) {
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

  // The dashboard sends { onScreen, book }; older bundles sent the on-screen
  // slice on its own.
  const onScreen = digest.onScreen ?? digest;
  const book = digest.book ?? null;

  let task = SUMMARY_TASK;
  if (mode === 'ask') {
    const asked = typeof question === 'string' ? question.trim() : '';
    if (!asked) return res.status(400).json({ error: 'Type a question first.' });
    if (asked.length > MAX_QUESTION_CHARS) {
      return res.status(400).json({ error: 'That question is too long.' });
    }
    task = `Answer this question in at most three short sentences: ${asked}`;
  }

  // The summary is a read of the period on screen and nothing else, so the
  // book stays behind: it is tens of KB the model would have to chew through
  // on every tab and range change to write four sentences the view already
  // supports. A question does reach past the view, so it travels with one.
  const sent = mode === 'ask' && book ? { onScreen, book } : { onScreen };
  const sentJson = JSON.stringify(sent);
  if (Buffer.byteLength(sentJson, 'utf8') > MAX_DIGEST_BYTES) {
    return res.status(413).json({ error: 'That view is too large to summarise.' });
  }

  const instruction = sent.book ? `${SYSTEM_INSTRUCTION} ${BOOK_INSTRUCTION}` : SYSTEM_INSTRUCTION;
  const input = `${task}\n\nDashboard digest:\n${sentJson}`;

  const result = await callGemini({ input, system: instruction, timeoutMs: TIMEOUT_MS });

  if (result.ok) return res.status(200).json({ text: result.text });

  if (result.timedOut) {
    return res.status(504).json({
      error:
        mode === 'ask'
          ? 'Gemini took too long on that one — a shorter, more specific question usually lands.'
          : 'Gemini took too long to answer. Tap refresh to try again.',
    });
  }

  return res.status(502).json({
    error:
      result.status === 429
        ? 'Gemini is rate-limiting this key — try again in a moment.'
        : result.error,
  });
}
