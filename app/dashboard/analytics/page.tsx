// app/analytics/page.tsx
'use client';

import { AnalyticsHeader } from "@/components/dashboard/analytics-header";
import { AnomalyAlertBanner } from "@/components/dashboard/anomaly-alert-banner";
import { ReadingsTable, type ReadingRecord } from "@/components/dashboard/readings-table";
import { CorrelationPanel } from "@/components/dashboard/correlation-panel";
import { PowerMetricsGrid } from "@/components/dashboard/metric-card";
import { SensorAreaChart } from "@/components/dashboard/sensor-area-chart";
import { SensorBarChart } from "@/components/dashboard/sensor-bar-chart";
import { SensorChartGrid } from "@/components/dashboard/sensor-chart-grid";
import { SensorLineChart } from "@/components/dashboard/sensor-line-chart";
import { ThresholdStatsPanel } from "@/components/dashboard/threshold-stats-panel";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDevice } from "@/context/DeviceContext";
import { useSensorData } from "@/hooks/use-sensor-data";
import { usePowerLoss } from "@/hooks/use-power-loss";
import { useAnomalyAlerts } from "@/hooks/use-anomaly-alerts";
import { useThresholds } from "@/hooks/use-thresholds";
import { selectPowerLossDeviceIds } from "@/lib/device-utils";
import { buildSensorChartData } from "@/lib/sensor-chart-utils";
import { useToast } from "@/hooks/use-toast";
import {
  THRESHOLD_METRICS,
  getMetricLabel,
  type ThresholdMetricKey,
} from "@/lib/thresholds";

const DEFAULT_POWER_LOSS_DEVICE_IDS = {
  device1Id: 'power_monitor_01',
  device2Id: 'power_monitor_02',
  device3Id: 'power_monitor_03',
};
const POWER_LOSS_BUCKET_MS = 60_000;

export default function AnalyticsPage() {
  const { user } = useAuth();
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
  const {
    thresholds,
    saveThreshold,
    resetThreshold,
    saving,
    lastSavedAt,
    lastSavedMetric,
    lastSavedAction,
  } = useThresholds(user?.uid);
  const { toast } = useToast();
  const lastToastAt = useRef<number | null>(null);

  const handleThresholdChange = useCallback(
    (key: ThresholdMetricKey, type: 'warning' | 'critical', value: number) => {
      saveThreshold(key, { ...thresholds[key], [type]: value });
    },
    [saveThreshold, thresholds]
  );

  const handleThresholdSave = useCallback(
    (key: ThresholdMetricKey, values: { warning: number; critical: number }) => {
      saveThreshold(key, values);
    },
    [saveThreshold]
  );

  const handleThresholdReset = useCallback((key: ThresholdMetricKey) => {
    resetThreshold(key);
  }, [resetThreshold]);

  const chartData = useMemo(
    () => buildSensorChartData(sensorData, losses, POWER_LOSS_BUCKET_MS),
    [sensorData, losses]
  );

  const chartLoading = sensorLoading || lossLoading;
  const chartError = sensorError?.message ?? lossError?.message ?? null;

  const { alerts, dismissAlert, clearResolved } = useAnomalyAlerts(chartData, thresholds);

  const correlationMetrics = THRESHOLD_METRICS.filter((metric) => metric.key !== 'power_loss');

  const chartMetrics = THRESHOLD_METRICS.map(({ key, color, label }) => ({
    key,
    color,
    label,
  }));

  useEffect(() => {
    if (!lastSavedAt || lastToastAt.current === lastSavedAt) return;
    lastToastAt.current = lastSavedAt;
    const title = lastSavedAction === 'reset' ? 'Thresholds reset' : 'Thresholds saved';
    const description = lastSavedMetric
      ? `${getMetricLabel(lastSavedMetric)} updated`
      : 'Your thresholds are up to date.';
    toast({ title, description });
  }, [lastSavedAction, lastSavedAt, lastSavedMetric, toast]);

  const readingRecords = useMemo<ReadingRecord[]>(() => {
    if (chartData.length === 0) return [];
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
    <div className="container mx-auto p-6 space-y-8">
      <PowerMetricsGrid
        deviceId={activeDeviceId}
        device1Id={powerLossDeviceIds.device1Id}
        device2Id={powerLossDeviceIds.device2Id}
        device3Id={powerLossDeviceIds.device3Id}
        maxWatts={3000}
        maxVoltage={240}
        maxCurrent={16}
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
        metrics={THRESHOLD_METRICS}
        data={chartData}
        thresholds={thresholds}
        onThresholdChange={handleThresholdChange}
        onThresholdSave={handleThresholdSave}
        onThresholdReset={handleThresholdReset}
        saving={saving}
      />

      <AnomalyAlertBanner
        alerts={alerts}
        onDismiss={dismissAlert}
        onClearResolved={clearResolved}
      />

      <ReadingsTable 
        records={readingRecords} 
        thresholds={thresholds} 
        pageSize={10} />
    </div>
  );
}