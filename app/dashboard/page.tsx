'use client';

import { useMemo } from 'react';
import { PowerMetricsGrid } from '@/components/dashboard/metric-card';
import { SensorChartGrid } from '@/components/dashboard/sensor-chart-grid';
import { SensorLineChart } from '@/components/dashboard/sensor-line-chart';
import { useDevice } from '@/context/DeviceContext';
import { useSensorData } from '@/hooks/use-sensor-data';
import { usePowerLoss } from '@/hooks/use-power-loss';
import { selectPowerLossDeviceIds } from '@/lib/device-utils';
import { buildSensorChartData } from '@/lib/sensor-chart-utils';

const DEFAULT_POWER_LOSS_DEVICE_IDS = {
  device1Id: 'power_monitor_01',
  device2Id: 'power_monitor_02',
  device3Id: 'power_monitor_03',
};
const POWER_LOSS_BUCKET_MS = 60_000;

export default function DashboardPage() {
  const { selectedDeviceId, availableDevices } = useDevice();
  const activeDeviceId = selectedDeviceId ?? undefined;

  const powerLossDeviceIds = useMemo(
    () => selectPowerLossDeviceIds(
      availableDevices,
      selectedDeviceId,
      DEFAULT_POWER_LOSS_DEVICE_IDS
    ),
    [availableDevices, selectedDeviceId]
  );

  const {
    data: sensorData,
    loading: sensorLoading,
    error: sensorError,
  } = useSensorData(activeDeviceId, { limit: 500 });

  const {
    losses,
    loading: lossLoading,
    error: lossError,
  } = usePowerLoss(
    powerLossDeviceIds.device1Id,
    powerLossDeviceIds.device2Id,
    powerLossDeviceIds.device3Id,
    { bucketMs: POWER_LOSS_BUCKET_MS, limit: 600 }
  );

  const chartData = useMemo(
    () => buildSensorChartData(sensorData, losses, POWER_LOSS_BUCKET_MS),
    [sensorData, losses]
  );

  const chartLoading = sensorLoading || lossLoading;
  const chartError = sensorError?.message ?? lossError?.message ?? null;

  const chartMetrics = [
    { key: 'voltage', color: '#378ADD', label: 'Voltage' },
    { key: 'current', color: '#BA7517', label: 'Current' },
    { key: 'power', color: '#1D9E75', label: 'Power' },
    { key: 'power_loss', color: '#B91C1C', label: 'Power Loss' },
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <PowerMetricsGrid
        deviceId={activeDeviceId}
        device1Id={powerLossDeviceIds.device1Id}
        device2Id={powerLossDeviceIds.device2Id}
        device3Id={powerLossDeviceIds.device3Id}
        maxWatts={3000}
        maxVoltage={240}
        maxCurrent={16}
      />
      <SensorChartGrid layout="1col" title="Live Sensor Signal">
        <SensorLineChart
          title="Live Signal"
          data={chartData}
          metrics={chartMetrics}
          loading={chartLoading}
          error={chartError}
        />
      </SensorChartGrid>
    </div>
  );
}