import {
  getPushPublicKey,
  getPushStatus,
  sendPushTest,
  subscribePush,
  unsubscribePush,
} from './api';

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true || window.navigator.standalone === true;
}

function publicKeyToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

export function pushSupport() {
  const supported = typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
  return {
    supported,
    isIos: isIos(),
    standalone: isStandalone(),
    needsIosInstall: supported && isIos() && !isStandalone(),
  };
}

export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('PUSH_NOT_SUPPORTED');
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function getPushDeviceStatus() {
  const support = pushSupport();
  if (!support.supported) return { ...support, browserSubscribed: false, endpointActive: false };
  const subscription = await currentSubscription();
  const status = await getPushStatus(subscription?.endpoint || '');
  return {
    ...support,
    configured: Boolean(status.configured),
    browserSubscribed: Boolean(subscription),
    endpointActive: Boolean(status.endpoint_active),
    activeCount: Number(status.active_count || 0),
  };
}

export async function enablePushNotifications() {
  const support = pushSupport();
  if (!support.supported) throw new Error('PUSH_NOT_SUPPORTED');
  if (support.needsIosInstall) throw new Error('IOS_INSTALL_REQUIRED');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('PUSH_PERMISSION_DENIED');

  await registerPushServiceWorker();
  const { publicKey } = await getPushPublicKey();
  if (!publicKey) throw new Error('PUSH_UNAVAILABLE');
  let subscription = await currentSubscription();
  if (!subscription) {
    const registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKeyToUint8Array(publicKey),
    });
  }
  await subscribePush(subscription.toJSON());
  return getPushDeviceStatus();
}

export async function disablePushNotifications() {
  const support = pushSupport();
  if (!support.supported) return { ...support, browserSubscribed: false, endpointActive: false };
  const subscription = await currentSubscription();
  if (subscription) {
    await unsubscribePush({ endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
  return getPushDeviceStatus();
}

export async function sendPushTestNotification() {
  return sendPushTest();
}
