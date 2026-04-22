'use client';

import { useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
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
import { Download, ImageDown, Filter } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartDataPoint {
    time: string;
    voltage?: number;
    current?: number;
    power?: number;
    [key: string]: string | number | undefined;
}

interface MetricConfig {
    key: keyof Omit<ChartDataPoint, 'time'>;
    color: string;
    label: string;
}

interface SensorChartProps {
    title: string;
    data: ChartDataPoint[];
    loading?: boolean;
    error?: string | null;
    metrics: MetricConfig[];
}

// ─── Time range filter options ────────────────────────────────────────────────

const TIME_RANGES = [
    { label: '1 min', seconds: 60 },
    { label: '5 min', seconds: 300 },
    { label: '15 min', seconds: 900 },
    { label: '1 hr', seconds: 3600 },
    { label: 'All', seconds: Infinity },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterByRange(data: ChartDataPoint[], seconds: number): ChartDataPoint[] {
    if (seconds === Infinity || data.length === 0) return data;
    return data.slice(-Math.min(data.length, Math.ceil(seconds)));
}

function downloadCSV(data: ChartDataPoint[], filename = 'sensor-data.csv') {
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm text-[12px]">
            <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.dataKey} className="flex items-center gap-2">
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

// ─── Component ────────────────────────────────────────────────────────────────

export function SensorChart({ title, data, loading, error, metrics }: SensorChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    // all series visible by default
    const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
        new Set(metrics.map((m) => m.key as string))
    );
    const [activeRange, setActiveRange] = useState<number>(Infinity);

    const filteredData = filterByRange(data, activeRange);

    const toggleSeries = useCallback((key: string) => {
        setVisibleSeries((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (next.size === 1) return prev; // keep at least one
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    // const handleDownloadImage = useCallback(async () => {
    //     if (!chartRef.current) return;
    //     const { default: html2canvas } = await import('html2canvas');
    //     const canvas = await html2canvas(chartRef.current, { backgroundColor: null });
    //     const url = canvas.toDataURL('image/png');
    //     const a = document.createElement('a');
    //     a.href = url;
    //     a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
    //     a.click();
    // }, [title]);

    return (
        <Card className="overflow-hidden p-0 shadow-none">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                    <h2 className="font-mono text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {title}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {filteredData.length} data points
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {}}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Download chart as image"
                    >
                        <ImageDown className="h-3.5 w-3.5" />
                        Image
                    </button>
                    <button
                        onClick={() => downloadCSV(filteredData, `${title}.csv`)}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Download visible data as CSV"
                    >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                    </button>
                </div>
            </div>

            {/* ── Controls bar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-2.5">
                {/* Time filter */}
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3 w-3 text-muted-foreground" />
                    <span className="mr-1 text-[11px] text-muted-foreground">Range</span>
                    {TIME_RANGES.map(({ label, seconds }) => (
                        <button
                            key={label}
                            onClick={() => setActiveRange(seconds)}
                            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                activeRange === seconds
                                    ? 'bg-foreground text-background'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Series toggles */}
                <div className="flex items-center gap-2">
                    {metrics.map(({ key, color, label }) => {
                        const k = key as string;
                        const active = visibleSeries.has(k);
                        return (
                            <button
                                key={k}
                                onClick={() => toggleSeries(k)}
                                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                                    active
                                        ? 'border-transparent text-foreground'
                                        : 'border-border text-muted-foreground opacity-50'
                                }`}
                                style={active ? { backgroundColor: `${color}18`, borderColor: `${color}40`, color } : {}}
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

            {/* ── Chart ── */}
            <div ref={chartRef} className="bg-background px-2 pb-4 pt-4">
                {loading ? (
                    <div className="flex h-80 items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                            <p className="text-[12px] text-muted-foreground">Loading sensor data…</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex h-80 items-center justify-center">
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
                            {error}
                        </div>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex h-80 items-center justify-center text-[13px] text-muted-foreground">
                        No data in selected range
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={380}>
                        <LineChart data={filteredData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                                strokeOpacity={0.5}
                                vertical={false}
                            />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                dy={6}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                width={40}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            {metrics.map(({ key, color, label }) =>
                                visibleSeries.has(key as string) ? (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        name={label}
                                        dataKey={key}
                                        stroke={color}
                                        strokeWidth={1.5}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                ) : null
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
}