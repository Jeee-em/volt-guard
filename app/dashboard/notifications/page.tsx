'use client';

import { useState, useMemo } from 'react';
import { useSensorData } from '@/hooks/useSensorData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Bell,
} from 'lucide-react';

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  timestamp: number;
  sensor: string;
  read: boolean;
}

export default function NotificationsPage() {
  const [selectedSensor, setSelectedSensor] = useState('device_1');
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'info',
      title: 'Dashboard Started',
      message: 'Real-time monitoring has been initiated',
      timestamp: Date.now() - 5 * 60 * 1000,
      sensor: 'device_1',
      read: false,
    },
  ]);

  const { currentReading } = useSensorData(selectedSensor);

  // Generate alerts based on sensor thresholds
  const activeAlerts = useMemo(() => {
    const newAlerts: Alert[] = [];

    if (currentReading) {
      // Voltage warnings
      if (currentReading.voltage > 28 || currentReading.voltage < 20) {
        newAlerts.push({
          id: `voltage_${Date.now()}`,
          type: 'warning',
          title: 'Voltage Out of Range',
          message: `Current voltage: ${currentReading.voltage.toFixed(2)}V (Normal: 20-28V)`,
          timestamp: Date.now(),
          sensor: selectedSensor,
          read: false,
        });
      }

      // Temperature warnings
      if (currentReading.temperature > 35) {
        newAlerts.push({
          id: `temp_${Date.now()}`,
          type: 'critical',
          title: 'High Temperature Alert',
          message: `Temperature: ${currentReading.temperature.toFixed(1)}°C (Critical above 35°C)`,
          timestamp: Date.now(),
          sensor: selectedSensor,
          read: false,
        });
      }

      // Current warnings
      if (currentReading.current > 8) {
        newAlerts.push({
          id: `current_${Date.now()}`,
          type: 'warning',
          title: 'High Current Draw',
          message: `Current: ${currentReading.current.toFixed(2)}A (Threshold: 8A)`,
          timestamp: Date.now(),
          sensor: selectedSensor,
          read: false,
        });
      }
    }

    return newAlerts;
  }, [currentReading, selectedSensor]);

  const allAlerts = [...activeAlerts, ...alerts].sort(
    (a, b) => b.timestamp - a.timestamp
  );

  const unreadCount = allAlerts.filter((a) => !a.read).length;

  const handleMarkAsRead = (id: string) => {
    setAlerts(
      alerts.map((alert) =>
        alert.id === id ? { ...alert, read: true } : alert
      )
    );
  };

  const handleMarkAllAsRead = () => {
    setAlerts(alerts.map((alert) => ({ ...alert, read: true })));
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(alerts.filter((alert) => alert.id !== id));
  };

  const handleClearAll = () => {
    setAlerts([]);
  };

  const sensors = [
    { id: 'device_1', name: 'Device 1' },
    { id: 'device_2', name: 'Device 2' },
    { id: 'device_3', name: 'Device 3' },
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAlertBgColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-l-4 border-red-600';
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-600';
      default:
        return 'bg-blue-50 border-l-4 border-blue-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Notifications & Alerts
        </h1>
        <p className="text-slate-600">
          Monitor system alerts and notifications
        </p>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Critical</p>
              <p className="text-2xl font-bold text-slate-900">
                {allAlerts.filter((a) => a.type === 'critical').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Warnings</p>
              <p className="text-2xl font-bold text-slate-900">
                {allAlerts.filter((a) => a.type === 'warning').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Unread</p>
              <p className="text-2xl font-bold text-slate-900">{unreadCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Clock className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Total</p>
              <p className="text-2xl font-bold text-slate-900">
                {allAlerts.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Filter by Device
          </label>
          <select
            value={selectedSensor}
            onChange={(e) => setSelectedSensor(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Devices</option>
            {sensors.map((sensor) => (
              <option key={sensor.id} value={sensor.id}>
                {sensor.name}
              </option>
            ))}
          </select>
        </div>

        {allAlerts.length > 0 && (
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                variant="outline"
                className="border-slate-300"
              >
                Mark All as Read
              </Button>
            )}
            <Button
              onClick={handleClearAll}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Alerts List */}
      {allAlerts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            All Clear
          </h3>
          <p className="text-slate-600">
            No alerts or notifications at this time
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {allAlerts.map((alert) => (
            <Card key={alert.id} className={`p-4 ${getAlertBgColor(alert.type)}`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {alert.title}
                      </h3>
                      <p className="text-slate-700 text-sm mt-1">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                        <span>
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                        <span className="px-2 py-1 bg-white/50 rounded">
                          {sensors.find((s) => s.id === alert.sensor)?.name ||
                            alert.sensor}
                        </span>
                        {!alert.read && (
                          <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="flex-shrink-0 p-2 hover:bg-white/50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  {!alert.read && (
                    <button
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
