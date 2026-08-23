// src/store/PortalContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const PortalContext = createContext();

export const PortalProvider = ({ children }) => {
  const [portalConfig, setPortalConfig] = useState(null);
  const [isPortalOpen, setIsPortalOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Sri Lanka time evaluation
  const evaluatePortalState = (config) => {
    if (!config) return true;
    
    if (config.isManualOverride) {
      return config.manualStatus === 'OPEN';
    }

    if (config.scheduleEnabled === false) {
      return true; // if schedule logic disabled entirely, just open by default unless manual override
    }

    // SL Time is UTC + 5:30
    const now = new Date();
    const slTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    
    // getUTCDay() of SL time gives us the local day in SL
    const currentDay = slTime.getUTCDay(); // 0 = Sun, 1 = Mon ... 4 = Thu
    const currentHour = slTime.getUTCHours();
    const currentMin = slTime.getUTCMinutes();
    
    // Allowed: Sun (0) 17:30 to Thu (4) 14:30
    // Sun 17:30 to Sun 23:59
    if (currentDay === 0) {
      if (currentHour > 17 || (currentHour === 17 && currentMin >= 30)) return true;
      return false;
    }
    
    // Mon, Tue, Wed (1, 2, 3) are fully open
    if (currentDay >= 1 && currentDay <= 3) return true;
    
    // Thu (4) 00:00 to 14:30
    if (currentDay === 4) {
      if (currentHour < 14 || (currentHour === 14 && currentMin < 30)) return true;
      return false;
    }
    
    // Fri (5), Sat (6) are closed
    return false;
  };

  useEffect(() => {
    const configRef = doc(db, 'settings', 'portalConfig');
    const unsubscribe = onSnapshot(configRef, async (snap) => {
      if (!snap.exists()) {
        // Initialize default
        const defaultCfg = {
          isManualOverride: false,
          manualStatus: 'OPEN',
          scheduleEnabled: true,
        };
        await setDoc(configRef, defaultCfg);
        setPortalConfig(defaultCfg);
        setIsPortalOpen(evaluatePortalState(defaultCfg));
      } else {
        const data = snap.data();
        setPortalConfig(data);
        setIsPortalOpen(evaluatePortalState(data));
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching portal config:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Set an interval to re-evaluate every minute if no manual override
  useEffect(() => {
    if (portalConfig && !portalConfig.isManualOverride && portalConfig.scheduleEnabled) {
      const interval = setInterval(() => {
        setIsPortalOpen(evaluatePortalState(portalConfig));
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [portalConfig]);

  return (
    <PortalContext.Provider value={{ portalConfig, isPortalOpen, loading }}>
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = () => useContext(PortalContext);
