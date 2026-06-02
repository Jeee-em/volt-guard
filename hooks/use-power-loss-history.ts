"use client";

import { useState, useEffect } from 'react';
import { getDatabase, ref, query, orderByChild, limitToLast, onValue, off, DataSnapshot } from 'firebase/database';
import { app } from '@/lib/firebase';
import type { ChartDataPoint } from '@/components/dashboard/sensor-chart-shared';

export function usePowerLossHistory(limit = 200) {
    const [data, setData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const db = getDatabase(app);
        const historyRef = query(
            ref(db, 'power_loss_history'), 
            orderByChild('timestamp'), 
            limitToLast(limit)
        );

        const handleValue = (snapshot: DataSnapshot) => {
            const readings: ChartDataPoint[] = [];
            snapshot.forEach((child) => {
                readings.push(child.val() as ChartDataPoint);
            });
            setData(readings);
            setLoading(false);
        };

        const unsubscribe = onValue(historyRef, handleValue, (err) => {
            setError(err);
            setLoading(false);
        });

        return () => {
            off(historyRef, 'value', handleValue);
            unsubscribe();
        };
    }, [limit]);

    return { data, loading, error };
}