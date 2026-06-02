'use client';

import { useMemo } from 'react';
import { useSensorData } from './use-sensor-data';

export interface PowerLossData {
    timestamp: number;
    time: string;
    
    // Losses
    p1_loss: number;
    p2_loss: number;
    p3_loss: number;
    total_loss: number;

    // Raw Device Data (for display)
    transformer: { p1: number; p2: number; p3: number; total: number };
    new_building: { p1: number; p2: number; p3: number; total: number };
    old_building: { p1: number; p2: number; p3: number; total: number };
}

interface UsePowerLossResult {
    latest: PowerLossData | null;
    loading: boolean;
    error: Error | null;
}

export function usePowerLoss(
    device1Id: string,
    device2Id: string,
    device3Id: string
): UsePowerLossResult {
    // Fetch only the single latest reading for real-time computation
    const { data: d1, loading: l1, error: e1 } = useSensorData(device1Id, { limit: 1 });
    const { data: d2, loading: l2, error: e2 } = useSensorData(device2Id, { limit: 1 });
    const { data: d3, loading: l3, error: e3 } = useSensorData(device3Id, { limit: 1 });

    const loading = l1 || l2 || l3;
    const error = e1 || e2 || e3;

    const latest = useMemo<PowerLossData | null>(() => {
        if (loading || !d1.length || !d2.length || !d3.length) return null;

        const r1 = d1[0]; // Transformer
        const r2 = d2[0]; // New Building
        const r3 = d3[0]; // Old Building

        const r1Total = Number.isFinite(r1.total_power) ? r1.total_power : r1.p1_power + r1.p2_power + r1.p3_power;
        const r2Total = Number.isFinite(r2.total_power) ? r2.total_power : r2.p1_power + r2.p2_power + r2.p3_power;
        const r3Total = Number.isFinite(r3.total_power) ? r3.total_power : r3.p1_power + r3.p2_power + r3.p3_power;

        return {
            timestamp: Math.max(Number(r1.timestamp), Number(r2.timestamp), Number(r3.timestamp)),
            time: r1.time || new Date().toISOString(),
            
            p1_loss: r1.p1_power - (r2.p1_power + r3.p1_power),
            p2_loss: r1.p2_power - (r2.p2_power + r3.p2_power),
            p3_loss: r1.p3_power - (r2.p3_power + r3.p3_power),
            total_loss: r1Total - (r2Total + r3Total),

            transformer: { p1: r1.p1_power, p2: r1.p2_power, p3: r1.p3_power, total: r1Total },
            new_building: { p1: r2.p1_power, p2: r2.p2_power, p3: r2.p3_power, total: r2Total },
            old_building: { p1: r3.p1_power, p2: r3.p2_power, p3: r3.p3_power, total: r3Total },
        };
    }, [d1, d2, d3, loading]);

    return { latest, loading, error };
}