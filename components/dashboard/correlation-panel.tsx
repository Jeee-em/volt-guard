'use client';

import { useMemo, useState, useCallback } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { Download, Grid3X3, ScatterChart as ScatterIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SensorDataPoint {
    time: string;
    [key: string]: string | number;
}

export interface MetricMeta {
    key: string;
    label: string;
    unit: string;
    color: string;
}

export interface CorrelationPanelProps {
    data: SensorDataPoint[];
    metrics: MetricMeta[];
}

type ViewMode = 'heatmap' | 'scatter';

interface CorrelationEntry {
    rowKey: string;
    colKey: string;
    r: number;       // Pearson -1 … 1
    n: number;       // sample count
}

interface ScatterPoint {
    x: number;
    y: number;
}

interface TooltipPayloadItem {
    name: string;
    value: number;
    payload: ScatterPoint;
}

interface ScatterTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    xMeta: MetricMeta;
    yMeta: MetricMeta;
}

// ─── Pearson correlation ──────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n < 2) return 0;

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        num  += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    const denom = Math.sqrt(denX * denY);
    return denom === 0 ? 0 : num / denom;
}

// ─── Linear regression for scatter trendline ─────────────────────────────────

interface RegressionResult {
    slope: number;
    intercept: number;
    minX: number;
    maxX: number;
}

function linearRegression(points: ScatterPoint[]): RegressionResult | null {
    const n = points.length;
    if (n < 2) return null;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (ys[i] - meanY);
        den += (xs[i] - meanX) ** 2;
    }
    if (den === 0) return null;

    const slope     = num / den;
    const intercept = meanY - slope * meanX;
    return { slope, intercept, minX: Math.min(...xs), maxX: Math.max(...xs) };
}

// ─── Color scale for heatmap cells ───────────────────────────────────────────
// Maps r ∈ [-1, 1] → a color:
//   -1  → blue (strong negative)
//    0  → neutral (off-white / muted)
//   +1  → teal (strong positive)

function rToColor(r: number): string {
    const abs = Math.abs(r);
    if (r >= 0) {
        // neutral → teal
        const g = Math.round(158 + (9  - 158) * abs);   // 158 → 9
        const b = Math.round(203 + (117 - 203) * abs);  // 203 → 117
        const rr = Math.round(225 + (29  - 225) * abs); // 225 → 29
        return `rgb(${rr},${g},${b})`;
    } else {
        // neutral → blue
        const rr = Math.round(225 + (55  - 225) * abs); // 225 → 55
        const g  = Math.round(225 + (136 - 225) * abs); // 225 → 136
        const b  = Math.round(225 + (221 - 225) * abs); // 225 → 221
        return `rgb(${rr},${g},${b})`;
    }
}

function rToTextColor(r: number): string {
    return Math.abs(r) > 0.45 ? '#fff' : 'hsl(var(--foreground))';
}

function rToLabel(r: number): string {
    if (Math.abs(r) >= 0.8) return r > 0 ? 'Strong +' : 'Strong −';
    if (Math.abs(r) >= 0.5) return r > 0 ? 'Moderate +' : 'Moderate −';
    if (Math.abs(r) >= 0.2) return r > 0 ? 'Weak +' : 'Weak −';
    return 'None';
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCorrelationCSV(matrix: CorrelationEntry[], metrics: MetricMeta[]): void {
    const labels = metrics.map((m) => m.label);
    const header = ['', ...labels].join(',');
    const rows = metrics.map((row) => {
        const cells = metrics.map((col) => {
            if (row.key === col.key) return '1.00';
            const entry = matrix.find(
                (e) => e.rowKey === row.key && e.colKey === col.key
            );
            return entry ? entry.r.toFixed(4) : '';
        });
        return [row.label, ...cells].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'correlation-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Scatter tooltip ──────────────────────────────────────────────────────────

function ScatterTooltipContent({ active, payload, xMeta, yMeta }: ScatterTooltipProps) {
    if (!active || !payload?.length) return null;
    const pt = payload[0].payload;
    return (
        <div className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm">
            <div className="flex flex-col gap-1 text-[12px]">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{xMeta.label}</span>
                    <span className="ml-auto font-mono font-medium text-foreground">
                        {pt.x.toFixed(3)} {xMeta.unit}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{yMeta.label}</span>
                    <span className="ml-auto font-mono font-medium text-foreground">
                        {pt.y.toFixed(3)} {yMeta.unit}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Heatmap view ─────────────────────────────────────────────────────────────

interface HeatmapViewProps {
    matrix: CorrelationEntry[];
    metrics: MetricMeta[];
}

function HeatmapView({ matrix, metrics }: HeatmapViewProps) {
    const [hovered, setHovered] = useState<string | null>(null);

    return (
        <div className="overflow-x-auto">
            <table className="mx-auto border-separate border-spacing-1">
                <thead>
                    <tr>
                        <th className="w-24" />
                        {metrics.map((m) => (
                            <th
                                key={m.key}
                                className="pb-2 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
                                style={{ width: 88 }}
                            >
                                {m.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {metrics.map((rowMeta) => (
                        <tr key={rowMeta.key}>
                            <td className="pr-2 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                {rowMeta.label}
                            </td>
                            {metrics.map((colMeta) => {
                                const isSelf = rowMeta.key === colMeta.key;
                                const cellId = `${rowMeta.key}:${colMeta.key}`;
                                const entry  = matrix.find(
                                    (e) => e.rowKey === rowMeta.key && e.colKey === colMeta.key
                                );
                                const r   = isSelf ? 1 : (entry?.r ?? 0);
                                const bg  = rToColor(r);
                                const fg  = rToTextColor(r);
                                const isHovered = hovered === cellId;

                                return (
                                    <td key={colMeta.key} className="p-0">
                                        <div
                                            onMouseEnter={() => setHovered(cellId)}
                                            onMouseLeave={() => setHovered(null)}
                                            className="relative flex h-[72px] w-[84px] cursor-default flex-col items-center justify-center rounded-lg transition-transform"
                                            style={{
                                                backgroundColor: bg,
                                                transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                                            }}
                                        >
                                            <span
                                                className="font-mono text-[15px] font-medium leading-none"
                                                style={{ color: fg }}
                                            >
                                                {isSelf ? '—' : r.toFixed(2)}
                                            </span>
                                            {!isSelf && (
                                                <span
                                                    className="mt-1 text-[9px] font-medium uppercase tracking-wider opacity-80"
                                                    style={{ color: fg }}
                                                >
                                                    {rToLabel(r)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-3">
                <span className="text-[10px] text-muted-foreground">−1</span>
                <div
                    className="h-2 w-48 rounded-full"
                    style={{
                        background: `linear-gradient(to right, ${rToColor(-1)}, ${rToColor(0)}, ${rToColor(1)})`,
                    }}
                />
                <span className="text-[10px] text-muted-foreground">+1</span>
                <div className="ml-4 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: rToColor(-1) }} />
                        Negative
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: rToColor(0) }} />
                        None
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: rToColor(1) }} />
                        Positive
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Scatter view ─────────────────────────────────────────────────────────────

interface ScatterViewProps {
    data: SensorDataPoint[];
    metrics: MetricMeta[];
    matrix: CorrelationEntry[];
}

function ScatterView({ data, metrics, matrix }: ScatterViewProps) {
    const [xKey, setXKey] = useState<string>(metrics[0]?.key ?? '');
    const [yKey, setYKey] = useState<string>(metrics[1]?.key ?? metrics[0]?.key ?? '');

    const xMeta = metrics.find((m) => m.key === xKey) ?? metrics[0];
    const yMeta = metrics.find((m) => m.key === yKey) ?? metrics[1] ?? metrics[0];

    const points = useMemo<ScatterPoint[]>(() => {
        return data.reduce<ScatterPoint[]>((acc, d) => {
            const xv = d[xKey];
            const yv = d[yKey];
            if (typeof xv === 'number' && typeof yv === 'number' && !isNaN(xv) && !isNaN(yv)) {
                acc.push({ x: xv, y: yv });
            }
            return acc;
        }, []);
    }, [data, xKey, yKey]);

    const regression = useMemo(() => linearRegression(points), [points]);

    const rEntry = matrix.find(
        (e) => e.rowKey === xKey && e.colKey === yKey
    );
    const r = xKey === yKey ? 1 : (rEntry?.r ?? 0);

    const trendPoints = useMemo<ScatterPoint[]>(() => {
        if (!regression) return [];
        return [
            { x: regression.minX, y: regression.slope * regression.minX + regression.intercept },
            { x: regression.maxX, y: regression.slope * regression.maxX + regression.intercept },
        ];
    }, [regression]);

    const AXIS_STYLE = {
        fontSize: 11,
        fontFamily: 'var(--font-mono, monospace)',
        fill: 'hsl(var(--muted-foreground))',
    } as const;

    return (
        <div className="space-y-4">
            {/* Axis selectors */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">X axis</span>
                    <div className="flex gap-1">
                        {metrics.map((m) => (
                            <button
                                key={m.key}
                                onClick={() => setXKey(m.key)}
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                                    xKey === m.key
                                        ? 'border-transparent'
                                        : 'border-border text-muted-foreground opacity-50'
                                }`}
                                style={
                                    xKey === m.key
                                        ? { backgroundColor: `${m.color}18`, borderColor: `${m.color}40`, color: m.color }
                                        : {}
                                }
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Y axis</span>
                    <div className="flex gap-1">
                        {metrics.map((m) => (
                            <button
                                key={m.key}
                                onClick={() => setYKey(m.key)}
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                                    yKey === m.key
                                        ? 'border-transparent'
                                        : 'border-border text-muted-foreground opacity-50'
                                }`}
                                style={
                                    yKey === m.key
                                        ? { backgroundColor: `${m.color}18`, borderColor: `${m.color}40`, color: m.color }
                                        : {}
                                }
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Correlation readout */}
                <div className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                    <span className="text-[11px] text-muted-foreground">r =</span>
                    <span
                        className="font-mono text-[15px] font-medium"
                        style={{ color: rToColor(r) === rToColor(0) ? 'hsl(var(--foreground))' : rToColor(r) }}
                    >
                        {xKey === yKey ? '1.00' : r.toFixed(3)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        {xKey === yKey ? '(same metric)' : rToLabel(r)}
                    </span>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.5}
                        vertical={true}
                    />
                    <XAxis
                        dataKey="x"
                        type="number"
                        name={xMeta?.label}
                        unit={` ${xMeta?.unit ?? ''}`}
                        tick={AXIS_STYLE}
                        axisLine={false}
                        tickLine={false}
                        label={{
                            value: `${xMeta?.label} (${xMeta?.unit})`,
                            position: 'insideBottom',
                            offset: -4,
                            fontSize: 11,
                            fill: 'hsl(var(--muted-foreground))',
                            fontFamily: 'var(--font-mono, monospace)',
                        }}
                    />
                    <YAxis
                        dataKey="y"
                        type="number"
                        name={yMeta?.label}
                        unit={` ${yMeta?.unit ?? ''}`}
                        tick={AXIS_STYLE}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        label={{
                            value: `${yMeta?.label} (${yMeta?.unit})`,
                            angle: -90,
                            position: 'insideLeft',
                            offset: 8,
                            fontSize: 11,
                            fill: 'hsl(var(--muted-foreground))',
                            fontFamily: 'var(--font-mono, monospace)',
                        }}
                    />
                    <Tooltip
                        content={
                            <ScatterTooltipContent
                                xMeta={xMeta}
                                yMeta={yMeta}
                            />
                        }
                    />
                    {/* Data points */}
                    <Scatter
                        data={points}
                        fill={xMeta?.color ?? '#888'}
                        fillOpacity={0.5}
                        strokeWidth={0}
                        isAnimationActive={false}
                    />
                    {/* Trendline */}
                    {trendPoints.length === 2 && (
                        <Scatter
                            data={trendPoints}
                            fill="transparent"
                            stroke="hsl(var(--foreground))"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            isAnimationActive={false}
                            line={{ stroke: 'hsl(var(--foreground))', strokeWidth: 1.5, strokeDasharray: '4 3' }}
                            shape={() => null as unknown as React.ReactElement}
                        />
                    )}
                </ScatterChart>
            </ResponsiveContainer>

            <p className="text-center text-[11px] text-muted-foreground">
                {points.length} data points · trendline via OLS regression
            </p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CorrelationPanel({ data, metrics }: CorrelationPanelProps) {
    const [view, setView] = useState<ViewMode>('heatmap');

    // Build full correlation matrix (upper + lower triangle)
    const matrix = useMemo<CorrelationEntry[]>(() => {
        const entries: CorrelationEntry[] = [];
        const vectors = new Map<string, number[]>();

        for (const m of metrics) {
            vectors.set(
                m.key,
                data.reduce<number[]>((acc, d) => {
                    const v = d[m.key];
                    if (typeof v === 'number' && !isNaN(v)) acc.push(v);
                    return acc;
                }, [])
            );
        }

        for (const row of metrics) {
            for (const col of metrics) {
                if (row.key === col.key) continue;
                const xs = vectors.get(row.key) ?? [];
                const ys = vectors.get(col.key) ?? [];
                const n  = Math.min(xs.length, ys.length);
                entries.push({
                    rowKey: row.key,
                    colKey: col.key,
                    r: pearson(xs.slice(0, n), ys.slice(0, n)),
                    n,
                });
            }
        }
        return entries;
    }, [data, metrics]);

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Correlation Analysis
                </h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">
                    {data.length} samples · {metrics.length} signals
                </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                {/* Toolbar */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                    {/* View toggle */}
                    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
                        <button
                            onClick={() => setView('heatmap')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                                view === 'heatmap'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Grid3X3 className="h-3.5 w-3.5" />
                            Heatmap
                        </button>
                        <button
                            onClick={() => setView('scatter')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                                view === 'scatter'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <ScatterIcon className="h-3.5 w-3.5" />
                            Scatter
                        </button>
                    </div>

                    {/* Export (heatmap only) */}
                    {view === 'heatmap' && (
                        <button
                            onClick={() => exportCorrelationCSV(matrix, metrics)}
                            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="px-5 pb-6 pt-5">
                    {view === 'heatmap' ? (
                        <HeatmapView matrix={matrix} metrics={metrics} />
                    ) : (
                        <ScatterView data={data} metrics={metrics} matrix={matrix} />
                    )}
                </div>
            </div>
        </section>
    );
}