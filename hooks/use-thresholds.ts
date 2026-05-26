'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDatabase, ref, onValue, off, update, set, DataSnapshot } from 'firebase/database';
import { app } from '@/lib/firebase';
import { getDefaultThresholds, type SignalThreshold, type ThresholdConfig, type ThresholdMetricKey } from '@/lib/thresholds';

interface UseThresholdsResult {
    thresholds: ThresholdConfig;
    loading: boolean;
    saving: boolean;
    error: Error | null;
    lastSavedAt: number | null;
    lastSavedMetric: ThresholdMetricKey | null;
    lastSavedAction: 'save' | 'reset' | null;
    saveThreshold: (metric: ThresholdMetricKey, values: SignalThreshold) => Promise<void>;
    updateThreshold: (metric: ThresholdMetricKey, level: 'warning' | 'critical', value: number) => Promise<void>;
    resetThreshold: (metric: ThresholdMetricKey) => Promise<void>;
}

function mergeThresholds(data: unknown): ThresholdConfig {
    const defaults = getDefaultThresholds();
    if (!data || typeof data !== 'object') return defaults;

    const next = { ...defaults } as ThresholdConfig;
    for (const key of Object.keys(defaults) as ThresholdMetricKey[]) {
        const entry = (data as Record<string, unknown>)[key];
        if (!entry || typeof entry !== 'object') continue;

        const warning = Number((entry as Record<string, unknown>).warning);
        const critical = Number((entry as Record<string, unknown>).critical);

        next[key] = {
            warning: Number.isFinite(warning) ? warning : defaults[key].warning,
            critical: Number.isFinite(critical) ? critical : defaults[key].critical,
        };
    }
    return next;
}

export function useThresholds(userId?: string | null): UseThresholdsResult {
    const [thresholds, setThresholds] = useState<ThresholdConfig>(() => getDefaultThresholds());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const [lastSavedMetric, setLastSavedMetric] = useState<ThresholdMetricKey | null>(null);
    const [lastSavedAction, setLastSavedAction] = useState<'save' | 'reset' | null>(null);

    const db = useMemo(() => getDatabase(app), []);

    useEffect(() => {
        if (!userId) {
            setThresholds(getDefaultThresholds());
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const thresholdsRef = ref(db, `user_thresholds/${userId}`);

        const handleValue = (snapshot: DataSnapshot) => {
            const data = snapshot.val();
            setThresholds(mergeThresholds(data));
            setLoading(false);
        };

        const unsubscribe = onValue(thresholdsRef, handleValue, (err) => {
            setError(err as Error);
            setLoading(false);
        });

        return () => {
            off(thresholdsRef, 'value', handleValue);
            unsubscribe();
        };
    }, [db, userId]);

    const saveThreshold = useCallback(
        async (metric: ThresholdMetricKey, values: SignalThreshold) => {
            if (!userId) return;
            setSaving(true);
            setError(null);
            try {
                await set(ref(db, `user_thresholds/${userId}/${metric}`), {
                    warning: values.warning,
                    critical: values.critical,
                });
                setLastSavedAt(Date.now());
                setLastSavedMetric(metric);
                setLastSavedAction('save');
            } catch (err) {
                setError(err as Error);
            } finally {
                setSaving(false);
            }
        },
        [db, userId]
    );

    const updateThreshold = useCallback(
        async (metric: ThresholdMetricKey, level: 'warning' | 'critical', value: number) => {
            if (!userId) return;
            setSaving(true);
            setError(null);
            try {
                await update(ref(db, `user_thresholds/${userId}/${metric}`), { [level]: value });
                setLastSavedAt(Date.now());
                setLastSavedMetric(metric);
                setLastSavedAction('save');
            } catch (err) {
                setError(err as Error);
            } finally {
                setSaving(false);
            }
        },
        [db, userId]
    );

    const resetThreshold = useCallback(
        async (metric: ThresholdMetricKey) => {
            if (!userId) return;
            setSaving(true);
            setError(null);
            try {
                const defaults = getDefaultThresholds();
                await set(ref(db, `user_thresholds/${userId}/${metric}`), defaults[metric]);
                setLastSavedAt(Date.now());
                setLastSavedMetric(metric);
                setLastSavedAction('reset');
            } catch (err) {
                setError(err as Error);
            } finally {
                setSaving(false);
            }
        },
        [db, userId]
    );

    return {
        thresholds,
        loading,
        saving,
        error,
        lastSavedAt,
        lastSavedMetric,
        lastSavedAction,
        saveThreshold,
        updateThreshold,
        resetThreshold,
    };
}
