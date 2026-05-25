import { PowerReading } from '@/hooks/use-sensor-data';

export interface AggregateData {
    count: number;
    // Sums
    p1_voltageSum: number;
    p1_currentSum: number;
    p1_powerSum: number;
    p2_voltageSum: number;
    p2_currentSum: number;
    p2_powerSum: number;
    p3_voltageSum: number;
    p3_currentSum: number;
    p3_powerSum: number;
    total_powerSum: number;
    // Min/Max
    p1_voltageMin: number; p1_voltageMax: number;
    p1_currentMin: number; p1_currentMax: number;
    p1_powerMin: number; p1_powerMax: number;
    p2_voltageMin: number; p2_voltageMax: number;
    p2_currentMin: number; p2_currentMax: number;
    p2_powerMin: number; p2_powerMax: number;
    p3_voltageMin: number; p3_voltageMax: number;
    p3_currentMin: number; p3_currentMax: number;
    p3_powerMin: number; p3_powerMax: number;
    total_powerMin: number; total_powerMax: number;
    lastUpdated: number;
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

export function getDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getISOWeekKey(timestamp: number): string {
    const date = new Date(timestamp);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getMonthKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getYearKey(timestamp: number): string {
    return new Date(timestamp).getFullYear().toString();
}

// ─── Data processing ─────────────────────────────────────────────────────────

export function processSensorData(readings: PowerReading[]): {
    daily: Record<string, AggregateData>;
    weekly: Record<string, AggregateData>;
    monthly: Record<string, AggregateData>;
    yearly: Record<string, AggregateData>;
} {
    const aggregates = {
        daily: {} as Record<string, AggregateData>,
        weekly: {} as Record<string, AggregateData>,
        monthly: {} as Record<string, AggregateData>,
        yearly: {} as Record<string, AggregateData>,
    };

    readings.forEach((reading) => {
        const timestamp = Number(reading.timestamp);
        processAggregate(aggregates.daily, getDateKey(timestamp), reading);
        processAggregate(aggregates.weekly, getISOWeekKey(timestamp), reading);
        processAggregate(aggregates.monthly, getMonthKey(timestamp), reading);
        processAggregate(aggregates.yearly, getYearKey(timestamp), reading);
    });

    return aggregates;
}

function processAggregate(
    aggregates: Record<string, AggregateData>,
    key: string,
    reading: PowerReading
): void {
    if (!aggregates[key]) {
        aggregates[key] = {
            count: 0,
            // Sums
            p1_voltageSum: 0, p1_currentSum: 0, p1_powerSum: 0,
            p2_voltageSum: 0, p2_currentSum: 0, p2_powerSum: 0,
            p3_voltageSum: 0, p3_currentSum: 0, p3_powerSum: 0,
            total_powerSum: 0,
            // Min/Max — seed with the first reading's values
            p1_voltageMin: reading.p1_voltage, p1_voltageMax: reading.p1_voltage,
            p1_currentMin: reading.p1_current, p1_currentMax: reading.p1_current,
            p1_powerMin: reading.p1_power, p1_powerMax: reading.p1_power,
            p2_voltageMin: reading.p2_voltage, p2_voltageMax: reading.p2_voltage,
            p2_currentMin: reading.p2_current, p2_currentMax: reading.p2_current,
            p2_powerMin: reading.p2_power, p2_powerMax: reading.p2_power,
            p3_voltageMin: reading.p3_voltage, p3_voltageMax: reading.p3_voltage,
            p3_currentMin: reading.p3_current, p3_currentMax: reading.p3_current,
            p3_powerMin: reading.p3_power, p3_powerMax: reading.p3_power,
            total_powerMin: reading.total_power, total_powerMax: reading.total_power,
            lastUpdated: Number(reading.timestamp),
        };
    }

    const agg = aggregates[key];
    agg.count++;

    // Accumulate sums
    agg.p1_voltageSum += reading.p1_voltage;
    agg.p1_currentSum += reading.p1_current;
    agg.p1_powerSum += reading.p1_power;
    agg.p2_voltageSum += reading.p2_voltage;
    agg.p2_currentSum += reading.p2_current;
    agg.p2_powerSum += reading.p2_power;
    agg.p3_voltageSum += reading.p3_voltage;
    agg.p3_currentSum += reading.p3_current;
    agg.p3_powerSum += reading.p3_power;
    agg.total_powerSum += reading.total_power;

    // Update min/max
    agg.p1_voltageMin = Math.min(agg.p1_voltageMin, reading.p1_voltage);
    agg.p1_voltageMax = Math.max(agg.p1_voltageMax, reading.p1_voltage);
    agg.p1_currentMin = Math.min(agg.p1_currentMin, reading.p1_current);
    agg.p1_currentMax = Math.max(agg.p1_currentMax, reading.p1_current);
    agg.p1_powerMin = Math.min(agg.p1_powerMin, reading.p1_power);
    agg.p1_powerMax = Math.max(agg.p1_powerMax, reading.p1_power);
    agg.p2_voltageMin = Math.min(agg.p2_voltageMin, reading.p2_voltage);
    agg.p2_voltageMax = Math.max(agg.p2_voltageMax, reading.p2_voltage);
    agg.p2_currentMin = Math.min(agg.p2_currentMin, reading.p2_current);
    agg.p2_currentMax = Math.max(agg.p2_currentMax, reading.p2_current);
    agg.p2_powerMin = Math.min(agg.p2_powerMin, reading.p2_power);
    agg.p2_powerMax = Math.max(agg.p2_powerMax, reading.p2_power);
    agg.p3_voltageMin = Math.min(agg.p3_voltageMin, reading.p3_voltage);
    agg.p3_voltageMax = Math.max(agg.p3_voltageMax, reading.p3_voltage);
    agg.p3_currentMin = Math.min(agg.p3_currentMin, reading.p3_current);
    agg.p3_currentMax = Math.max(agg.p3_currentMax, reading.p3_current);
    agg.p3_powerMin = Math.min(agg.p3_powerMin, reading.p3_power);
    agg.p3_powerMax = Math.max(agg.p3_powerMax, reading.p3_power);
    agg.total_powerMin = Math.min(agg.total_powerMin, reading.total_power);
    agg.total_powerMax = Math.max(agg.total_powerMax, reading.total_power);
    agg.lastUpdated = Number(reading.timestamp);
}

// ─── Analytics utilities ──────────────────────────────────────────────────────

export function calculateAverages(aggregate: AggregateData) {
    const c = aggregate.count;
    return {
        p1_voltage: Number((aggregate.p1_voltageSum / c).toFixed(2)),
        p1_current: Number((aggregate.p1_currentSum / c).toFixed(2)),
        p1_power: Number((aggregate.p1_powerSum / c).toFixed(2)),
        p2_voltage: Number((aggregate.p2_voltageSum / c).toFixed(2)),
        p2_current: Number((aggregate.p2_currentSum / c).toFixed(2)),
        p2_power: Number((aggregate.p2_powerSum / c).toFixed(2)),
        p3_voltage: Number((aggregate.p3_voltageSum / c).toFixed(2)),
        p3_current: Number((aggregate.p3_currentSum / c).toFixed(2)),
        p3_power: Number((aggregate.p3_powerSum / c).toFixed(2)),
        total_power: Number((aggregate.total_powerSum / c).toFixed(2)),
    };
}

export function calculateTrends(
    currentAggregate: AggregateData,
    previousAggregate: AggregateData
) {
    const current = calculateAverages(currentAggregate);
    const previous = calculateAverages(previousAggregate);

    const pct = (curr: number, prev: number) =>
        prev === 0 ? 0 : ((curr - prev) / prev) * 100;

    return {
        p1_voltage: pct(current.p1_voltage, previous.p1_voltage),
        p1_current: pct(current.p1_current, previous.p1_current),
        p1_power: pct(current.p1_power, previous.p1_power),
        p2_voltage: pct(current.p2_voltage, previous.p2_voltage),
        p2_current: pct(current.p2_current, previous.p2_current),
        p2_power: pct(current.p2_power, previous.p2_power),
        p3_voltage: pct(current.p3_voltage, previous.p3_voltage),
        p3_current: pct(current.p3_current, previous.p3_current),
        p3_power: pct(current.p3_power, previous.p3_power),
        total_power: pct(current.total_power, previous.total_power),
    };
}