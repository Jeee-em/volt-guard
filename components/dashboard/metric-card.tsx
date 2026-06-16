'use client';

import { Card } from '@/components/ui/card';
import { Zap, Activity, Sigma } from 'lucide-react';
import { useAnalytics } from '@/hooks/use-analytics';
import { useWattage } from '@/hooks/use-wattage';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ─── RangeBar ─────────────────────────────────────────────────────────────────

interface RangeBarProps {
    percent: number;
    colorClass: string;
    bgClass: string;
    min: string;
    max: string;
}

function RangeBar({ percent, colorClass, bgClass, min, max }: RangeBarProps) {
    const clamped = Math.min(100, Math.max(0, percent));
    return (
        <>
            <div className="mt-2.5 flex justify-between">
                <span className="text-[10px] text-muted-foreground">{min}</span>
                <span className="text-[10px] text-muted-foreground">{clamped.toFixed(0)}% of {max}</span>
                <span className="text-[10px] text-muted-foreground">{max}</span>
            </div>
            <div className="mt-1 mb-2.5 h-[5px] w-full overflow-hidden rounded-full bg-border">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${bgClass}`}
                    style={{ width: `${clamped}%` }}
                />
            </div>
        </>
    );
}

// ─── Phase Card (voltage + current only) ─────────────────────────────────────

type PhaseKey = 'p1' | 'p2' | 'p3';

interface PhaseCardProps {
    phase: PhaseKey;
    maxVoltage?: number;
    maxCurrent?: number;
    deviceId?: string;
    className?: string;
}

const PHASE_LABELS: Record<PhaseKey, string> = {
    p1: 'Phase 1',
    p2: 'Phase 2',
    p3: 'Phase 3',
};

export function PhaseCard({ phase, maxVoltage = 240, maxCurrent = 16, deviceId, className }: PhaseCardProps) {
    const { data, loading } = useAnalytics(deviceId, 20);

    const latest = data?.latestSingle;
    const prev = data?.latest?.[data.latest.length - 2];

    const voltage = (latest as any)?.[`${phase}_voltage`] ?? 0;
    const current = (latest as any)?.[`${phase}_current`] ?? 0;
    const prevVoltage = (prev as any)?.[`${phase}_voltage`] ?? 0;

    const deltaV = voltage - prevVoltage;
    const deltaStr = deltaV === 0 ? undefined : `${deltaV > 0 ? '↑' : '↓'} ${Math.abs(deltaV).toFixed(1)} V`;

    const rangePercent = (voltage / maxVoltage) * 100;
    const lastUpdated = latest?.timestamp
        ? `Updated ${formatDistanceToNowStrict(latest.timestamp)} ago`
        : 'No data';

    const isHighCurrent = current > maxCurrent * 0.8;
    const status = voltage === 0 ? 'No Signal' : isHighCurrent ? 'High Current' : 'Stable';

    const colorClass = isHighCurrent
        ? 'text-rose-600 dark:text-rose-400'
        : voltage === 0 ? 'text-muted-foreground' : 'text-sky-600 dark:text-sky-400';
    const bgClass = isHighCurrent
        ? 'bg-rose-100 dark:bg-rose-900/40'
        : voltage === 0 ? 'bg-muted' : 'bg-sky-100 dark:bg-sky-900/40';

    return (
        <Card className={`flex flex-col gap-0 p-[1.1rem] pb-[0.9rem] shadow-none ${className ?? ''}`}>
            <div className="flex items-start justify-between">
                <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${bgClass}`}>
                    <Activity className={`h-4 w-4 ${colorClass}`} strokeWidth={2} />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${bgClass} ${colorClass}`}>
                    {loading ? '...' : status}
                </span>
            </div>

            <div className="mt-2 mb-0.5">
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {PHASE_LABELS[phase]}
                </p>
                <p className="font-mono text-[26px] font-medium leading-[1.1] text-foreground">
                    {loading ? '—' : voltage.toFixed(1)}
                    <span className="ml-0.5 text-[13px] font-normal text-muted-foreground"> V</span>
                </p>
            </div>

            {!loading && latest && (
                <div className="mt-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</span>
                    <p className="font-mono text-[13px] font-medium text-foreground">{current.toFixed(2)} A</p>
                </div>
            )}

            <RangeBar percent={rangePercent} colorClass={colorClass} bgClass={bgClass} min="0 V" max={`${maxVoltage} V`} />

            <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11px] text-muted-foreground">{lastUpdated}</span>
                {deltaStr && <span className={`text-[11px] font-medium ${colorClass}`}>{deltaStr}</span>}
            </div>
        </Card>
    );
}

// ─── Wab / Wbc Card ───────────────────────────────────────────────────────────

interface WattageCardProps {
    deviceId?: string;
}

export function WattageCard({ deviceId }: WattageCardProps) {
    const { data, loading } = useWattage(deviceId);

    const lastUpdated = data?.timestamp
        ? `Updated ${formatDistanceToNowStrict(data.timestamp)} ago`
        : 'No data';

    return (
        <Card className="flex flex-col gap-0 p-[1.1rem] pb-[0.9rem] shadow-none">
            <div className="flex items-start justify-between">
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                    <Sigma className="h-4 w-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
                </div>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                    Line Power
                </span>
            </div>

            <div className="mt-2 mb-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Wattage</p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border rounded-xl border border-border overflow-hidden">
                {/* Wab */}
                <div className="flex flex-col gap-1 px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">W<sub>ab</sub></span>
                    {loading
                        ? <Skeleton className="h-7 w-20 mt-1" />
                        : (
                            <span className="font-mono text-[22px] font-semibold leading-tight text-foreground">
                                {(data?.wab ?? 0).toFixed(2)}
                                <span className="ml-0.5 text-[12px] font-normal text-muted-foreground"> W</span>
                            </span>
                        )
                    }
                    <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground">
                        <span>{(data?.v1 ?? 0).toFixed(1)} V</span>
                        <span>·</span>
                        <span>{(data?.i1 ?? 0).toFixed(2)} A</span>
                    </div>
                </div>

                {/* Wbc */}
                <div className="flex flex-col gap-1 px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">W<sub>bc</sub></span>
                    {loading
                        ? <Skeleton className="h-7 w-20 mt-1" />
                        : (
                            <span className="font-mono text-[22px] font-semibold leading-tight text-foreground">
                                {(data?.wbc ?? 0).toFixed(2)}
                                <span className="ml-0.5 text-[12px] font-normal text-muted-foreground"> W</span>
                            </span>
                        )
                    }
                    <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground">
                        <span>{(data?.v2 ?? 0).toFixed(1)} V</span>
                        <span>·</span>
                        <span>{(data?.i2 ?? 0).toFixed(2)} A</span>
                    </div>
                </div>
            </div>

            <div className="mt-3 border-t border-border pt-2">
                <span className="text-[11px] text-muted-foreground">{lastUpdated}</span>
            </div>
        </Card>
    );
}

// ─── Device Total Power Card (PO / PN / PT) ───────────────────────────────────
// total = Wab + Wbc, label inferred from deviceId

interface DeviceTotalPowerCardProps {
    deviceId?: string;
    maxWatts?: number;
}

const LABEL_ACCENT: Record<string, { color: string; bg: string; text: string }> = {
    PT: { color: 'bg-indigo-500',  bg: 'bg-indigo-100 dark:bg-indigo-900/40',  text: 'text-indigo-600 dark:text-indigo-400' },
    PN: { color: 'bg-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
    PO: { color: 'bg-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/40',    text: 'text-amber-600 dark:text-amber-400' },
};

export function DeviceTotalPowerCard({ deviceId, maxWatts = 5000 }: DeviceTotalPowerCardProps) {
    const { data, loading } = useWattage(deviceId);

    const label = data?.label ?? 'PO';
    const fullName = data?.fullName ?? 'Old Building';
    const total = data?.total ?? 0;
    const accent = LABEL_ACCENT[label];
    const rangePercent = (total / maxWatts) * 100;

    const lastUpdated = data?.timestamp
        ? `Updated ${formatDistanceToNowStrict(data.timestamp)} ago`
        : 'No data';

    return (
        <Card className="flex flex-col gap-0 overflow-hidden p-0 shadow-none">
            {/* Accent stripe */}
            <div className={cn('h-1 w-full', accent.color)} />

            <div className="flex flex-col gap-0 p-[1.1rem] pb-[0.9rem]">
                <div className="flex items-start justify-between">
                    <div className={cn('flex h-[34px] w-[34px] items-center justify-center rounded-lg', accent.bg)}>
                        <Zap className={cn('h-5 w-5', accent.text)} strokeWidth={2} />
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide', accent.bg, accent.text)}>
                        {label}
                    </span>
                </div>

                <div className="mt-2 mb-0.5">
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                        {label} — {fullName}
                    </p>
                    {loading
                        ? <Skeleton className="mt-1 h-9 w-32" />
                        : (
                            <p className="font-mono text-[32px] font-semibold leading-[1.1] text-foreground">
                                {total.toFixed(2)}
                                <span className="ml-0.5 text-[14px] font-normal text-muted-foreground"> W</span>
                            </p>
                        )
                    }
                </div>

                {/* Wab + Wbc breakdown */}
                {!loading && data && (
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">W<sub>ab</sub></span>
                            <span className="font-mono text-[13px] font-medium text-foreground">{data.wab.toFixed(2)} W</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">W<sub>bc</sub></span>
                            <span className="font-mono text-[13px] font-medium text-foreground">{data.wbc.toFixed(2)} W</span>
                        </div>
                    </div>
                )}

                <RangeBar
                    percent={rangePercent}
                    colorClass={accent.text}
                    bgClass={accent.bg}
                    min="0 W"
                    max={`${maxWatts} W`}
                />

                <div className="border-t border-border pt-2">
                    <span className="text-[11px] text-muted-foreground">{lastUpdated}</span>
                </div>
            </div>
        </Card>
    );
}

// ─── PowerMetricsGrid ─────────────────────────────────────────────────────────

interface PowerMetricsGridProps {
    deviceId?: string;
    maxWatts?: number;
    maxVoltage?: number;
    maxCurrent?: number;
}

export function PowerMetricsGrid({
    deviceId,
    maxWatts = 5000,
    maxVoltage = 240,
    maxCurrent = 16,
}: PowerMetricsGridProps) {
    return (
        <div className="flex flex-col gap-4">
            {/* Phase cards row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <PhaseCard phase="p1" deviceId={deviceId} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
                <PhaseCard phase="p2" deviceId={deviceId} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
                <PhaseCard phase="p3" deviceId={deviceId} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-1">
                <WattageCard deviceId={deviceId} />
                <DeviceTotalPowerCard deviceId={deviceId} maxWatts={maxWatts} />
            </div>
        </div>
    );
}