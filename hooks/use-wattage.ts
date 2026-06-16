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
    wab: number;       // Phase 1: voltage1 × current1
    wbc: number;       // Phase 2: voltage2 × current2
    total: number;     // total = Wab + Wbc
    label: DeviceLabel;
    fullName: string;
    // Raw inputs for display
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

        const v1 = (latest as any)?.p1_voltage ?? 0;
        const i1 = (latest as any)?.p1_current ?? 0;
        const v2 = (latest as any)?.p2_voltage ?? 0;
        const i2 = (latest as any)?.p2_current ?? 0;

        const wab = v1 * i1;
        const wbc = v2 * i2;
        const label = getDeviceLabel(deviceId);

        return {
            wab,
            wbc,
            total: wab + wbc,
            label,
            fullName: getDeviceFullName(label),
            v1,
            i1,
            v2,
            i2,
            timestamp: latest.timestamp,
        };
    }, [analytics, deviceId]);

    return { data, loading, error: error ?? null };
}