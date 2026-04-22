// ─── types/sensorChart.ts ─────────────────────────────────────────────────────
// Shared types, constants, and helpers used across all sensor chart components.

export interface ChartDataPoint {
    time: string;
    voltage?: number;
    current?: number;
    power?: number;
    [key: string]: string | number | undefined;
}

export interface MetricConfig {
    key: string;
    color: string;
    label: string;
    unit?: string;
}

export interface BaseChartProps {
    title: string;
    description?: string;
    data: ChartDataPoint[];
    metrics: MetricConfig[];
    loading?: boolean;
    error?: string | null;
    height?: number;
}

// ─── Shared time-range filter ─────────────────────────────────────────────────

export type ChartRange = '1m' | '5m' | '15m' | '1h' | 'all';

export const CHART_RANGES: { value: ChartRange; label: string }[] = [
    { value: '1m',  label: '1m' },
    { value: '5m',  label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h',  label: '1h' },
    { value: 'all', label: 'All' },
];

export function filterByRange(data: ChartDataPoint[], range: ChartRange): ChartDataPoint[] {
    if (range === 'all' || data.length === 0) return data;
    const counts: Record<ChartRange, number> = {
        '1m': 60, '5m': 300, '15m': 900, '1h': 3600, all: Infinity,
    };
    return data.slice(-counts[range]);
}

// ─── CSV download ─────────────────────────────────────────────────────────────

export function downloadCSV(data: ChartDataPoint[], filename: string) {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => row[h] ?? '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Shared custom tooltip ────────────────────────────────────────────────────

export function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm">
            <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.dataKey} className="flex items-center gap-2 text-[12px]">
                    <span
                        className="inline-block h-1.5 w-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                    <span className="ml-auto pl-4 font-mono font-medium text-foreground">
                        {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Shared chart card shell ──────────────────────────────────────────────────
// Wraps the title, controls strip, and chart area in a consistent card frame.

import { useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import { Download, ImageDown, Filter } from 'lucide-react';

interface ChartShellProps {
    title: string;
    description?: string;
    dataLength: number;
    activeRange: ChartRange;
    onRangeChange: (r: ChartRange) => void;
    metrics: MetricConfig[];
    visibleSeries: Set<string>;
    onToggleSeries: (key: string) => void;
    onDownloadCSV: () => void;
    onDownloadImage: () => void;
    loading?: boolean;
    children: React.ReactNode;
    chartRef?: RefObject<HTMLDivElement | null>;
}

export function ChartShell({
    title,
    description,
    dataLength,
    activeRange,
    onRangeChange,
    metrics,
    visibleSeries,
    onToggleSeries,
    onDownloadCSV,
    onDownloadImage,
    loading,
    children,
    chartRef,
}: ChartShellProps) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5">
                <div>
                    <h3 className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {title}
                    </h3>
                    {description && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{dataLength} points</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onDownloadImage}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <ImageDown className="h-3.5 w-3.5" />
                        Image
                    </button>
                    <button
                        onClick={onDownloadCSV}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-2">
                {/* Range */}
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3 w-3 text-muted-foreground" />
                    {CHART_RANGES.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => onRangeChange(value)}
                            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                activeRange === value
                                    ? 'bg-foreground text-background'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Series toggles */}
                <div className="flex items-center gap-1.5">
                    {metrics.map(({ key, color, label }) => {
                        const active = visibleSeries.has(key);
                        return (
                            <button
                                key={key}
                                onClick={() => onToggleSeries(key)}
                                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                                    active
                                        ? 'border-transparent'
                                        : 'border-border text-muted-foreground opacity-40'
                                }`}
                                style={
                                    active
                                        ? { backgroundColor: `${color}18`, borderColor: `${color}40`, color }
                                        : {}
                                }
                            >
                                <span
                                    className="inline-block h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: active ? color : 'currentColor' }}
                                />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chart area */}
            <div ref={chartRef} className="bg-background px-2 pb-4 pt-4">
                {children}
            </div>
        </div>
    );
}

// ─── Shared empty / loading / error states ────────────────────────────────────

export function ChartLoading() {
    return (
        <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                <p className="text-[12px] text-muted-foreground">Loading…</p>
            </div>
        </div>
    );
}

export function ChartError({ message }: { message: string }) {
    return (
        <div className="flex h-64 items-center justify-center">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
                {message}
            </div>
        </div>
    );
}

export function ChartEmpty() {
    return (
        <div className="flex h-64 items-center justify-center text-[13px] text-muted-foreground">
            No data in selected range
        </div>
    );
}

// ─── Shared axis / grid styles ────────────────────────────────────────────────

export const AXIS_STYLE = {
    fontSize: 11,
    fontFamily: 'var(--font-mono, monospace)',
    fill: 'hsl(var(--muted-foreground))',
};

export const GRID_PROPS = {
    strokeDasharray: '3 3' as const,
    stroke: 'hsl(var(--border))',
    strokeOpacity: 0.5,
    vertical: false,
};