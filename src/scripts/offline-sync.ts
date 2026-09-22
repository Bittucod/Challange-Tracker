// Offline sync manager using localStorage queue
const STORAGE_KEY = 'streakgrid_pending_records';

export interface PendingRecord {
  challenge_id: string;
  activity_id: string;
  date: string;
  status: string;
  note?: string;
  timestamp: number;
}

export function getPendingQueue(): PendingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePendingQueue(queue: PendingRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save pending queue:', err);
  }
}

export function queueOfflineRecord(record: Omit<PendingRecord, 'timestamp'>) {
  const queue = getPendingQueue();
  // Filter out any existing item with same challenge, activity, date
  const filtered = queue.filter(
    (item) =>
      !(
        item.challenge_id === record.challenge_id &&
        item.activity_id === record.activity_id &&
        item.date === record.date
      )
  );
  filtered.push({
    ...record,
    timestamp: Date.now()
  });
  savePendingQueue(filtered);
}

export async function flushOfflineQueue(challengeId?: string): Promise<boolean> {
  const queue = getPendingQueue();
  if (queue.length === 0) return true;

  const targetQueue = challengeId
    ? queue.filter((r) => r.challenge_id === challengeId)
    : queue;

  if (targetQueue.length === 0) return true;

  // Group by challenge_id
  const byChallenge = new Map<string, PendingRecord[]>();
  for (const item of targetQueue) {
    const list = byChallenge.get(item.challenge_id) || [];
    list.push(item);
    byChallenge.set(item.challenge_id, list);
  }

  let allSuccess = true;

  for (const [cId, records] of byChallenge.entries()) {
    try {
      const res = await fetch(`/api/challenges/${cId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      });
      if (!res.ok) {
        allSuccess = false;
      }
    } catch {
      allSuccess = false;
    }
  }

  if (allSuccess) {
    // Remove processed records
    const remaining = queue.filter(
      (item) => !targetQueue.some((t) => t.challenge_id === item.challenge_id && t.activity_id === item.activity_id && t.date === item.date)
    );
    savePendingQueue(remaining);
    return true;
  }

  return false;
}

// Auto-sync listener when browser reconnects
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[StreakGrid] Reconnected. Syncing offline records...');
    flushOfflineQueue().then((success) => {
      if (success) {
        window.dispatchEvent(new CustomEvent('streakgrid:synced'));
      }
    });
  });
}
