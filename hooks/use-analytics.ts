import { useState, useEffect } from 'react';
import { useSensorData } from './use-sensor-data';

interface PowerMetrics {
    Vab: number; Vbc: number; Vca: number;
    Ia: number; Ib: number; Ic: number;
    Wab: number; Wbc: number;
    twm_total_power: number;
    p1_voltage: number; p1_current: number; p1_power: number;
    p2_voltage: number; p2_current: number; p2_power: number;
    p3_voltage: number; p3_current: number; p3_power: number;
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

export function useAnalytics(deviceId?: string, limit?: number) {
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { data: sensorData, loading: sensorLoading } = useSensorData(deviceId, limit);

    useEffect(() => {
        if (sensorLoading || !sensorData.length) return;

        try {
            setLoading(true);

            const mapReading = (reading: any): PowerMetrics => ({
                Vab: reading.Vab, Vbc: reading.Vbc, Vca: reading.Vca,
                Ia: reading.Ia, Ib: reading.Ib, Ic: reading.Ic,
                Wab: reading.Wab, Wbc: reading.Wbc,
                twm_total_power: reading.twm_total_power,
                p1_voltage: reading.p1_voltage, p1_current: reading.p1_current, p1_power: reading.p1_power,
                p2_voltage: reading.p2_voltage, p2_current: reading.p2_current, p2_power: reading.p2_power,
                p3_voltage: reading.p3_voltage, p3_current: reading.p3_current, p3_power: reading.p3_power,
                total_power: reading.total_power,
                timestamp: Number(reading.timestamp),
            });

            const latest = sensorData.slice(-10).map(mapReading);
            const latestSingle = mapReading(sensorData[sensorData.length - 1]);

            const hourly: Record<string, any> = {};
            const daily: Record<string, any> = {};
            const weekly: Record<string, any> = {};
            const monthly: Record<string, any> = {};

            sensorData.forEach(reading => {
                const timestamp = Number(reading.timestamp);
                const date = new Date(timestamp);
                const today = new Date();

                if (date.toDateString() === today.toDateString()) {
                    const hourlyKey = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                    if (!hourly[hourlyKey]) hourly[hourlyKey] = { count: 0, sum: createEmptyMetrics() };
                    addToAggregation(hourly[hourlyKey], reading);
                }

                const dailyKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const weeklyKey = `Week ${getWeekNumber(date)}`;
                const monthlyKey = date.toLocaleDateString('en-US', { month: 'short' });

                if (!daily[dailyKey]) daily[dailyKey] = { count: 0, sum: createEmptyMetrics() };
                if (!weekly[weeklyKey]) weekly[weeklyKey] = { count: 0, sum: createEmptyMetrics() };
                if (!monthly[monthlyKey]) monthly[monthlyKey] = { count: 0, sum: createEmptyMetrics() };

                addToAggregation(daily[dailyKey], reading);
                addToAggregation(weekly[weeklyKey], reading);
                addToAggregation(monthly[monthlyKey], reading);
            });

            const dailyRangeDays = 120;
            // Pad empty buckets
            for (let i = dailyRangeDays - 1; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (!daily[key]) daily[key] = { count: 0, sum: createEmptyMetrics() };
            }

            const processAggregations = (dataObj: Record<string, any>): Record<string, PowerMetrics> => {
                const result: Record<string, PowerMetrics> = {};
                Object.entries(dataObj).forEach(([key, value]) => {
                    if (!value || !value.count) {
                        result[key] = createEmptyMetrics();
                    } else {
                        const c = value.count;
                        result[key] = {
                            Vab: value.sum.Vab / c, Vbc: value.sum.Vbc / c, Vca: value.sum.Vca / c,
                            Ia: value.sum.Ia / c, Ib: value.sum.Ib / c, Ic: value.sum.Ic / c,
                            Wab: value.sum.Wab / c, Wbc: value.sum.Wbc / c,
                            twm_total_power: value.sum.twm_total_power / c,
                            p1_voltage: value.sum.p1_voltage / c, p1_current: value.sum.p1_current / c, p1_power: value.sum.p1_power / c,
                            p2_voltage: value.sum.p2_voltage / c, p2_current: value.sum.p2_current / c, p2_power: value.sum.p2_power / c,
                            p3_voltage: value.sum.p3_voltage / c, p3_current: value.sum.p3_current / c, p3_power: value.sum.p3_power / c,
                            total_power: value.sum.total_power / c,
                        };
                    }
                });
                return result;
            };

            const processedDaily = processAggregations(daily);

            const buildDailyArray = (): PowerMetrics[] => {
                const arr: PowerMetrics[] = [];
                for (let i = dailyRangeDays - 1; i >= 0; i--) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    arr.push(processedDaily[key] ?? createEmptyMetrics());
                }
                return arr;
            };

            const buildDailyCurrentWeek = (): PowerMetrics[] => {
                const start = new Date(); start.setDate(start.getDate() - start.getDay()); start.setHours(0,0,0,0);
                const weekArr: PowerMetrics[] = [];
                for (let i = 0; i < 7; i++) {
                    const dd = new Date(start); dd.setDate(start.getDate() + i);
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
                dailyArray: buildDailyArray(),
                dailyCurrentWeek: buildDailyCurrentWeek(),
                weekly: processAggregations(weekly),
                monthly: processAggregations(monthly),
            });
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [sensorData, sensorLoading]);

    return { data: analyticsData, raw: sensorData, loading: loading || sensorLoading, error };
}

function createEmptyMetrics(): PowerMetrics {
    return {
        Vab: 0, Vbc: 0, Vca: 0, Ia: 0, Ib: 0, Ic: 0, Wab: 0, Wbc: 0, twm_total_power: 0,
        p1_voltage: 0, p1_current: 0, p1_power: 0, p2_voltage: 0, p2_current: 0, p2_power: 0, p3_voltage: 0, p3_current: 0, p3_power: 0, total_power: 0
    };
}

function addToAggregation(agg: any, reading: any) {
    agg.count++;
    Object.keys(agg.sum).forEach(key => {
        if (reading[key] !== undefined) agg.sum[key] += reading[key];
    });
}

function getWeekNumber(date: Date) {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date.getTime() - firstDay.getTime()) / 86400000) + firstDay.getDay() + 1) / 7);
}