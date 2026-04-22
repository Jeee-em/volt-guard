// app/analytics/page.tsx
'use client';

import { AnalyticsHeader } from "@/components/dashboard/analytics-header";
import { AnomalyAlert, AnomalyAlertBanner } from "@/components/dashboard/anomaly-alert-banner";
import { AnomalyHistoryTable, AnomalyRecord, AlertSeverity, AlertMetric } from "@/components/dashboard/anomaly-history-table";
import { CorrelationPanel } from "@/components/dashboard/correlation-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SensorAreaChart } from "@/components/dashboard/sensor-area-chart";
import { SensorBarChart } from "@/components/dashboard/sensor-bar-chart";
import { SensorChartGrid } from "@/components/dashboard/sensor-chart-grid";
import { SensorLineChart } from "@/components/dashboard/sensor-line-chart";
import { ThresholdStatsPanel } from "@/components/dashboard/threshold-stats-panel";
import { Activity, Gauge, Zap } from "lucide-react";
import { useCallback } from "react";
import { useState } from "react";

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

// Threshold types for anomaly detection
type Threshold = { warning: number; critical: number };
type ThresholdConfig = Record<string, Threshold>;

export default function AnalyticsPage() {
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

  // 🔥 MOCK DATA (inline, no separate file)
  const mockHistoricalData = Array.from({ length: 300 }, (_, i) => {
    const now = Date.now();
    const timestamp = now - (300 - i) * 5 * 60 * 1000; // every 5 mins

    const hour = new Date(timestamp).getHours();

    // simulate realistic usage pattern
    const baseCurrent = hour >= 8 && hour <= 20 ? 5 : 2.5;

    const voltage = 220 + Math.random() * 6 - 3; // ~217–223V
    const current = baseCurrent + Math.random(); // ~2.5–6A
    const power = voltage * current;

    return {
      timestamp,
      voltage,
      current,
      power,
    };
  });

  const currentReading = mockHistoricalData[mockHistoricalData.length - 1];

  const loading = false;
  const error = null;

  // 🔥 Your existing formatter (unchanged)
  const formatChartData = () => {
    return mockHistoricalData.slice(-288).map((reading) => ({
      time: new Date(reading.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      voltage: Math.round(reading.voltage * 100) / 100,
      current: Math.round(reading.current * 100) / 100,
      power: Math.round(reading.power),
    }));
  };

  const chartData = formatChartData();

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
        isConnected={true}
        deviceName="Panel A · Node 01"
        onRangeChange={(range) => console.log('range:', range)}
        onRefreshIntervalChange={(interval) => console.log('interval:', interval)}
        onRefresh={handleRefresh}
        loading={false}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Active Power"
          value="4.82"
          unit="kW"
          icon={Zap}
          colorClass="text-green-700"
          bgClass="bg-green-100"
          status="Normal"
          rangePercent={48}
          rangeMin="0 kW"
          rangeMax="10 kW"
          delta="↑ 0.3 kW"
          lastUpdated="Updated 12s ago"
        />
        <MetricCard
          title="Voltage"
          value="231"
          unit="V"
          icon={Activity}
          colorClass="text-blue-700"
          bgClass="bg-blue-100"
          status="Stable"
          rangePercent={77}
          rangeMin="207 V"
          rangeMax="253 V"
          delta="± 0.4 V"
          lastUpdated="Updated 8s ago"
        />
        <MetricCard
          title="Current"
          value="18.6"
          unit="A"
          icon={Gauge}
          colorClass="text-amber-700"
          bgClass="bg-amber-100"
          status="High"
          rangePercent={93}
          rangeMin="0 A"
          rangeMax="20 A"
          delta="↑ 2.1 A"
          lastUpdated="Updated 3s ago"
        />
        {/* <MetricCard
            title="Power Factor"
            value="0.94"
            unit="pf"
            icon={PenLine}
            colorClass="text-purple-700"
            bgClass="bg-purple-100"
            status="Good"
            rangePercent={94}
            rangeMin="0.0"
            rangeMax="1.0"
            delta="↓ 0.01"
            lastUpdated="Updated 15s ago"
          /> */}
      </div>
      <AnomalyAlertBanner
        alerts={alerts}
        onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
        onClearResolved={() => setAlerts((prev) => prev.filter((a) => a.status === 'active'))}
      />
      <SensorChartGrid layout="1+2" title="Sensor Readings">
        <SensorLineChart title="Live Signal" data={chartData} metrics={metrics} />
        <SensorAreaChart title="Load Distribution" data={chartData} metrics={metrics} />
        <SensorBarChart title="Interval Averages" data={chartData} metrics={metrics} />
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