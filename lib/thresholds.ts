export type ThresholdLevel = 'warning' | 'critical';
export type ThresholdMetricKey = 'voltage' | 'current' | 'power' | 'power_loss';
export type ThresholdSeverity = 'critical' | 'warning' | 'info';

export interface SignalThreshold {
    warning: number;
    critical: number;
}

export interface ThresholdMetricMeta {
    key: ThresholdMetricKey;
    label: string;
    unit: string;
    color: string;
    defaultThresholds: SignalThreshold;
    /** How to label zero values for this metric */
    zeroStatus?: 'normal' | 'no-signal';
}

export type ThresholdConfig = Record<ThresholdMetricKey, SignalThreshold>;

export const THRESHOLD_METRICS: ThresholdMetricMeta[] = [
    {
        key: 'voltage',
        label: 'Voltage',
        unit: 'V',
        color: '#378ADD',
        defaultThresholds: { warning: 240, critical: 250 },
        zeroStatus: 'no-signal',
    },
    {
        key: 'current',
        label: 'Current',
        unit: 'A',
        color: '#BA7517',
        defaultThresholds: { warning: 16, critical: 18 },
        zeroStatus: 'no-signal',
    },
    {
        key: 'power',
        label: 'Power',
        unit: 'W',
        color: '#1D9E75',
        defaultThresholds: { warning: 3500, critical: 4500 },
        zeroStatus: 'no-signal',
    },
    {
        key: 'power_loss',
        label: 'Power Loss',
        unit: 'W',
        color: '#B91C1C',
        defaultThresholds: { warning: 100, critical: 200 },
        zeroStatus: 'normal',
    },
];

export const THRESHOLD_METRIC_KEYS = THRESHOLD_METRICS.map((metric) => metric.key);

const THRESHOLD_MAP = new Map<ThresholdMetricKey, ThresholdMetricMeta>(
    THRESHOLD_METRICS.map((metric) => [metric.key, metric])
);

export function isThresholdMetricKey(metric: string): metric is ThresholdMetricKey {
    return THRESHOLD_METRIC_KEYS.includes(metric as ThresholdMetricKey);
}

export function getMetricMeta(metric: ThresholdMetricKey): ThresholdMetricMeta | undefined {
    return THRESHOLD_MAP.get(metric);
}

export function getMetricLabel(metric: ThresholdMetricKey): string {
    return getMetricMeta(metric)?.label ?? metric;
}

export function getMetricUnit(metric: ThresholdMetricKey): string {
    return getMetricMeta(metric)?.unit ?? '';
}

export function getDefaultThresholds(): ThresholdConfig {
    return THRESHOLD_METRICS.reduce((acc, metric) => {
        acc[metric.key] = { ...metric.defaultThresholds };
        return acc;
    }, {} as ThresholdConfig);
}

export function getThresholdValue(
    metric: ThresholdMetricKey,
    level: ThresholdLevel,
    thresholds?: ThresholdConfig
): number {
    const fallback = getMetricMeta(metric)?.defaultThresholds[level] ?? 0;
    if (!thresholds) return fallback;
    return thresholds[metric]?.[level] ?? fallback;
}

export function getThresholdForSeverity(
    metric: ThresholdMetricKey,
    severity: ThresholdSeverity,
    thresholds?: ThresholdConfig
): number {
    const level: ThresholdLevel = severity === 'critical' ? 'critical' : 'warning';
    return getThresholdValue(metric, level, thresholds);
}
