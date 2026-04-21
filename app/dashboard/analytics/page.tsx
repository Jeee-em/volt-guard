'use client';

import { useState } from 'react';
import { useSensorData } from '@/hooks/useSensorData';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { TrendingUp, Calendar } from 'lucide-react';

type TimeRange = '24h' | '7d' | '30d';

export default function AnalyticsPage() {
  const [selectedSensor, setSelectedSensor] = useState('device_1');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const { historicalData, loading, error } = useSensorData(selectedSensor);

  const sensors = [
    { id: 'device_1', name: 'Device 1' },
    { id: 'device_2', name: 'Device 2' },
    { id: 'device_3', name: 'Device 3' },
  ];

  const getRangeLabel = (range: TimeRange) => {
    switch (range) {
      case '24h':
        return 'Last 24 Hours';
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
    }
  };

  const getRangeMultiplier = (range: TimeRange) => {
    switch (range) {
      case '24h':
        return 288; // 24 hours * 60 minutes / 5 minute intervals
      case '7d':
        return 2016; // 7 days
      case '30d':
        return 8640; // 30 days
    }
  };

  const filterChartData = () => {
    const multiplier = getRangeMultiplier(timeRange);
    const filtered = historicalData.slice(-multiplier);

    return filtered.map((reading) => {
      const date = new Date(reading.timestamp);
      return {
        time:
          timeRange === '24h'
            ? date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : date.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              }),
        voltage: Math.round(reading.voltage * 100) / 100,
        current: Math.round(reading.current * 100) / 100,
        power: Math.round(reading.power),
        temperature: Math.round(reading.temperature * 10) / 10,
        humidity: Math.round(reading.humidity),
      };
    });
  };

  const calculateStats = () => {
    const multiplier = getRangeMultiplier(timeRange);
    const data = historicalData.slice(-multiplier);

    if (data.length === 0) {
      return {
        avgVoltage: 0,
        avgCurrent: 0,
        avgPower: 0,
        maxPower: 0,
        minPower: 0,
      };
    }

    const voltages = data.map((d) => d.voltage);
    const currents = data.map((d) => d.current);
    const powers = data.map((d) => d.power);

    return {
      avgVoltage:
        (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(2),
      avgCurrent:
        (currents.reduce((a, b) => a + b, 0) / currents.length).toFixed(2),
      avgPower: (powers.reduce((a, b) => a + b, 0) / powers.length).toFixed(0),
      maxPower: Math.max(...powers).toFixed(0),
      minPower: Math.min(...powers).toFixed(0),
    };
  };

  const stats = calculateStats();
  const chartData = filterChartData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics</h1>
        <p className="text-slate-600">Historical data and performance metrics</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        {/* Sensor Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select Device
          </label>
          <select
            value={selectedSensor}
            onChange={(e) => setSelectedSensor(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sensors.map((sensor) => (
              <option key={sensor.id} value={sensor.id}>
                {sensor.name}
              </option>
            ))}
          </select>
        </div>

        {/* Time Range Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Time Range
          </label>
          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:border-blue-400'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-slate-600 text-xs font-medium mb-1">
            Average Voltage
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.avgVoltage}V</p>
        </Card>

        <Card className="p-4">
          <p className="text-slate-600 text-xs font-medium mb-1">
            Average Current
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.avgCurrent}A</p>
        </Card>

        <Card className="p-4">
          <p className="text-slate-600 text-xs font-medium mb-1">
            Average Power
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.avgPower}W</p>
        </Card>

        <Card className="p-4">
          <p className="text-slate-600 text-xs font-medium mb-1">
            Peak Power
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.maxPower}W</p>
        </Card>

        <Card className="p-4">
          <p className="text-slate-600 text-xs font-medium mb-1">
            Min Power
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.minPower}W</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            Voltage Analysis
          </h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center text-slate-500">
              Loading...
            </div>
          ) : error ? (
            <div className="h-80 flex items-center justify-center text-red-500">
              {error}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                  tick={{ angle: -45, textAnchor: 'end', height: 80 }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => value.toFixed(2)}
                />
                <Line
                  type="monotone"
                  dataKey="voltage"
                  stroke="#2563eb"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-green-600" />
            Power Consumption Analysis
          </h2>
          {loading ? (
            <div className="h-80 flex items-center justify-center text-slate-500">
              Loading...
            </div>
          ) : error ? (
            <div className="h-80 flex items-center justify-center text-red-500">
              {error}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                  tick={{ angle: -45, textAnchor: 'end', height: 80 }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => `${value}W`}
                />
                <Bar dataKey="power" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Multi-metric Chart */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-slate-600" />
          {getRangeLabel(timeRange)} Overview
        </h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center text-slate-500">
            Loading...
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                tick={{ angle: -45, textAnchor: 'end', height: 80 }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="voltage"
                stroke="#2563eb"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="current"
                stroke="#f59e0b"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="power"
                stroke="#16a34a"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
