/**
 * Push Notification utilities for Pro Tebe PWA
 * Handles subscription + communication with backend
 */

export async function getVapidPublicKey() {
  try {
    const res = await fetch('/api/push/public-key');
    const data = await res.json();
    return data.publicKey || null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const registration = await navigator.serviceWorker.ready;

  // Check existing subscription
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const vapidKey = await getVapidPublicKey();

    try {
      const options = { userVisibleOnly: true };
      if (vapidKey) {
        options.applicationServerKey = urlBase64ToUint8Array(vapidKey);
      }
      subscription = await registration.pushManager.subscribe(options);
    } catch (err) {
      console.error('Failed to subscribe to push:', err);
      throw err;
    }
  }

  // Send subscription to backend
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        token: localStorage.getItem('remix.token'),
      }),
    });
  } catch (err) {
    console.warn('Could not send subscription to backend (will retry later)');
  }

  return subscription;
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });
    } catch (e) {
      // ignore
    }

    await subscription.unsubscribe();
  }
}

export async function getPushSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

