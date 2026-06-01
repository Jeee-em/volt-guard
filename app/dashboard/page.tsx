'use client';

import { PowerMetricsGrid } from '@/components/dashboard/metric-card';
import { useDashboardReadings } from '@/components/dashboard/dashboard-readings-context';
import { SensorChartGrid } from '@/components/dashboard/sensor-chart-grid';
import { SensorLineChart } from '@/components/dashboard/sensor-line-chart';
import { buildPhaseMetricConfigs } from '@/components/dashboard/sensor-chart-shared';
import { useDevice } from '@/context/DeviceContext';

export default function DashboardPage() {
  const { selectedDeviceId } = useDevice();
  const activeDeviceId = selectedDeviceId ?? undefined;

  const { chartData, loading: chartLoading, error: chartError } = useDashboardReadings();

  const chartMetrics = buildPhaseMetricConfigs();

  return (
    <div className="container mx-auto space-y-6 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <PowerMetricsGrid
        deviceId={activeDeviceId}
        device1Id="power_monitor_01"
        device2Id="power_monitor_02"
        device3Id="power_monitor_03"
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