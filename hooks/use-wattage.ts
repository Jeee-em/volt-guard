'use client';

import { useMemo } from 'react';
import { useAnalytics } from '@/hooks/use-analytics';

export type DeviceLabel = 'PT' | 'PN' | 'PO';

const DEVICE_LABEL_MAP: Record<string, DeviceLabel> = {
    power_monitor_01: 'PT',
    power_monitor_02: 'PN',
    power_monitor_03: 'PO',
};

export function getDeviceLabel(deviceId?: string): DeviceLabel {
    if (!deviceId) return 'PO';
    return DEVICE_LABEL_MAP[deviceId] ?? 'PO';
}

const DEVICE_FULL_NAME: Record<DeviceLabel, string> = {
    PT: 'Transformer',
    PN: 'New Building',
    PO: 'Old Building',
};

export function getDeviceFullName(label: DeviceLabel): string {
    return DEVICE_FULL_NAME[label];
}

export interface WattageData {
    wab: number;       // Direct from DB
    wbc: number;       // Direct from DB
    total: number;     // Direct from twm_total_power
    label: DeviceLabel;
    fullName: string;
    // Raw inputs for display
    Vab: number;
    Ia: number;
    Vbc: number;
    Ic: number;
    // Legacy fallbacks to prevent crashes
    v1: number;
    i1: number;
    v2: number;
    i2: number;
    timestamp?: number;
}

interface UseWattageResult {
    data: WattageData | null;
    loading: boolean;
    error: Error | null;
}

export function useWattage(deviceId?: string): UseWattageResult {
    const { data: analytics, loading, error } = useAnalytics(deviceId, 20);

    const data = useMemo<WattageData | null>(() => {
        const latest = analytics?.latestSingle;
        if (!latest) return null;

        // Map safely to the new two-wattmeter metrics
        const Vab = latest.Vab ?? (latest as any).p1_voltage ?? 0;
        const Ia = latest.Ia ?? (latest as any).p1_current ?? 0;
        const Vbc = latest.Vbc ?? (latest as any).p2_voltage ?? 0;
        const Ic = latest.Ic ?? (latest as any).p2_current ?? 0;

        // Pull direct powers from the DB, fallback to manual math if legacy data
        const wab = latest.Wab !== undefined ? latest.Wab : (Vab * Ia);
        const wbc = latest.Wbc !== undefined ? latest.Wbc : (Vbc * Ic);
        const total = latest.twm_total_power !== undefined ? latest.twm_total_power : (wab + wbc);
        
        const label = getDeviceLabel(deviceId);

        return {
            wab,
            wbc,
            total,
            label,
            fullName: getDeviceFullName(label),
            Vab,
            Ia,
            Vbc,
            Ic,
            // Keep legacy keys populated so you don't have to refactor everything immediately
            v1: Vab,
            i1: Ia,
            v2: Vbc,
            i2: Ic,
            timestamp: latest.timestamp,
        };
    }, [analytics, deviceId]);

    return { data, loading, error: error ?? null };
}