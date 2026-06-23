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
    // New Line Metrics (Two-Wattmeter Schema)
    Vab: number;
    Vbc: number;
    Vca: number;
    Ia: number;
    Ib: number;
    Ic: number;
    Wab: number;
    Wbc: number;
    twm_total_power: number;
    // Traditional Phase Metrics
    p1_voltage: number;
    p1_current: number;
    p1_power: number;
    p2_voltage: number;
    p2_current: number;
    p2_power: number;
    p3_voltage: number;
    p3_current: number;
    p3_power: number;
    // Overalls
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
            ref(db, `readings_v2/${activeDeviceId}`),
            ...constraints
        );

        const handleValue = (snapshot: DataSnapshot) => {
            const readings: PowerReading[] = [];
            snapshot.forEach((childSnapshot) => {
                const val = childSnapshot.val() || {};
                
                // Cross-populate names dynamically to ensure both formats always coexist safely
                const finalVab = val.Vab !== undefined ? val.Vab : (val.p1_voltage || 0);
                const finalVbc = val.Vbc !== undefined ? val.Vbc : (val.p2_voltage || 0);
                const finalVca = val.Vca !== undefined ? val.Vca : (val.p3_voltage || 0);

                const finalIa = val.Ia !== undefined ? val.Ia : (val.p1_current || 0);
                const finalIb = val.Ib !== undefined ? val.Ib : (val.p2_current || 0);
                const finalIc = val.Ic !== undefined ? val.Ic : (val.p3_current || 0);

                const finalWab = val.Wab !== undefined ? val.Wab : (val.p1_power || 0);
                const finalWbc = val.Wbc !== undefined ? val.Wbc : (val.p2_power || 0);
                const finalTwm = val.twm_total_power !== undefined ? val.twm_total_power : (val.total_power || 0);

                readings.push({
                    ...val,
                    key: childSnapshot.key || `${val.timestamp}-${Math.random()}`,
                    time: val.time || '',
                    timestamp: val.timestamp || '',
                    device_id: val.device_id,
                    // Modern assignments
                    Vab: finalVab,
                    Vbc: finalVbc,
                    Vca: finalVca,
                    Ia: finalIa,
                    Ib: finalIb,
                    Ic: finalIc,
                    Wab: finalWab,
                    Wbc: finalWbc,
                    twm_total_power: finalTwm,
                    // Legacy structures mapped safely
                    p1_voltage: finalVab,
                    p2_voltage: finalVbc,
                    p3_voltage: finalVca,
                    p1_current: finalIa,
                    p2_current: finalIb,
                    p3_current: finalIc,
                    p1_power: finalWab,
                    p2_power: finalWbc,
                    p3_power: val.p3_power || 0,
                    total_power: val.total_power !== undefined ? val.total_power : finalTwm
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