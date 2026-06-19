'use client';

import { useEffect, useState, useCallback } from 'react';
import { getDatabase, ref, onValue, set, off } from 'firebase/database';
import { app } from '@/lib/firebase';

export interface PowerDistributionThreshold {
    unstable: number;   // deviation > this → Unstable   (default: 0, meaning any deviation)
    pilferage: number;  // deviation > this → Pilferage  (default: 10)
}

const DEFAULT_THRESHOLD: PowerDistributionThreshold = {
    unstable: 0,
    pilferage: 10,
};

interface UsePowerDistributionThresholdResult {
    threshold: PowerDistributionThreshold;
    saveThreshold: (values: PowerDistributionThreshold) => Promise<void>;
    resetThreshold: () => Promise<void>;
    saving: boolean;
    lastSavedAt: number | null;
}

export function usePowerDistributionThreshold(userId?: string): UsePowerDistributionThresholdResult {
    const [threshold, setThreshold] = useState<PowerDistributionThreshold>(DEFAULT_THRESHOLD);
    const [saving, setSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

    // Load from Firebase on mount — keyed per user so each admin has their own settings
    useEffect(() => {
        if (!userId) return;
        const db = getDatabase(app);
        const thresholdRef = ref(db, `user_settings/${userId}/power_distribution_threshold`);

        const unsub = onValue(thresholdRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
                setThreshold({
                    unstable:  typeof val.unstable  === 'number' ? val.unstable  : DEFAULT_THRESHOLD.unstable,
                    pilferage: typeof val.pilferage === 'number' ? val.pilferage : DEFAULT_THRESHOLD.pilferage,
                });
            }
        });

        return () => off(thresholdRef, 'value', unsub);
    }, [userId]);

    const saveThreshold = useCallback(async (values: PowerDistributionThreshold) => {
        if (!userId) return;
        setSaving(true);
        try {
            const db = getDatabase(app);
            await set(ref(db, `user_settings/${userId}/power_distribution_threshold`), values);
            setThreshold(values);
            setLastSavedAt(Date.now());
        } finally {
            setSaving(false);
        }
    }, [userId]);

    const resetThreshold = useCallback(async () => {
        await saveThreshold(DEFAULT_THRESHOLD);
    }, [saveThreshold]);

    return { threshold, saveThreshold, resetThreshold, saving, lastSavedAt };
}

export { DEFAULT_THRESHOLD };