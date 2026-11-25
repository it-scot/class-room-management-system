// src/services/equipmentCatalogService.js
// Firestore CRUD operations for admin-managed equipment catalog & stock quantities.

import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { EQUIPMENT_ITEMS } from '../utils/constants';

const CATALOG_COL = 'equipment_catalog';

export const slugifyEquipmentId = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;

/**
 * Merge built-in default EQUIPMENT_ITEMS with Firestore overrides & newly added items.
 * Items marked `deleted: true` in Firestore are hidden from the active catalog.
 */
export const mergeEquipmentCatalog = (firestoreDocs = []) => {
  const overrideMap = new Map(firestoreDocs.map((d) => [d.id, d]));
  const merged = [];

  for (const base of EQUIPMENT_ITEMS) {
    const ov = overrideMap.get(base.id);
    if (ov) {
      if (!ov.deleted) {
        merged.push({
          ...base,
          ...ov,
          maxQuantity: Math.max(1, Number(ov.maxQuantity || base.maxQuantity || 1)),
          tags: Array.isArray(ov.tags) && ov.tags.length > 0 ? ov.tags : base.tags,
        });
      }
      overrideMap.delete(base.id);
    } else {
      merged.push(base);
    }
  }

  // Append custom equipment added by admins
  for (const custom of overrideMap.values()) {
    if (!custom.deleted && custom.name) {
      merged.push({
        id: custom.id,
        name: custom.name,
        category: custom.category || 'General',
        description: custom.description || 'Campus facility equipment',
        maxQuantity: Math.max(1, Number(custom.maxQuantity || 1)),
        tags: Array.isArray(custom.tags) && custom.tags.length > 0 ? custom.tags : [custom.category || 'Equipment'],
        isCustom: true,
      });
    }
  }

  return merged;
};

/**
 * Subscribe in real time to the merged equipment catalog.
 */
export const subscribeToEquipmentCatalog = (callback, onError) => {
  return onSnapshot(
    collection(db, CATALOG_COL),
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(mergeEquipmentCatalog(docs));
    },
    (err) => {
      console.warn('[subscribeToEquipmentCatalog] Falling back to defaults:', err?.message || err);
      callback(EQUIPMENT_ITEMS);
      if (onError) onError(err);
    }
  );
};

/**
 * Create or update an equipment item in Firestore (Admin only).
 */
export const saveEquipmentCatalogItem = async (item, adminEmail = 'admin@scot.lk') => {
  const id = item.id || slugifyEquipmentId(item.name);
  const cleanTags = Array.isArray(item.tags)
    ? item.tags.map((t) => String(t).trim()).filter(Boolean)
    : String(item.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  const payload = {
    id,
    name: String(item.name || '').trim(),
    category: String(item.category || 'General').trim(),
    description: String(item.description || '').trim() || 'Campus facility equipment',
    maxQuantity: Math.max(1, Number(item.maxQuantity || 1)),
    tags: cleanTags.length > 0 ? cleanTags : [String(item.category || 'Equipment').trim()],
    deleted: false,
    updatedBy: adminEmail,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, CATALOG_COL, id), payload, { merge: true });
  return payload;
};

/**
 * Soft-delete an equipment item (works cleanly for both built-in defaults and custom items).
 */
export const removeEquipmentCatalogItem = async (itemId, adminEmail = 'admin@scot.lk') => {
  await setDoc(
    doc(db, CATALOG_COL, itemId),
    {
      id: itemId,
      deleted: true,
      updatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
