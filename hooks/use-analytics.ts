import { useState, useEffect } from 'react';
import { useSensorData } from './use-sensor-data';

interface PowerMetrics {
    // Per-phase voltage, current, power
    p1_voltage: number;
    p1_current: number;
    p1_power: number;
    p2_voltage: number;
    p2_current: number;
    p2_power: number;
    p3_voltage: number;
    p3_current: number;
    p3_power: number;
    // Totals
    total_power: number;
    timestamp?: number;
}

interface AnalyticsData {
    latest: PowerMetrics[];
    latestSingle: PowerMetrics;
    hourly: Record<string, PowerMetrics>;
    daily: Record<string, PowerMetrics>;
    dailyCurrentWeek?: PowerMetrics[];
    dailyArray?: PowerMetrics[];
    weekly: Record<string, PowerMetrics>;
    monthly: Record<string, PowerMetrics>;
}

export function useAnalytics(deviceId?: string, limit: number = 1000) {
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { data: sensorData, loading: sensorLoading } = useSensorData(deviceId, limit);

    useEffect(() => {
        if (sensorLoading || !sensorData.length) {
            return;
        }

        try {
            setLoading(true);

            // Get latest 10 readings for graphs
            const latest = sensorData.slice(-10).map(reading => ({
                p1_voltage: reading.p1_voltage,
                p1_current: reading.p1_current,
                p1_power: reading.p1_power,
                p2_voltage: reading.p2_voltage,
                p2_current: reading.p2_current,
                p2_power: reading.p2_power,
                p3_voltage: reading.p3_voltage,
                p3_current: reading.p3_current,
                p3_power: reading.p3_power,
                total_power: reading.total_power,
                timestamp: Number(reading.timestamp),
            }));

            // Get single latest reading for reports/dashboards
            const last = sensorData[sensorData.length - 1];
            const latestSingle: PowerMetrics = {
                p1_voltage: last.p1_voltage,
                p1_current: last.p1_current,
                p1_power: last.p1_power,
                p2_voltage: last.p2_voltage,
                p2_current: last.p2_current,
                p2_power: last.p2_power,
                p3_voltage: last.p3_voltage,
                p3_current: last.p3_current,
                p3_power: last.p3_power,
                total_power: last.total_power,
                timestamp: Number(last.timestamp),
            };

            // Initialize aggregation buckets
            const hourly: Record<string, any> = {};
            const daily: Record<string, any> = {};
            const weekly: Record<string, any> = {};
            const monthly: Record<string, any> = {};

            sensorData.forEach(reading => {
                const timestamp = Number(reading.timestamp);
                const date = new Date(timestamp);
                const today = new Date();

                // Hourly — only today's readings
                if (date.toDateString() === today.toDateString()) {
                    const hourlyKey = date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                    });
                    if (!hourly[hourlyKey]) {
                        hourly[hourlyKey] = { count: 0, sum: createEmptyMetrics() };
                    }
                    addToAggregation(hourly[hourlyKey], reading);
                }

                // Daily (for week/month views)
                const dailyKey = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                });

                // Weekly (week-of-year key)
                const weekNumber = getWeekNumber(date);
                const weeklyKey = `Week ${weekNumber}`;

                // Monthly
                const monthlyKey = date.toLocaleDateString('en-US', { month: 'short' });

                if (!daily[dailyKey]) daily[dailyKey] = { count: 0, sum: createEmptyMetrics() };
                if (!weekly[weeklyKey]) weekly[weeklyKey] = { count: 0, sum: createEmptyMetrics() };
                if (!monthly[monthlyKey]) monthly[monthlyKey] = { count: 0, sum: createEmptyMetrics() };

                addToAggregation(daily[dailyKey], reading);
                addToAggregation(weekly[weeklyKey], reading);
                addToAggregation(monthly[monthlyKey], reading);
            });

            // Ensure contiguous date/week/month buckets so UI filters show empty slots when no data
            const ensureDailyRange = (targetDays = 30) => {
                const today = new Date();
                for (let i = targetDays - 1; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - i);
                    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    if (!daily[key]) daily[key] = { count: 0, sum: createEmptyMetrics() };
                }
            };

            const ensureWeeklyForCurrentMonth = () => {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth();
                const firstOfMonth = new Date(year, month, 1);
                const lastOfMonth = new Date(year, month + 1, 0);
                const seen = new Set<number>();
                const weeksInOrder: number[] = [];
                for (let d = new Date(firstOfMonth); d <= lastOfMonth; d.setDate(d.getDate() + 1)) {
                    const w = getWeekNumber(new Date(d));
                    if (!seen.has(w)) {
                        seen.add(w);
                        weeksInOrder.push(w);
                    }
                }
                weeksInOrder.forEach(w => {
                    const key = `Week ${w}`;
                    if (!weekly[key]) weekly[key] = { count: 0, sum: createEmptyMetrics() };
                });
            };

            const ensureMonthsForYear = () => {
                const now = new Date();
                const year = now.getFullYear();
                for (let m = 0; m < 12; m++) {
                    const d = new Date(year, m, 1);
                    const key = d.toLocaleDateString('en-US', { month: 'short' });
                    if (!monthly[key]) monthly[key] = { count: 0, sum: createEmptyMetrics() };
                }
            };

            const dailyRangeDays = 120;
            ensureDailyRange(dailyRangeDays);
            ensureWeeklyForCurrentMonth();
            ensureMonthsForYear();

            // Average all aggregations
            const processAggregations = (data: Record<string, any>): Record<string, PowerMetrics> => {
                const result: Record<string, PowerMetrics> = {};
                Object.entries(data).forEach(([key, value]) => {
                    if (!value || !value.count) {
                        result[key] = createEmptyMetrics();
                    } else {
                        const c = value.count;
                        result[key] = {
                            p1_voltage: value.sum.p1_voltage / c,
                            p1_current: value.sum.p1_current / c,
                            p1_power: value.sum.p1_power / c,
                            p2_voltage: value.sum.p2_voltage / c,
                            p2_current: value.sum.p2_current / c,
                            p2_power: value.sum.p2_power / c,
                            p3_voltage: value.sum.p3_voltage / c,
                            p3_current: value.sum.p3_current / c,
                            p3_power: value.sum.p3_power / c,
                            total_power: value.sum.total_power / c,
                        };
                    }
                });
                return result;
            };

            const processedDaily = processAggregations(daily);

            // Ordered daily array (oldest → newest)
            const buildDailyArray = (targetDays = dailyRangeDays): PowerMetrics[] => {
                const arr: PowerMetrics[] = [];
                const today = new Date();
                for (let i = targetDays - 1; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - i);
                    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    arr.push(processedDaily[key] ?? createEmptyMetrics());
                }
                return arr;
            };

            // Ordered array for current week (Sunday → Saturday)
            const getStartOfWeek = (d: Date) => {
                const day = d.getDay();
                const start = new Date(d);
                start.setDate(d.getDate() - day);
                start.setHours(0, 0, 0, 0);
                return start;
            };

            const buildDailyCurrentWeek = (): PowerMetrics[] => {
                const today = new Date();
                const start = getStartOfWeek(today);
                const weekArr: PowerMetrics[] = [];
                for (let i = 0; i < 7; i++) {
                    const dd = new Date(start);
                    dd.setDate(start.getDate() + i);
                    const key = dd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    weekArr.push(processedDaily[key] ?? createEmptyMetrics());
                }
                return weekArr;
            };

            setAnalyticsData({
                latest,
                latestSingle,
                hourly: processAggregations(hourly),
                daily: processedDaily,
                dailyArray: buildDailyArray(dailyRangeDays),
                dailyCurrentWeek: buildDailyCurrentWeek(),
                weekly: processAggregations(weekly),
                monthly: processAggregations(monthly),
            });
        } catch (err) {
            console.error('Error processing analytics:', err);
            setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        } finally {
            setLoading(false);
        }
    }, [sensorData, sensorLoading]);

    return {
        data: analyticsData,
        raw: sensorData,
        loading: loading || sensorLoading,
        error,
    };
}

// ─── Helper functions ────────────────────────────────────────────────────────

function createEmptyMetrics(): PowerMetrics {
    return {
        p1_voltage: 0,
        p1_current: 0,
        p1_power: 0,
        p2_voltage: 0,
        p2_current: 0,
        p2_power: 0,
        p3_voltage: 0,
        p3_current: 0,
        p3_power: 0,
        total_power: 0,
    };
}

function addToAggregation(agg: any, reading: any) {
    agg.count++;
    agg.sum.p1_voltage += reading.p1_voltage;
    agg.sum.p1_current += reading.p1_current;
    agg.sum.p1_power += reading.p1_power;
    agg.sum.p2_voltage += reading.p2_voltage;
    agg.sum.p2_current += reading.p2_current;
    agg.sum.p2_power += reading.p2_power;
    agg.sum.p3_voltage += reading.p3_voltage;
    agg.sum.p3_current += reading.p3_current;
    agg.sum.p3_power += reading.p3_power;
    agg.sum.total_power += reading.total_power;
}

function getWeekNumber(date: Date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}