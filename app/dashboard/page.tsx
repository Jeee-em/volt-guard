'use client';

import { useState } from 'react';
import { useSensorData } from '@/hooks/useSensorData';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Activity, AlertCircle, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  const [selectedSensor, setSelectedSensor] = useState('device_1');
  const { currentReading, historicalData, loading, error } =
    useSensorData(selectedSensor);

  const sensors = [
    { id: 'device_1', name: 'Device 1', icon: '⚡' },
    { id: 'device_2', name: 'Device 2', icon: '🔌' },
    { id: 'device_3', name: 'Device 3', icon: '🔋' },
  ];

  const formatChartData = () => {
    return historicalData.slice(-288).map((reading) => ({
      time: new Date(reading.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      voltage: Math.round(reading.voltage * 100) / 100,
      current: Math.round(reading.current * 100) / 100,
      power: Math.round(reading.power),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Monitoring Dashboard
        </h1>
        <p className="text-slate-600">
          Real-time sensor data and system status
        </p>
      </div>

      {/* Sensor Selection */}
      <div className="flex gap-2 flex-wrap">
        {sensors.map((sensor) => (
          <button
            key={sensor.id}
            onClick={() => setSelectedSensor(sensor.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedSensor === sensor.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
            }`}
          >
            {sensor.icon} {sensor.name}
          </button>
        ))}
      </div>

      {/* Status Cards */}
      {currentReading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium mb-1">
                  Voltage
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {currentReading.voltage.toFixed(2)}V
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Last update:{' '}
              {new Date(currentReading.timestamp).toLocaleTimeString()}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium mb-1">
                  Current
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {currentReading.current.toFixed(2)}A
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Normal range: 2-8A
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium mb-1">
                  Power
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {currentReading.power.toFixed(0)}W
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Real-time consumption
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium mb-1">
                  Temperature
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {currentReading.temperature.toFixed(1)}°C
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Normal: 20-30°C
            </p>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Voltage Trend
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
              <LineChart data={formatChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
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
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Power Consumption
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
              <LineChart data={formatChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
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

      {/* All Metrics Chart */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          All Metrics Overview
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
            <LineChart data={formatChartData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
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
