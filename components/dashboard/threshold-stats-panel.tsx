'use client';

import { useMemo, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { ChartDataPoint } from '@/components/dashboard/sensor-chart-shared';
import type { SignalThreshold, ThresholdConfig, ThresholdMetricKey, ThresholdMetricMeta } from '@/lib/thresholds';
import { Input } from '@/components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThresholdStatsPanelProps {
    metrics: ThresholdMetricMeta[];
    data: ChartDataPoint[];
    thresholds: ThresholdConfig;
    onThresholdChange: (metricKey: ThresholdMetricKey, type: 'warning' | 'critical', value: number) => void;
    onThresholdSave?: (metricKey: ThresholdMetricKey, values: SignalThreshold) => void;
    onThresholdReset?: (metricKey: ThresholdMetricKey) => void;
    saving?: boolean;
}

// ─── Statistics calculation ───────────────────────────────────────────────────

interface SignalStats {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    latest: number;
    trend: 'up' | 'down' | 'stable';
}

function computeStats(data: ChartDataPoint[], key: ThresholdMetricKey): SignalStats | null {
    const values = data
        .map((d) => d[key])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const latest = values[values.length - 1];

    // Trend from last 10% of window
    const window = values.slice(-Math.max(Math.ceil(values.length * 0.1), 5));
    const windowMean = window.reduce((a, b) => a + b, 0) / window.length;
    const trend =
        windowMean > mean * 1.02 ? 'up' :
        windowMean < mean * 0.98 ? 'down' : 'stable';

    return { min, max, mean, stdDev, latest, trend };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
    return n.toFixed(decimals);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function toPercent(value: number, min: number, max: number, fallback = 0) {
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return fallback;
    }
    return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

type ThresholdStatus = 'critical' | 'warning' | 'normal' | 'no-signal';

function getThresholdStatus(
    value: number,
    threshold: SignalThreshold,
    meta: ThresholdMetricMeta
): ThresholdStatus {
    const zeroStatus = meta.zeroStatus ?? 'no-signal';
    if (value === 0 && zeroStatus === 'no-signal') return 'no-signal';
    if (value >= threshold.critical) return 'critical';
    if (value >= threshold.warning) return 'warning';
    return 'normal';
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {label}
            </span>
            <span className="font-mono text-[15px] font-medium text-foreground">
                {value}
                <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{unit}</span>
            </span>
        </div>
    );
}

// ─── Threshold input row ──────────────────────────────────────────────────────

function ThresholdInput({
    label,
    value,
    unit,
    type,
    onChange,
}: {
    label: string;
    value: number;
    unit: string;
    type: 'warning' | 'critical';
    onChange: (v: number) => void;
}) {
    const Icon = type === 'critical' ? AlertCircle : AlertTriangle;
    const iconColor = type === 'critical' ? 'text-red-500' : 'text-amber-500';
    const borderColor = type === 'critical'
        ? 'focus-within:border-red-400'
        : 'focus-within:border-amber-400';

    return (
        <div className="flex items-center gap-2">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
            <span className="w-14 text-[11px] text-muted-foreground capitalize">{label}</span>
            <div className={`relative flex flex-1 items-center overflow-hidden rounded-md border border-border transition-colors ${borderColor}`}>
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="h-8 border-0 bg-transparent pr-10 text-right font-mono text-[12px] shadow-none focus-visible:ring-0"
                    step="0.1"
                />
                <span className="pointer-events-none absolute right-2.5 text-[11px] text-muted-foreground">
                    {unit}
                </span>
            </div>
        </div>
    );
}

// ─── Per-metric panel row ─────────────────────────────────────────────────────

function MetricPanel({
    meta,
    stats,
    threshold,
    onThresholdChange,
    onThresholdSave,
    onResetToDefault,
    saving,
}: {
    meta: ThresholdMetricMeta;
    stats: SignalStats | null;
    threshold: SignalThreshold;
    onThresholdChange: (type: 'warning' | 'critical', value: number) => void;
    onThresholdSave?: (values: SignalThreshold) => void;
    onResetToDefault?: () => void;
    saving?: boolean;
}) {
    const [open, setOpen] = useState(true);
    const [draft, setDraft] = useState<SignalThreshold>(threshold);

    useEffect(() => {
        setDraft(threshold);
    }, [threshold.warning, threshold.critical]);

    const isDirty = draft.warning !== threshold.warning || draft.critical !== threshold.critical;
    const isInvalid = draft.warning >= draft.critical;
    const canSave = isDirty && !isInvalid && !saving;

    const handleSave = () => {
        if (!canSave) return;
        const isDefault =
            draft.warning === meta.defaultThresholds.warning &&
            draft.critical === meta.defaultThresholds.critical;
        if (isDefault && onResetToDefault) {
            onResetToDefault();
            return;
        }
        if (onThresholdSave) {
            onThresholdSave(draft);
            return;
        }
        if (draft.warning !== threshold.warning) {
            onThresholdChange('warning', draft.warning);
        }
        if (draft.critical !== threshold.critical) {
            onThresholdChange('critical', draft.critical);
        }
    };

    const status = stats ? getThresholdStatus(stats.latest, draft, meta) : 'normal';
    const statusColors = {
        critical: 'text-red-500 bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
        warning:  'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
        normal:   'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800',
        'no-signal': 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-950/40 dark:border-slate-800',
    };
    const statusLabel = { critical: 'Critical', warning: 'Warning', normal: 'Normal', 'no-signal': 'No Signal' };

    const TrendIcon =
        stats?.trend === 'up' ? TrendingUp :
        stats?.trend === 'down' ? TrendingDown : Minus;
    const trendColor =
        stats?.trend === 'up' ? 'text-red-400' :
        stats?.trend === 'down' ? 'text-green-400' : 'text-muted-foreground';

    const hasRange = Boolean(stats && stats.max > stats.min);
    const warnPct = stats ? toPercent(draft.warning, stats.min, stats.max) : 0;
    const critPct = stats ? toPercent(draft.critical, stats.min, stats.max) : 0;
    const latestPct = stats ? toPercent(stats.latest, stats.min, stats.max, 50) : 0;
    const warnStart = Math.min(warnPct, critPct);
    const critStart = Math.max(warnPct, critPct);

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
            {/* Row header */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
            >
                {/* Color swatch */}
                <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.color }}
                />

                <span className="flex-1 text-[13px] font-medium text-foreground">
                    {meta.label}
                </span>

                {/* Latest value */}
                {stats && (
                    <span className="font-mono text-[13px] font-medium text-foreground">
                        {fmt(stats.latest)}
                        <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">
                            {meta.unit}
                        </span>
                    </span>
                )}

                {/* Trend */}
                {stats && (
                    <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                )}

                {/* Status badge */}
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColors[status]}`}>
                    {statusLabel[status]}
                </span>

                {open ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
            </button>

            {/* Expanded body */}
            {open && (
                <div className="border-t border-border px-4 pb-4 pt-3">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                        {/* ── Stats ── */}
                        <div>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Statistics
                            </p>
                            {stats ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <StatPill label="Min"    value={fmt(stats.min)}    unit={meta.unit} />
                                    <StatPill label="Max"    value={fmt(stats.max)}    unit={meta.unit} />
                                    <StatPill label="Mean"   value={fmt(stats.mean)}   unit={meta.unit} />
                                    <StatPill label="Std Dev" value={fmt(stats.stdDev)} unit={meta.unit} />
                                </div>
                            ) : (
                                <p className="text-[12px] text-muted-foreground">No data</p>
                            )}

                            {/* Range bar — shows where latest sits between min/max */}
                            {stats && (
                                <div className="mt-3">
                                    <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                                        <span>{fmt(stats.min)} {meta.unit}</span>
                                        <span className="text-foreground font-medium">
                                            Latest: {fmt(stats.latest)} {meta.unit}
                                        </span>
                                        <span>{fmt(stats.max)} {meta.unit}</span>
                                    </div>
                                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                            {/* Warning/Critical zones */}
                                            {hasRange && (
                                                <>
                                                    <div
                                                        className="absolute inset-y-0 bg-amber-200 dark:bg-amber-900"
                                                        style={{
                                                            left: `${warnStart}%`,
                                                            right: `${100 - critStart}%`,
                                                        }}
                                                    />
                                                    <div
                                                        className="absolute inset-y-0 bg-red-200 dark:bg-red-900"
                                                        style={{
                                                            left: `${critStart}%`,
                                                            right: 0,
                                                        }}
                                                    />
                                                </>
                                            )}
                                        {/* Latest marker */}
                                        <div
                                            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-foreground"
                                            style={{
                                                    left: `${latestPct}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Thresholds ── */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    Thresholds
                                </p>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setDraft({ ...meta.defaultThresholds })}
                                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        title="Reset to defaults"
                                    >
                                        <RotateCcw className="h-2.5 w-2.5" />
                                        Reset
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!canSave}
                                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <ThresholdInput
                                    label="Warning"
                                    value={draft.warning}
                                    unit={meta.unit}
                                    type="warning"
                                    onChange={(v) => setDraft((prev) => ({ ...prev, warning: v }))}
                                />
                                <ThresholdInput
                                    label="Critical"
                                    value={draft.critical}
                                    unit={meta.unit}
                                    type="critical"
                                    onChange={(v) => setDraft((prev) => ({ ...prev, critical: v }))}
                                />
                            </div>

                            {/* Validation hint */}
                            {isInvalid && (
                                <p className="mt-2 text-[11px] text-red-500">
                                    Warning must be below critical threshold.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ThresholdStatsPanel({
    metrics,
    data,
    thresholds,
    onThresholdChange,
    onThresholdSave,
    onThresholdReset,
    saving,
}: ThresholdStatsPanelProps) {
    const statsMap = useMemo(() => {
        const map: Record<string, SignalStats | null> = {};
        for (const m of metrics) {
            map[m.key] = computeStats(data, m.key);
        }
        return map;
    }, [data, metrics]);

    const sampleLabel = data.length === 1 ? 'sample' : 'samples';

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Statistics & Thresholds
                </h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">
                    {data.length} {sampleLabel}
                </span>
            </div>

            {/* One panel per metric */}
            {metrics.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No metrics configured.</p>
            ) : (
                <div className="space-y-2">
                    {metrics.map((meta) => (
                        <MetricPanel
                            key={meta.key}
                            meta={meta}
                            stats={statsMap[meta.key]}
                            threshold={thresholds[meta.key] ?? meta.defaultThresholds}
                            onThresholdChange={(type, value) =>
                                onThresholdChange(meta.key, type, value)
                            }
                            onThresholdSave={(values) => onThresholdSave?.(meta.key, values)}
                            onResetToDefault={() => onThresholdReset?.(meta.key)}
                            saving={saving}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}