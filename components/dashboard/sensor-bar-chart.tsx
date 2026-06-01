'use client';

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import {
    BaseChartProps,
    ChartRange,
    ChartShell,
    ChartTooltip,
    ChartLoading,
    ChartError,
    ChartEmpty,
    AXIS_STYLE,
    GRID_PROPS,
    filterByRange,
    downloadCSV,
    PHASE_OPTIONS,
    filterMetricsByPhase,
    type PhaseKey,
} from '@/components/dashboard/sensor-chart-shared';

// ─── Thin down to N evenly-spaced bars so it stays readable ──────────────────
function sampleData(data: any[], maxBars = 60) {
    if (data.length <= maxBars) return data;
    const step = Math.ceil(data.length / maxBars);
    return data.filter((_, i) => i % step === 0);
}

export function SensorBarChart({
    title,
    description = 'Per-interval average readings',
    data,
    metrics,
    loading,
    error,
    height = 320,
    phaseSelection: phaseSelectionProp,
    onPhaseSelectionChange,
}: BaseChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [activeRange, setActiveRange] = useState<ChartRange>('realtime');
    const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
    const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
        new Set(metrics.map((m) => m.key))
    );
    const [localPhaseSelection, setLocalPhaseSelection] = useState<Set<PhaseKey>>(
        () => new Set(PHASE_OPTIONS.map((phase) => phase.key))
    );

    const phaseSelection = phaseSelectionProp ?? localPhaseSelection;
    const updatePhaseSelection = useCallback(
        (next: Set<PhaseKey>) => {
            if (onPhaseSelectionChange) {
                onPhaseSelectionChange(next);
            } else {
                setLocalPhaseSelection(next);
            }
        },
        [onPhaseSelectionChange]
    );

    const phaseMetrics = useMemo(
        () => filterMetricsByPhase(metrics, phaseSelection),
        [metrics, phaseSelection]
    );
    const filtered = sampleData(filterByRange(data, activeRange, customRange));

    const toggleSeries = useCallback((key: string) => {
        setVisibleSeries((prev) => {
            if (prev.size === 1 && prev.has(key)) return prev;
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    useEffect(() => {
        setVisibleSeries((prev) => {
            const allowed = new Set(phaseMetrics.map((metric) => metric.key));
            const next = new Set(prev);
            let changed = false;

            for (const key of next) {
                if (!allowed.has(key)) {
                    next.delete(key);
                    changed = true;
                }
            }

            for (const key of allowed) {
                if (!next.has(key)) {
                    next.add(key);
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [phaseMetrics]);

    const togglePhase = useCallback(
        (phase: PhaseKey) => {
            const next = new Set(phaseSelection);
            if (next.size === 1 && next.has(phase)) return;
            next.has(phase) ? next.delete(phase) : next.add(phase);
            updatePhaseSelection(next);
        },
        [phaseSelection, updatePhaseSelection]
    );

    const handleDownloadImage = useCallback(async () => {
        if (!chartRef.current) return;
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(chartRef.current, { backgroundColor: null });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-bar.png`;
        a.click();
    }, [title]);

    const visibleMetrics = phaseMetrics.filter((m) => visibleSeries.has(m.key));

    return (
        <ChartShell
            title={title}
            description={description}
            dataLength={filtered.length}
            activeRange={activeRange}
            onRangeChange={setActiveRange}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            metrics={phaseMetrics}
            visibleSeries={visibleSeries}
            onToggleSeries={toggleSeries}
            phaseSelection={phaseSelection}
            onTogglePhase={togglePhase}
            onDownloadCSV={() => downloadCSV(filtered, `${title}-bar.csv`)}
            onDownloadImage={handleDownloadImage}
            loading={loading}
            chartRef={chartRef}
        >
            {loading ? (
                <ChartLoading />
            ) : error ? (
                <ChartError message={error} />
            ) : filtered.length === 0 ? (
                <ChartEmpty />
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart
                        data={filtered}
                        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                        barCategoryGap="30%"
                        barGap={2}
                    >
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis
                            dataKey="time"
                            tick={AXIS_STYLE}
                            axisLine={false}
                            tickLine={false}
                            dy={6}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={AXIS_STYLE}
                            axisLine={false}
                            tickLine={false}
                            width={42}
                        />
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        />
                        {visibleMetrics.map(({ key, color, label }) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                name={label}
                                fill={color}
                                fillOpacity={0.85}
                                radius={[3, 3, 0, 0]}
                                isAnimationActive={false}
                                maxBarSize={24}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartShell>
    );
}
