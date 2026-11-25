// src/hooks/useEquipmentCatalog.js
// Real-time subscription hook for the admin-managed equipment catalog.

import { useEffect, useState } from 'react';
import { EQUIPMENT_ITEMS } from '../utils/constants';
import { subscribeToEquipmentCatalog } from '../services/equipmentCatalogService';

export const useEquipmentCatalog = () => {
  const [items, setItems] = useState(EQUIPMENT_ITEMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToEquipmentCatalog(
      (catalog) => {
        setItems(catalog);
        setLoading(false);
      },
      () => {
        setItems(EQUIPMENT_ITEMS);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { items, loading };
};
