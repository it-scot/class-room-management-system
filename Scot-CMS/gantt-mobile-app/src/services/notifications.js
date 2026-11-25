// src/services/notifications.js
// Real-time mobile notifications: Web Audio chime, haptic vibration, and Service Worker OS alerts.

export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq, startOffset, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration);
    };

    playTone(880, 0, 0.2);
    playTone(1175, 0.14, 0.3);
  } catch {
    // Ignore autoplay restriction before user interaction
  }
};

export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

export const fireDeviceNotification = async (title, body, tag = `scot-${Date.now()}`) => {
  playNotificationChime();

  if (navigator.vibrate) {
    try {
      navigator.vibrate([220, 90, 220]);
    } catch { /* ignore */ }
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          vibrate: [220, 90, 220],
          tag,
        });
        return;
      }
    }
    new Notification(title, { body, icon: '/icon.svg' });
  } catch { /* fallback silently */ }
};
