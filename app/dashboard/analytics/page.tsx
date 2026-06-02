// app/analytics/page.tsx
'use client';

import { AnomalyAlertBanner } from "@/components/dashboard/anomaly-alert-banner";
import { ReadingsTable } from "@/components/dashboard/readings-table";
import { PowerMetricsGrid } from "@/components/dashboard/metric-card";
import { SensorAreaChart } from "@/components/dashboard/sensor-area-chart";
import { SensorBarChart } from "@/components/dashboard/sensor-bar-chart";
import { SensorChartGrid } from "@/components/dashboard/sensor-chart-grid";
import { SensorLineChart } from "@/components/dashboard/sensor-line-chart";
import {
  PHASE_OPTIONS,
  buildPhaseMetricConfigs,
  type PhaseKey,
} from "@/components/dashboard/sensor-chart-shared";
import { ThresholdStatsPanel } from "@/components/dashboard/threshold-stats-panel";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardReadings } from "@/components/dashboard/dashboard-readings-context";
import { useAuth } from "@/context/AuthContext";
import { useDevice } from "@/context/DeviceContext";
import { useAnomalyAlerts } from "@/hooks/use-anomaly-alerts";
import { useThresholds } from "@/hooks/use-thresholds";
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

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { selectedDeviceId } = useDevice();
  const activeDeviceId = selectedDeviceId ?? undefined;

  const { chartData, readingRecords, loading: chartLoading, error: chartError } = useDashboardReadings();
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
  const [phaseSelection, setPhaseSelection] = useState<Set<PhaseKey>>(
    () => new Set(PHASE_OPTIONS.map((phase) => phase.key))
  );

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

  const { alerts, dismissAlert, clearResolved } = useAnomalyAlerts(chartData, thresholds);

  const chartMetrics = buildPhaseMetricConfigs();

  useEffect(() => {
    if (!lastSavedAt || lastToastAt.current === lastSavedAt) return;
    lastToastAt.current = lastSavedAt;
    const title = lastSavedAction === 'reset' ? 'Thresholds reset' : 'Thresholds saved';
    const description = lastSavedMetric
      ? `${getMetricLabel(lastSavedMetric)} updated`
      : 'Your thresholds are up to date.';
    toast({ title, description });
  }, [lastSavedAction, lastSavedAt, lastSavedMetric, toast]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <PowerMetricsGrid
        deviceId={activeDeviceId}
      />

      <SensorChartGrid layout="1+2" title="Sensor Readings">
        <SensorLineChart
          title="Live Signal"
          data={chartData}
          metrics={chartMetrics}
          loading={chartLoading}
          error={chartError?.message ?? null}
          phaseSelection={phaseSelection}
          onPhaseSelectionChange={setPhaseSelection}
        />
        <SensorAreaChart
          title="Load Distribution"
          data={chartData}
          metrics={chartMetrics}
          loading={chartLoading}
          error={chartError?.message ?? null}
          phaseSelection={phaseSelection}
          onPhaseSelectionChange={setPhaseSelection}
        />
        <SensorBarChart
          title="Interval Averages"
          data={chartData}
          metrics={chartMetrics}
          loading={chartLoading}
          error={chartError?.message ?? null}
          phaseSelection={phaseSelection}
          onPhaseSelectionChange={setPhaseSelection}
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