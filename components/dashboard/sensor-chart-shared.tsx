// ─── types/sensorChart.ts ─────────────────────────────────────────────────────
// Shared types, constants, and helpers used across all sensor chart components.

export interface ChartDataPoint {
    time: string;
    timestamp?: number;
    voltage?: number;
    current?: number;
    power?: number;
    p1_voltage?: number;
    p1_current?: number;
    p1_power?: number;
    p2_voltage?: number;
    p2_current?: number;
    p2_power?: number;
    p3_voltage?: number;
    p3_current?: number;
    p3_power?: number;
    total_power?: number;
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
    phaseSelection?: Set<PhaseKey>;
    onPhaseSelectionChange?: (phases: Set<PhaseKey>) => void;
}

// ─── Shared time-range filter ─────────────────────────────────────────────────

export type ChartRange = 'realtime' | 'today' | '24h' | '7d' | '30d' | 'custom';

export const CHART_RANGES: { value: ChartRange; label: string }[] = [
    { value: 'realtime', label: 'Real-Time' },
    { value: 'today', label: 'Today' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom' },
];

export type PhaseKey = 'p1' | 'p2' | 'p3';

export type PhaseMetricBaseKey = 'voltage' | 'current' | 'power';

export const PHASE_OPTIONS = [
    { key: 'p1', label: 'Phase 1', shortLabel: 'P1' },
    { key: 'p2', label: 'Phase 2', shortLabel: 'P2' },
    { key: 'p3', label: 'Phase 3', shortLabel: 'P3' },
] as const;

const PHASE_METRIC_BASES: Array<{ key: PhaseMetricBaseKey; label: string; colors: string[] }> = [
    { key: 'voltage', label: 'Voltage', colors: ['#2D7DD2', '#5AA1E3', '#8ABAEF'] },
    { key: 'current', label: 'Current', colors: ['#B45309', '#D97706', '#F59E0B'] },
    { key: 'power', label: 'Power', colors: ['#0F766E', '#14B8A6', '#2DD4BF'] },
];

export function buildPhaseMetricConfigs(): MetricConfig[] {
    return PHASE_OPTIONS.flatMap((phase, phaseIndex) =>
        PHASE_METRIC_BASES.map((metric) => ({
            key: `${phase.key}_${metric.key}`,
            label: `${phase.shortLabel} ${metric.label}`,
            color: metric.colors[phaseIndex] ?? metric.colors[metric.colors.length - 1],
        }))
    );
}

export function getPhaseKeyFromMetric(metricKey: string): PhaseKey | null {
    if (metricKey.startsWith('p1_')) return 'p1';
    if (metricKey.startsWith('p2_')) return 'p2';
    if (metricKey.startsWith('p3_')) return 'p3';
    return null;
}

export function filterMetricsByPhase(
    metrics: MetricConfig[],
    phases?: Set<PhaseKey>
): MetricConfig[] {
    if (!phases || phases.size === 0) return metrics;
    return metrics.filter((metric) => {
        const phaseKey = getPhaseKeyFromMetric(metric.key);
        return phaseKey ? phases.has(phaseKey) : false;
    });
}

import type { DateRange } from 'react-day-picker';

function startOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function endOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

export function filterByRange(
    data: ChartDataPoint[],
    range: ChartRange,
    customRange?: DateRange
): ChartDataPoint[] {
    if (data.length === 0) return data;

    const hasTimestamps = data.some(
        (point) => typeof point.timestamp === 'number' && Number.isFinite(point.timestamp)
    );

    if (range === 'realtime') {
        if (!hasTimestamps) return data.slice(-10);
        const sorted = [...data]
            .filter((point) => typeof point.timestamp === 'number' && Number.isFinite(point.timestamp))
            .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
        return sorted.slice(-10);
    }

    if (!hasTimestamps) return data;

    const now = Date.now();
    let start = Number.NEGATIVE_INFINITY;
    let end = now;

    if (range === 'today') {
        start = startOfDay(new Date(now));
    } else if (range === '24h') {
        start = now - 24 * 60 * 60 * 1000;
    } else if (range === '7d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        start = startOfDay(d);
    } else if (range === '30d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        start = startOfDay(d);
    } else if (range === 'custom') {
        const from = customRange?.from ? startOfDay(customRange.from) : undefined;
        const to = customRange?.to
            ? endOfDay(customRange.to)
            : customRange?.from
            ? endOfDay(customRange.from)
            : undefined;
        if (from === undefined && to === undefined) return data;
        start = from ?? Number.NEGATIVE_INFINITY;
        end = to ?? now;
    }

    return data.filter((point) => {
        const ts = point.timestamp;
        return typeof ts === 'number' && Number.isFinite(ts) && ts >= start && ts <= end;
    });
}

function roundValue(value: number, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function sumValues(values: Array<number | undefined>) {
    return values.reduce((total, value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return total;
        return total + value;
    }, 0);
}

function averageValues(values: Array<number | undefined>, options?: { ignoreZero?: boolean }) {
    const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (valid.length === 0) return 0;
    if (options?.ignoreZero) {
        const nonZero = valid.filter((v) => Math.abs(v) > 1e-9);
        if (nonZero.length > 0) {
            return nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length;
        }
    }
    return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function hasFinite(values: Array<number | undefined>) {
    return values.some((v) => typeof v === 'number' && Number.isFinite(v));
}

export function applyPhaseSelection(
    data: ChartDataPoint[],
    phases?: Set<PhaseKey>
): ChartDataPoint[] {
    if (!phases || phases.size === 0 || phases.size === PHASE_OPTIONS.length) return data;
    if (data.length === 0) return data;

    const selected = PHASE_OPTIONS.filter((phase) => phases.has(phase.key)).map((phase) => phase.key);
    if (selected.length === 0) return data;

    return data.map((point) => {
        const voltageValues = selected.map(
            (phase) => point[`${phase}_voltage`] as number | undefined
        );
        const currentValues = selected.map(
            (phase) => point[`${phase}_current`] as number | undefined
        );
        const powerValues = selected.map(
            (phase) => point[`${phase}_power`] as number | undefined
        );

        const voltage = hasFinite(voltageValues)
            ? roundValue(averageValues(voltageValues, { ignoreZero: true }), 2)
            : point.voltage;
        const current = hasFinite(currentValues)
            ? roundValue(averageValues(currentValues, { ignoreZero: true }), 2)
            : point.current;
        const power = hasFinite(powerValues)
            ? Math.round(sumValues(powerValues))
            : point.power;

        return {
            ...point,
            voltage,
            current,
            power,
        };
    });
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

import { useState, type RefObject } from 'react';
import { Download, ImageDown, Filter, ChevronDown, Check, Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChartShellProps {
    title: string;
    description?: string;
    dataLength: number;
    activeRange: ChartRange;
    onRangeChange: (r: ChartRange) => void;
    customRange?: DateRange;
    onCustomRangeChange?: (range: DateRange | undefined) => void;
    metrics: MetricConfig[];
    visibleSeries: Set<string>;
    onToggleSeries: (key: string) => void;
    phaseSelection?: Set<PhaseKey>;
    onTogglePhase?: (phase: PhaseKey) => void;
    onDownloadCSV: () => void;
    onDownloadImage: () => void;
    loading?: boolean;
    children: React.ReactNode;
    chartRef?: RefObject<HTMLDivElement | null>;
}

function formatRangeLabel(range?: DateRange): string {
    if (!range?.from) return 'Custom';
    const fromLabel = range.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!range.to) return `${fromLabel} - ...`;
    const toLabel = range.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fromLabel} - ${toLabel}`;
}

function formatPhaseLabel(phases: Set<PhaseKey>): string {
    const selected = PHASE_OPTIONS.filter((phase) => phases.has(phase.key));
    if (selected.length === 0) return 'Phases';
    if (selected.length === PHASE_OPTIONS.length) return 'All';
    return selected.map((phase) => phase.shortLabel).join(' + ');
}

export function ChartShell({
    title,
    description,
    dataLength,
    activeRange,
    onRangeChange,
    customRange,
    onCustomRangeChange,
    metrics,
    visibleSeries,
    onToggleSeries,
    phaseSelection,
    onTogglePhase,
    onDownloadCSV,
    onDownloadImage,
    loading,
    children,
    chartRef,
}: ChartShellProps) {
    const [customOpen, setCustomOpen] = useState(false);
    const activeLabel =
        activeRange === 'custom'
            ? formatRangeLabel(customRange)
            : CHART_RANGES.find((range) => range.value === activeRange)?.label ?? 'Range';
    const phaseLabel = phaseSelection ? formatPhaseLabel(phaseSelection) : 'Phases';

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
            <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-5 py-2 sm:flex-row sm:items-center sm:justify-between">
                {/* Range */}
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 text-[11px]"
                            >
                                <Filter className="h-3 w-3" />
                                <span className="truncate">Range: {activeLabel}</span>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            {CHART_RANGES.map(({ value, label }) => (
                                <DropdownMenuItem
                                    key={value}
                                    onClick={() => {
                                        onRangeChange(value);
                                        if (value === 'custom' && onCustomRangeChange) {
                                            setCustomOpen(true);
                                        }
                                    }}
                                    className="gap-2 text-[13px]"
                                >
                                    {label}
                                    {activeRange === value && <Check className="ml-auto h-3.5 w-3.5" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {phaseSelection && onTogglePhase && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 text-[11px]"
                                >
                                    <Layers className="h-3 w-3" />
                                    <span className="truncate">Phases: {phaseLabel}</span>
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40">
                                {PHASE_OPTIONS.map(({ key, label }) => (
                                    <DropdownMenuItem
                                        key={key}
                                        onClick={() => onTogglePhase(key)}
                                        className="gap-2 text-[13px]"
                                    >
                                        {label}
                                        {phaseSelection.has(key) && (
                                            <Check className="ml-auto h-3.5 w-3.5" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {activeRange === 'custom' && onCustomRangeChange && (
                        <Popover open={customOpen} onOpenChange={setCustomOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[11px]"
                                >
                                    {formatRangeLabel(customRange)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-0">
                                <Calendar
                                    mode="range"
                                    numberOfMonths={2}
                                    selected={customRange}
                                    onSelect={(range) => {
                                        onCustomRangeChange(range);
                                        onRangeChange('custom');
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                    )}
                </div>

                {/* Series toggles */}
                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
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