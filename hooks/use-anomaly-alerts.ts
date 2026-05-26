'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartDataPoint } from '@/components/dashboard/sensor-chart-shared';
import type { AnomalyAlert, AlertSeverity } from '@/components/dashboard/anomaly-alert-banner';
import {
    THRESHOLD_METRICS,
    getMetricLabel,
    getMetricMeta,
    getMetricUnit,
    getThresholdForSeverity,
    type ThresholdConfig,
    type ThresholdMetricKey,
} from '@/lib/thresholds';

interface UseAnomalyAlertsResult {
    alerts: AnomalyAlert[];
    dismissAlert: (id: string) => void;
    clearResolved: () => void;
}

function resolveSeverity(
    value: number,
    metric: ThresholdMetricKey,
    thresholds: ThresholdConfig
): AlertSeverity | null {
    if (value >= getThresholdForSeverity(metric, 'critical', thresholds)) return 'critical';
    if (value >= getThresholdForSeverity(metric, 'warning', thresholds)) return 'warning';
    return null;
}

function getLatestPoint(data: ChartDataPoint[]): ChartDataPoint | null {
    if (data.length === 0) return null;
    return data.reduce((latest, point) => {
        const latestTs = typeof latest.timestamp === 'number' ? latest.timestamp : -Infinity;
        const pointTs = typeof point.timestamp === 'number' ? point.timestamp : -Infinity;
        return pointTs > latestTs ? point : latest;
    }, data[0]);
}

function buildMessage(metric: ThresholdMetricKey, severity: AlertSeverity, value: number, unit: string): string {
    return `${getMetricLabel(metric)} is ${value.toFixed(2)} ${unit} — ${severity} threshold breached.`;
}

export function useAnomalyAlerts(
    data: ChartDataPoint[],
    thresholds: ThresholdConfig
): UseAnomalyAlertsResult {
    const [alertMap, setAlertMap] = useState<Record<string, AnomalyAlert>>({});
    const silencedKeys = useRef<Set<string>>(new Set());

    const latestPoint = useMemo(() => getLatestPoint(data), [data]);

    useEffect(() => {
        if (!latestPoint) return;

        const timestamp = typeof latestPoint.timestamp === 'number'
            ? latestPoint.timestamp
            : Date.now();
        const timestampIso = new Date(timestamp).toISOString();

        setAlertMap((prev) => {
            const next = { ...prev };

            for (const metric of THRESHOLD_METRICS) {
                const value = latestPoint[metric.key];
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    continue;
                }

                const meta = getMetricMeta(metric.key);
                const zeroStatus = meta?.zeroStatus ?? 'no-signal';
                if (value === 0 && zeroStatus === 'no-signal') {
                    const silenceKeyCritical = `${metric.key}:critical`;
                    const silenceKeyWarning = `${metric.key}:warning`;
                    silencedKeys.current.delete(silenceKeyCritical);
                    silencedKeys.current.delete(silenceKeyWarning);
                    const existing = next[metric.key];
                    if (existing && existing.status === 'active') {
                        next[metric.key] = {
                            ...existing,
                            status: 'resolved',
                            resolvedAt: timestampIso,
                        };
                    }
                    continue;
                }

                const severity = resolveSeverity(value, metric.key, thresholds);
                const silenceKeyCritical = `${metric.key}:critical`;
                const silenceKeyWarning = `${metric.key}:warning`;

                if (!severity) {
                    silencedKeys.current.delete(silenceKeyCritical);
                    silencedKeys.current.delete(silenceKeyWarning);
                    const existing = next[metric.key];
                    if (existing && existing.status === 'active') {
                        next[metric.key] = {
                            ...existing,
                            status: 'resolved',
                            resolvedAt: timestampIso,
                        };
                    }
                    continue;
                }

                const silenceKey = `${metric.key}:${severity}`;
                if (silencedKeys.current.has(silenceKey)) {
                    continue;
                }

                const threshold = getThresholdForSeverity(metric.key, severity, thresholds);
                const unit = getMetricUnit(metric.key);

                next[metric.key] = {
                    id: metric.key,
                    severity,
                    status: 'active',
                    metric: metric.key,
                    message: buildMessage(metric.key, severity, value, unit),
                    value,
                    unit,
                    threshold,
                    timestamp: timestampIso,
                };
            }

            return next;
        });
    }, [latestPoint, thresholds]);

    const dismissAlert = useCallback((id: string) => {
        setAlertMap((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            const alert = next[id];
            if (alert?.status === 'active') {
                silencedKeys.current.add(`${alert.metric}:${alert.severity}`);
            }
            delete next[id];
            return next;
        });
    }, []);

    const clearResolved = useCallback(() => {
        setAlertMap((prev) => {
            const next: Record<string, AnomalyAlert> = {};
            Object.values(prev).forEach((alert) => {
                if (alert.status === 'active') {
                    next[alert.id] = alert;
                }
            });
            return next;
        });
    }, []);

    const alerts = useMemo(() => {
        return Object.values(alertMap).sort((a, b) => {
            if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
    }, [alertMap]);

    return { alerts, dismissAlert, clearResolved };
}
