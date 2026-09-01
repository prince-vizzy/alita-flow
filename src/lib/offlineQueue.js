const QUEUE_KEY = 'alita-flow-pending-actions';

export function getQueue() {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
    // Actions queued before the app had sections are all shop actions.
    return raw.map((action) => ({ section: 'shop', ...action }));
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// action: {
//   section: 'shop' | 'trolley',
//   type: 'sell' | 'addStock' | 'cook',   // 'cook' is trolley-only
//   name, qty, unit, timestamp
// }
export function enqueueAction(action) {
  const queue = getQueue();
  const entry = { ...action, id: crypto.randomUUID() };
  queue.push(entry);
  saveQueue(queue);
  return entry;
}

export function removeAction(id) {
  saveQueue(getQueue().filter((a) => a.id !== id));
}
