"use client";

import { useState, useEffect } from 'react';
import { getDatabase, ref, query, orderByChild, limitToLast, onValue, off, DataSnapshot } from 'firebase/database';
import { app } from '@/lib/firebase';
import type { Remarks } from '@/hooks/use-power-loss';

// Define the exact shape of the data being uploaded
export interface PowerDistributionRecord {
    timestamp: number;
    time: string;
    pt_total: number;
    pn_total: number;
    po_total: number;
    deviation: number;
    remarks: Remarks;
}

export function usePowerDistributionHistory(limit = 200) {
    const [data, setData] = useState<PowerDistributionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const db = getDatabase(app);
        const historyRef = query(
            ref(db, 'pt_history'), 
            orderByChild('timestamp'), 
            limitToLast(limit)
        );

        const handleValue = (snapshot: DataSnapshot) => {
            const readings: PowerDistributionRecord[] = [];
            snapshot.forEach((child) => {
                // Safely assert the type now that it matches the upload structure
                readings.push(child.val() as PowerDistributionRecord);
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