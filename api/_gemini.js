// One place for the model, the endpoint and the shape of a Gemini call.
// Both the dashboard's insights dock (api/gemini.js) and the morning
// notifier (api/notify.js) go through here, so the two can never drift onto
// different models or different response parsing.
//
// Underscore-prefixed files in api/ are not routes — this is a library, not
// an endpoint.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_MODEL = 'gemini-3.8-flash';

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Resolves to { ok, text } or { ok: false, status, error, timedOut } — the
// callers want to decide for themselves whether a failure is fatal (the dock
// shows it) or merely a downgrade (the notifier falls back to plain figures),
// so nothing throws out of here.
export async function callGemini({ input, system, timeoutMs = 50_000, temperature = 0.4 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: 'GEMINI_API_KEY is not set on the server.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        input,
        system_instruction: system,
        // Reading a table of totals is not a reasoning problem, and something
        // is always waiting on the answer.
        generation_config: { temperature, thinking_level: 'low' },
        stream: false,
      }),
      signal: controller.signal,
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      // Google's message is aimed at whoever holds the key, not at the
      // shopkeeper, so it goes to the server log and the caller gets a code.
      console.error('Gemini error', upstream.status, payload);
      return { ok: false, status: upstream.status, error: 'Gemini could not answer that just now.' };
    }

    const text = extractText(payload);
    if (!text) return { ok: false, status: 502, error: 'Gemini sent back an empty answer.' };
    return { ok: true, text };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, status: 504, timedOut: true, error: 'Gemini took too long to answer.' };
    }
    console.error('Gemini request failed', err);
    return { ok: false, status: 502, error: 'Could not reach Gemini.' };
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
