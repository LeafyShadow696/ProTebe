/**
 * Lightweight wrappers around native device APIs.
 *  - haptic feedback via Vibration API
 *  - screen wake-lock via Wake Lock API (Chrome/Safari 16.4+)
 *  - battery status via Battery API (where available)
 */

export const HAPTIC = {
  light: () => vibrate(8),
  medium: () => vibrate(15),
  success: () => vibrate([10, 30, 10]),
  warning: () => vibrate([10, 60, 10, 60, 10]),
  selection: () => vibrate(5),
};

function vibrate(pattern) {
  if (typeof navigator === 'undefined') return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

let activeWakeLock = null;

export async function requestWakeLock() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return null;
  try {
    activeWakeLock = await navigator.wakeLock.request('screen');
    return activeWakeLock;
  } catch {
    return null;
  }
}

export async function releaseWakeLock() {
  if (activeWakeLock) {
    try {
      await activeWakeLock.release();
    } catch {
      /* ignore */
    }
    activeWakeLock = null;
  }
}

export async function getBatteryInfo() {
  if (typeof navigator === 'undefined' || !navigator.getBattery) return null;
  try {
    const b = await navigator.getBattery();
    return {
      level: Math.round((b.level || 0) * 100),
      charging: b.charging,
    };
  } catch {
    return null;
  }
}
