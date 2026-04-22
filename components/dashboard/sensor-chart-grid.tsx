'use client';

import { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type GridLayout = '1col' | '2col' | '1+2' | '2+1';

interface SensorChartGridProps {
    /**
     * Layout preset:
     *   '1col'  — single column, all charts stacked full-width
     *   '2col'  — two equal columns
     *   '1+2'   — first chart full-width, rest in 2 columns
     *   '2+1'   — first two charts in 2 columns, last chart full-width
     */
    layout?: GridLayout;
    children: ReactNode;
    /** Optional section title above the grid */
    title?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SensorChartGrid({
    layout = '1col',
    children,
    title,
}: SensorChartGridProps) {
    const charts = Array.isArray(children) ? children : [children];

    return (
        <section className="space-y-3">
            {title && (
                <div className="flex items-center gap-3">
                    <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        {title}
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                </div>
            )}

            {layout === '1col' && (
                <div className="flex flex-col gap-4">
                    {charts.map((chart, i) => (
                        <div key={i}>{chart}</div>
                    ))}
                </div>
            )}

            {layout === '2col' && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {charts.map((chart, i) => (
                        <div key={i}>{chart}</div>
                    ))}
                </div>
            )}

            {layout === '1+2' && (
                <div className="flex flex-col gap-4">
                    {/* First chart: full width */}
                    {charts[0] && <div>{charts[0]}</div>}
                    {/* Rest: 2-column grid */}
                    {charts.length > 1 && (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {charts.slice(1).map((chart, i) => (
                                <div key={i}>{chart}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {layout === '2+1' && (
                <div className="flex flex-col gap-4">
                    {/* First two: 2-column grid */}
                    {charts.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {charts.slice(0, 2).map((chart, i) => (
                                <div key={i}>{chart}</div>
                            ))}
                        </div>
                    )}
                    {/* Last: full width */}
                    {charts[2] && <div>{charts[2]}</div>}
                </div>
            )}
        </section>
    );
}