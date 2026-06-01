"use client";

import { useState, useEffect } from 'react';
import {
    getDatabase,
    ref,
    query,
    orderByChild,
    limitToLast,
    startAt,
    onValue,
    off,
    DataSnapshot,
} from 'firebase/database';
import { app } from '../lib/firebase';
import { useDevice } from '../context/DeviceContext';

export interface PowerReading {
    key: string;
    timestamp: string;
    time: string;
    device_id?: string;
    // Phase 1
    p1_voltage: number;
    p1_current: number;
    p1_power: number;
    // Phase 2
    p2_voltage: number;
    p2_current: number;
    p2_power: number;
    // Phase 3
    p3_voltage: number;
    p3_current: number;
    p3_power: number;
    // Totals
    total_power: number;
}

export function useSensorData(
    deviceId?: string,
    options: number | { limit?: number; startTime?: number | string } = {}
): {
    data: PowerReading[];
    loading: boolean;
    error: Error | null;
} {
    const { selectedDeviceId } = useDevice();
    const [data, setData] = useState<PowerReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Use provided deviceId or fall back to selected device from context
    const activeDeviceId = deviceId || selectedDeviceId;

    const limit = typeof options === 'number' ? options : options.limit;
    const startTime = typeof options === 'object' ? options.startTime : undefined;

    useEffect(() => {
        if (!activeDeviceId) {
            setData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        setData([]);

        const db = getDatabase(app);
        const constraints: any[] = [orderByChild('timestamp')];

        if (startTime !== undefined) {
            constraints.push(startAt(startTime));
        }

        if (limit !== undefined) {
            constraints.push(limitToLast(limit));
        }

        const recentQuery = query(
            ref(db, `readings/${activeDeviceId}`),
            ...constraints
        );

        const handleValue = (snapshot: DataSnapshot) => {
            const readings: PowerReading[] = [];
            snapshot.forEach((childSnapshot) => {
                const val = childSnapshot.val();
                readings.push({
                    ...val,
                    key: childSnapshot.key || `${val.timestamp}-${Math.random()}`
                });
            });
            setData(readings);
            setLoading(false);
        };

        const unsubscribe = onValue(recentQuery, handleValue, (err) => {
            setError(err);
            setLoading(false);
        });

        return () => {
            off(recentQuery, 'value', handleValue);
            unsubscribe();
        };
    }, [activeDeviceId, limit, startTime]);

    return { data, loading, error };
}