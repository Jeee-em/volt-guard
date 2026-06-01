'use client';

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import {
    AreaChart,
    Area,
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

export function SensorAreaChart({
    title,
    description = 'Cumulative load distribution over time',
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
    const filtered = filterByRange(data, activeRange, customRange);

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
        a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-area.png`;
        a.click();
    }, [title]);

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
            onDownloadCSV={() => downloadCSV(filtered, `${title}-area.csv`)}
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
                    <AreaChart data={filtered} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                            {phaseMetrics.map(({ key, color }) => (
                                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis
                            dataKey="time"
                            tick={AXIS_STYLE}
                            axisLine={false}
                            tickLine={false}
                            dy={6}
                        />
                        <YAxis
                            tick={AXIS_STYLE}
                            axisLine={false}
                            tickLine={false}
                            width={42}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        {phaseMetrics.map(({ key, color, label }) =>
                            visibleSeries.has(key) ? (
                                <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    name={label}
                                    stroke={color}
                                    strokeWidth={1.5}
                                    fill={`url(#grad-${key})`}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            ) : null
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </ChartShell>
    );
}