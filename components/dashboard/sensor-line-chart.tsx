'use client';

import { useRef, useState, useCallback } from 'react';
import {
    LineChart,
    Line,
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
} from '@/components/dashboard/sensor-chart-shared';

export function SensorLineChart({
    title,
    description = 'Continuous signal over time',
    data,
    metrics,
    loading,
    error,
    height = 320,
}: BaseChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [activeRange, setActiveRange] = useState<ChartRange>('all');
    const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
        new Set(metrics.map((m) => m.key))
    );

    const filtered = filterByRange(data, activeRange);

    const toggleSeries = useCallback((key: string) => {
        setVisibleSeries((prev) => {
            if (prev.size === 1 && prev.has(key)) return prev;
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    const handleDownloadImage = useCallback(async () => {
        if (!chartRef.current) return;
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(chartRef.current, { backgroundColor: null });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-line.png`;
        a.click();
    }, [title]);

    return (
        <ChartShell
            title={title}
            description={description}
            dataLength={filtered.length}
            activeRange={activeRange}
            onRangeChange={setActiveRange}
            metrics={metrics}
            visibleSeries={visibleSeries}
            onToggleSeries={toggleSeries}
            onDownloadCSV={() => downloadCSV(filtered, `${title}-line.csv`)}
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
                    <LineChart data={filtered} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
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
                        {metrics.map(({ key, color, label }) =>
                            visibleSeries.has(key) ? (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    name={label}
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
        </ChartShell>
    );
}