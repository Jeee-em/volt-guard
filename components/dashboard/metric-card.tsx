import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    unit: string;
    icon: LucideIcon;
    colorClass: string;
    bgClass: string;
    /** e.g. "Normal" | "High" | "Stable" | "Good" */
    status: string;
    /** current numeric value for the range bar (0–100, as a percentage) */
    rangePercent: number;
    /** label shown on left end of range bar, e.g. "0 kW" */
    rangeMin: string;
    /** label shown on right end of range bar, e.g. "10 kW" */
    rangeMax: string;
    /** small delta string shown bottom-right, e.g. "↑ 0.3 kW" */
    delta?: string;
    /** ISO string or human-readable, e.g. "Updated 12s ago" */
    lastUpdated: string;
}

export function MetricCard({
    title,
    value,
    unit,
    icon: Icon,
    colorClass,
    bgClass,
    status,
    rangePercent,
    rangeMin,
    rangeMax,
    delta,
    lastUpdated,
}: MetricCardProps) {
    const clampedPercent = Math.min(100, Math.max(0, rangePercent));

    return (
        <Card className="flex flex-col gap-0 p-[1.1rem] pb-[0.9rem] shadow-none">
            {/* Header row: icon + status badge */}
            <div className="flex items-start justify-between">
                <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${bgClass}`}>
                    <Icon className={`h-4 w-4 ${colorClass}`} strokeWidth={2} />
                </div>
                <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${bgClass} ${colorClass}`}
                >
                    {status}
                </span>
            </div>

            {/* Label + Value */}
            <div className="mt-2 mb-0.5">
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {title}
                </p>
                <p className="font-mono text-[26px] font-medium leading-[1.1] text-foreground">
                    {value}
                    <span className="ml-0.5 text-[13px] font-normal text-muted-foreground">
                        {unit}
                    </span>
                </p>
            </div>

            {/* Range labels */}
            <div className="mt-2.5 flex justify-between">
                <span className="text-[10px] text-muted-foreground">{rangeMin}</span>
                <span className="text-[10px] text-muted-foreground">
                    {clampedPercent}% of {rangeMax}
                </span>
                <span className="text-[10px] text-muted-foreground">{rangeMax}</span>
            </div>

            {/* Range bar */}
            <div className="mt-1 mb-2.5 h-[5px] w-full overflow-hidden rounded-full bg-border">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${bgClass}`}
                    style={{ width: `${clampedPercent}%` }}
                />
            </div>

            {/* Footer: last updated + delta */}
            <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11px] text-muted-foreground">{lastUpdated}</span>
                {delta && (
                    <span className={`text-[11px] font-medium ${colorClass}`}>{delta}</span>
                )}
            </div>
        </Card>
    );
}