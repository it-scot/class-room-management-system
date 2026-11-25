// src/services/apiKeyService.js
// Admin-managed read-only API key for external Gantt Schedule mobile app.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const KEY_DOC_REF = () => doc(db, 'api_keys', 'gantt_mobile');

/**
 * Generate a cryptographically secure read-only Gantt API key.
 */
export const generateSecureApiKey = () => {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `scot_gantt_${hex}`;
};

/**
 * Fetch the current Gantt mobile API key config from Firestore.
 */
export const getGanttApiKeyConfig = async () => {
  const snap = await getDoc(KEY_DOC_REF());
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Create or rotate (regenerate) the Gantt mobile API key.
 */
export const rotateGanttApiKey = async (adminEmail = 'admin@scot.lk') => {
  const newKey = generateSecureApiKey();
  const payload = {
    key: newKey,
    active: true,
    scope: 'gantt:read',
    label: 'Gantt Mobile App Key',
    updatedBy: adminEmail,
    updatedAt: serverTimestamp(),
  };

  const existing = await getDoc(KEY_DOC_REF());
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(KEY_DOC_REF(), payload, { merge: true });
  return {
    ...payload,
    updatedAt: new Date(),
  };
};

/**
 * Enable or disable the existing Gantt API key without rotating it.
 */
export const setGanttApiKeyActive = async (active, adminEmail = 'admin@scot.lk') => {
  await setDoc(
    KEY_DOC_REF(),
    {
      active: Boolean(active),
      updatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
