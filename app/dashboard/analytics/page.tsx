// app/analytics/page.tsx
'use client';

import { AnalyticsHeader } from "@/components/dashboard/analytics-header";
import { AnomalyAlert, AnomalyAlertBanner } from "@/components/dashboard/anomaly-alert-banner";
import { AnomalyHistoryTable, AnomalyRecord, AlertSeverity, AlertMetric } from "@/components/dashboard/anomaly-history-table";
import { CorrelationPanel } from "@/components/dashboard/correlation-panel";
import { PowerMetricsGrid } from "@/components/dashboard/metric-card";
import { SensorAreaChart } from "@/components/dashboard/sensor-area-chart";
import { SensorBarChart } from "@/components/dashboard/sensor-bar-chart";
import { SensorChartGrid } from "@/components/dashboard/sensor-chart-grid";
import { SensorLineChart } from "@/components/dashboard/sensor-line-chart";
import { ThresholdStatsPanel } from "@/components/dashboard/threshold-stats-panel";
import { useCallback, useMemo, useState } from "react";
import { useDevice } from "@/context/DeviceContext";
import { useSensorData } from "@/hooks/use-sensor-data";
import { usePowerLoss } from "@/hooks/use-power-loss";
import { selectPowerLossDeviceIds } from "@/lib/device-utils";
import { buildSensorChartData } from "@/lib/sensor-chart-utils";

const METRICS = [
  {
    key: 'voltage', label: 'Voltage', unit: 'V', color: '#378ADD',
    defaultThresholds: { warning: 240, critical: 250 }
  },
  {
    key: 'current', label: 'Current', unit: 'A', color: '#BA7517',
    defaultThresholds: { warning: 16, critical: 18 }
  },
  {
    key: 'power', label: 'Power', unit: 'W', color: '#1D9E75',
    defaultThresholds: { warning: 3500, critical: 4500 }
  },
];

const DEFAULT_POWER_LOSS_DEVICE_IDS = {
  device1Id: 'power_monitor_01',
  device2Id: 'power_monitor_02',
  device3Id: 'power_monitor_03',
};
const POWER_LOSS_BUCKET_MS = 60_000;

// Threshold types for anomaly detection
type Threshold = { warning: number; critical: number };
type ThresholdConfig = Record<string, Threshold>;

export default function AnalyticsPage() {
  const { selectedDeviceId, selectedDevice, availableDevices } = useDevice();
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
  } = useSensorData(activeDeviceId, { limit: 1000 });

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

  const handleRefresh = () => { /* re-fetch your sensor data */ };
  const [thresholds, setThresholds] = useState<ThresholdConfig>(
    Object.fromEntries(METRICS.map((m) => [m.key, m.defaultThresholds])) as ThresholdConfig
  );

  const handleThresholdChange = useCallback(
    (key: string, type: 'warning' | 'critical', value: number) => {
      setThresholds((prev) => ({
        ...prev,
        [key]: { ...prev[key], [type]: value },
      }));
      // Your anomaly detection logic re-runs here with new thresholds
    },
    []
  );

  const handleThresholdReset = useCallback((key: string) => {
    const meta = METRICS.find((m) => m.key === key);
    if (meta) setThresholds((prev) => ({ ...prev, [key]: meta.defaultThresholds }));
  }, []);

  const chartData = useMemo(
    () => buildSensorChartData(sensorData, losses, POWER_LOSS_BUCKET_MS),
    [sensorData, losses]
  );

  const chartLoading = sensorLoading || lossLoading;
  const chartError = sensorError?.message ?? lossError?.message ?? null;

  const [alerts, setAlerts] = useState<AnomalyAlert[]>([
    {
      id: '1',
      severity: 'critical',
      status: 'active',
      metric: 'current',
      message: 'Current spike detected — exceeded critical threshold.',
      value: 18.9,
      unit: 'A',
      threshold: 18,
      timestamp: new Date().toISOString(),
    },
  ]);

  const metrics = [
    { key: 'voltage', color: '#378ADD', label: 'Voltage', unit: 'V' },
    { key: 'current', color: '#BA7517', label: 'Current', unit: 'A' },
    { key: 'power', color: '#1D9E75', label: 'Power', unit: 'W' },
  ];

  const chartMetrics = [
    { key: 'voltage', color: '#378ADD', label: 'Voltage' },
    { key: 'current', color: '#BA7517', label: 'Current' },
    { key: 'power', color: '#1D9E75', label: 'Power' },
    { key: 'power_loss', color: '#B91C1C', label: 'Power Loss' },
  ];
  const records: AnomalyRecord[] = Array.from({ length: 12 }).map((_, i) => {
    const minutesAgo = (12 - i) * 5; // spread entries across the past hour
    const triggeredAt = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const resolvedAt = new Date(Date.now() - (minutesAgo - 2) * 60 * 1000).toISOString();
    const isActive = i % 3 === 0; // some active, some resolved
    const sev: AlertSeverity = (i % 4 === 0 ? 'critical' : i % 4 === 1 ? 'warning' : 'info');
    const metricKey: AlertMetric = (i % 2 === 0 ? 'current' : 'voltage');
    const value = Math.round((metricKey === 'current' ? 18 + Math.random() * 2 : 230 + Math.random() * 4) * 10) / 10;
    return {
      id: String(i + 1),
      severity: sev,
      status: isActive ? 'active' : 'resolved',
      metric: metricKey,
      message: `${metricKey === 'current' ? 'Current spike' : 'Voltage fluctuation'} detected — check thresholds.`,
      value,
      unit: metricKey === 'current' ? 'A' : 'V',
      threshold: metricKey === 'current' ? 18 : 230,
      triggeredAt,
      resolvedAt: isActive ? undefined : resolvedAt,
      duration: isActive ? undefined : 120,
    } as AnomalyRecord;
  });

  return (
    <div className="container mx-auto p-6 space-y-8">
      <AnalyticsHeader
        isConnected={!sensorError && !sensorLoading}
        deviceName={selectedDevice?.name ?? 'Sensor Feed'}
        onRangeChange={(range) => console.log('range:', range)}
        onRefreshIntervalChange={(interval) => console.log('interval:', interval)}
        onRefresh={handleRefresh}
        loading={sensorLoading}
      />
      <PowerMetricsGrid
        deviceId={activeDeviceId}
        maxWatts={3000}
        maxVoltage={240}
        maxCurrent={16}
      />
      <AnomalyAlertBanner
        alerts={alerts}
        onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
        onClearResolved={() => setAlerts((prev) => prev.filter((a) => a.status === 'active'))}
      />
      <SensorChartGrid layout="1+2" title="Sensor Readings">
        <SensorLineChart
          title="Live Signal"
          data={chartData}
          metrics={chartMetrics}
          loading={chartLoading}
          error={chartError}
        />
        <SensorAreaChart
          title="Load Distribution"
          data={chartData}
          metrics={chartMetrics}
          loading={chartLoading}
          error={chartError}
        />
        <SensorBarChart
          title="Interval Averages"
          data={chartData}
          metrics={chartMetrics}
          loading={chartLoading}
          error={chartError}
        />
      </SensorChartGrid>

      <ThresholdStatsPanel
        metrics={METRICS}
        data={chartData}
        thresholds={thresholds}
        onThresholdChange={handleThresholdChange}
        onThresholdReset={handleThresholdReset}
      />

      <AnomalyHistoryTable records={records} pageSize={10} />

      <CorrelationPanel data={chartData} metrics={metrics} />
    </div>
  );
}