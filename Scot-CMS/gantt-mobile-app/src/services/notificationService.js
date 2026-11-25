// src/services/notificationService.js
// Cross-platform real-time alerts: native Expo Notifications on Android/iOS + Web Notifications & chime on Web.

import { Platform, Vibration } from 'react-native';

let NotificationsModule = null;
if (Platform.OS !== 'web') {
  try {
    NotificationsModule = require('expo-notifications');
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    NotificationsModule = null;
  }
}

const playWebChime = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const tone = (freq, offset, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + dur);
    };
    tone(880, 0, 0.2);
    tone(1175, 0.14, 0.28);
  } catch { /* ignore */ }
};

export const requestAlertPermission = async () => {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  if (NotificationsModule) {
    try {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      return status;
    } catch {
      return 'denied';
    }
  }
  return 'unsupported';
};

export const sendLocalNotification = async (title, body) => {
  if (Platform.OS === 'web') {
    playWebChime();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch { /* ignore */ }
    }
    return;
  }

  try {
    Vibration.vibrate([0, 220, 100, 220]);
  } catch { /* ignore */ }

  if (NotificationsModule) {
    try {
      await NotificationsModule.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });
    } catch { /* ignore */ }
  }
};
