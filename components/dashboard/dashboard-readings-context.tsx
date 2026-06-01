'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useDevice } from '@/context/DeviceContext';
import { useSensorData } from '@/hooks/use-sensor-data';
import { usePowerLoss, type PowerLossReading } from '@/hooks/use-power-loss';
import { selectPowerLossDeviceIds } from '@/lib/device-utils';
import { buildSensorChartData } from '@/lib/sensor-chart-utils';
import { THRESHOLD_METRICS } from '@/lib/thresholds';

const POWER_LOSS_BUCKET_MS = 60_000;

interface DashboardReadingsContextValue {
    loading: boolean;
    error: Error | null;
    chartData: ReturnType<typeof buildSensorChartData>;
    readingRecords: Array<{
        id: string;
        metric: (typeof THRESHOLD_METRICS)[number]['key'];
        value: number;
        unit: string;
        recordedAt: string;
    }>;
    losses: PowerLossReading[];
    lossesLoading: boolean;
    lossesError: Error | null;
}

const DashboardReadingsContext = createContext<DashboardReadingsContextValue | undefined>(undefined);

export function DashboardReadingsProvider({ children }: { children: ReactNode }) {
    const { selectedDeviceId, availableDevices } = useDevice();
    const { data: sensorData, loading, error } = useSensorData(selectedDeviceId ?? undefined);
    const powerLossDeviceIds = useMemo(
        () => selectPowerLossDeviceIds(availableDevices, selectedDeviceId, {
            device1Id: 'power_monitor_01',
            device2Id: 'power_monitor_02',
            device3Id: 'power_monitor_03',
        }),
        [availableDevices, selectedDeviceId]
    );
    const {
        losses,
        loading: lossesLoading,
        error: lossesError,
    } = usePowerLoss(
        powerLossDeviceIds.device1Id,
        powerLossDeviceIds.device2Id,
        powerLossDeviceIds.device3Id,
        { bucketMs: POWER_LOSS_BUCKET_MS, limit: 600 }
    );

    const chartData = useMemo(
        () => buildSensorChartData(sensorData, losses, POWER_LOSS_BUCKET_MS),
        [losses, sensorData]
    );

    const readingRecords = useMemo(() => {
        return chartData.flatMap((point) => {
            if (typeof point.timestamp !== 'number' || !Number.isFinite(point.timestamp)) return [];
            const recordedAt = new Date(point.timestamp).toISOString();
            return THRESHOLD_METRICS.flatMap((metric) => {
                const value = point[metric.key];
                if (typeof value !== 'number' || !Number.isFinite(value)) return [];
                return [{
                    id: `${point.timestamp}-${metric.key}`,
                    metric: metric.key,
                    value,
                    unit: metric.unit,
                    recordedAt,
                }];
            });
        });
    }, [chartData]);

    return (
        <DashboardReadingsContext.Provider
            value={{
                loading,
                error,
                chartData,
                readingRecords,
                losses,
                lossesLoading,
                lossesError,
            }}
        >
            {children}
        </DashboardReadingsContext.Provider>
    );
}

export function useDashboardReadings() {
    const context = useContext(DashboardReadingsContext);
    if (!context) {
        throw new Error('useDashboardReadings must be used within a DashboardReadingsProvider');
    }
    return context;
}