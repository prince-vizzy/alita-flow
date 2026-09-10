// Talks to /api/gemini, the serverless function that holds the API key. The
// key is deliberately not reachable from here — see api/gemini.js.
//
// Every call carries the dashboard PIN, which the server checks: the route
// spends money on someone else's key, and it used to answer anyone who found
// the URL.

import { adminHeaders } from './adminGate';

const ENDPOINT = '/api/gemini';

// Whether the server has a key at all. Resolves false rather than throwing on
// a dev server with no functions running, so the dashboard just stays quiet.
export async function fetchGeminiStatus() {
  try {
    const res = await fetch(ENDPOINT, { headers: adminHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.configured);
  } catch {
    return false;
  }
}

async function post(payload, signal) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Insights failed: ${res.status}`);
  if (!data?.text) throw new Error('Gemini sent back an empty answer.');
  return data.text;
}

// A written read of the period the dashboard is showing.
export function summarizeDashboard(digest, signal) {
  return post({ mode: 'summary', digest }, signal);
}

// A specific question about that same period.
export function askDashboard(digest, question, signal) {
  return post({ mode: 'ask', digest, question }, signal);
}
