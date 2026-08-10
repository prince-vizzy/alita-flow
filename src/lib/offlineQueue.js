const QUEUE_KEY = 'alita-flow-pending-actions';

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// action: { type: 'sell' | 'addStock', name, qty, unit, timestamp }
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
