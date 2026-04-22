'use client';

import { useState } from 'react';
import { Zap, Activity, Gauge, PenLine } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { SensorChart } from '@/components/dashboard/sensor-chart';

export default function DashboardPage() {
  const [selectedSensor] = useState('device_1');

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

  const metricsConfig = [
    { key: 'voltage' as const, color: '#2563eb', label: 'Voltage (V)' },
    { key: 'current' as const, color: '#f59e0b', label: 'Current (A)' },
    { key: 'power' as const, color: '#16a34a', label: 'Power (W)' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">

      {/* Status Cards */}
      {currentReading && (
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
      )}

      {/* Chart */}
      <SensorChart
        title="Electrical Output Metrics"
        data={chartData}
        loading={loading}
        error={error}
        metrics={metricsConfig}
      />
    </div>
  );
}