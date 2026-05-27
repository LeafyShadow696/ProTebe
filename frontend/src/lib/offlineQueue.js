/**
 * Simple offline message queue for Pro Tebe
 * Uses localStorage for persistence (good enough for personal use)
 */

const QUEUE_KEY = 'pro-tebe-message-queue';

export function getQueuedMessages() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function queueMessage(message) {
  const queue = getQueuedMessages();
  queue.push({
    ...message,
    queuedAt: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeQueuedMessage(id) {
  const queue = getQueuedMessages().filter(m => m.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function processQueue(sendFunction) {
  const queue = getQueuedMessages();
  if (queue.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const msg of [...queue]) {
    try {
      await sendFunction(msg);
      removeQueuedMessage(msg.id);
      sent++;
    } catch (e) {
      failed++;
      // Keep it in queue for next time
    }
  }

  return { sent, failed };
}