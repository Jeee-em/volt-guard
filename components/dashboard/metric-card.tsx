'use client';

import { Card } from '@/components/ui/card';
import { Zap, Activity } from 'lucide-react';
import { useAnalytics } from '@/hooks/use-analytics';
import { formatDistanceToNowStrict } from 'date-fns';

// ─── Shared types ─────────────────────────────────────────────────────────────

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

// ─── Hero: Total Power Card ───────────────────────────────────────────────────

interface TotalPowerCardProps {
    /** Max expected total power in Watts for the range bar, e.g. 3000 */
    maxWatts?: number;
    deviceId?: string;
}

export function TotalPowerCard({ maxWatts = 3000, deviceId }: TotalPowerCardProps) {
    const { data, loading } = useAnalytics(deviceId, 20);

    const latest = data?.latestSingle;
    const prev = data?.latest?.[data.latest.length - 2];

    const totalPower = latest?.total_power ?? 0;
    const prevPower = prev?.total_power ?? 0;
    const delta = totalPower - prevPower;
    const deltaStr = delta === 0 ? undefined : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} W`;

    const rangePercent = (totalPower / maxWatts) * 100;
    const lastUpdated = latest?.timestamp
        ? `Updated ${formatDistanceToNowStrict(latest.timestamp)} ago`
        : 'No data';

    // Status logic
    const status = totalPower === 0 ? 'Idle' : totalPower > maxWatts * 0.85 ? 'High Load' : 'Normal';
    const colorClass = totalPower > maxWatts * 0.85
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';
    const bgClass = totalPower > maxWatts * 0.85
        ? 'bg-amber-100 dark:bg-amber-900/40'
        : 'bg-emerald-100 dark:bg-emerald-900/40';

    return (
        <Card className="flex flex-col gap-0 p-[1.1rem] pb-[0.9rem] shadow-none col-span-3">
            <div className="flex items-start justify-between">
                <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg ${bgClass}`}>
                    <Zap className={`h-5 w-5 ${colorClass}`} strokeWidth={2} />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${bgClass} ${colorClass}`}>
                    {loading ? '...' : status}
                </span>
            </div>

            <div className="mt-2 mb-0.5">
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Total Power
                </p>
                <p className="font-mono text-[32px] font-medium leading-[1.1] text-foreground">
                    {loading ? '—' : totalPower.toFixed(1)}
                    <span className="ml-0.5 text-[14px] font-normal text-muted-foreground"> W</span>
                </p>
            </div>

            {/* Phase summary row */}
            {!loading && latest && (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    {(['p1', 'p2', 'p3'] as const).map((p, i) => (
                        <div key={p} className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Phase {i + 1}
                            </span>
                            <span className="font-mono text-[13px] font-medium text-foreground">
                                {((latest as any)[`${p}_power`] ?? 0).toFixed(1)} W
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {((latest as any)[`${p}_voltage`] ?? 0).toFixed(1)} V
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <RangeBar
                percent={rangePercent}
                colorClass={colorClass}
                bgClass={bgClass}
                min="0 W"
                max={`${maxWatts} W`}
            />

            <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11px] text-muted-foreground">{lastUpdated}</span>
                {deltaStr && (
                    <span className={`text-[11px] font-medium ${colorClass}`}>{deltaStr}</span>
                )}
            </div>
        </Card>
    );
}

// ─── Phase Card ───────────────────────────────────────────────────────────────

type PhaseKey = 'p1' | 'p2' | 'p3';

interface PhaseCardProps {
    phase: PhaseKey;
    /** Max expected voltage for range bar, e.g. 240 */
    maxVoltage?: number;
    /** Max expected current for range bar, e.g. 16 */
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
    const power = (latest as any)?.[`${phase}_power`] ?? 0;

    const prevVoltage = (prev as any)?.[`${phase}_voltage`] ?? 0;
    const deltaV = voltage - prevVoltage;
    const deltaStr = deltaV === 0 ? undefined : `${deltaV > 0 ? '↑' : '↓'} ${Math.abs(deltaV).toFixed(1)} V`;

    const rangePercent = (voltage / maxVoltage) * 100;
    const lastUpdated = latest?.timestamp
        ? `Updated ${formatDistanceToNowStrict(latest.timestamp)} ago`
        : 'No data';

    // Status: flag if voltage is significantly out of nominal range (±10%)
    const nominalVoltage = maxVoltage * 0.5; // midpoint as nominal reference
    const voltageDeviation = Math.abs(voltage - nominalVoltage) / nominalVoltage;
    const isHighCurrent = current > maxCurrent * 0.8;
    const status = voltage === 0 ? 'No Signal' : isHighCurrent ? 'High Current' : 'Stable';

    const colorClass = isHighCurrent
        ? 'text-rose-600 dark:text-rose-400'
        : voltage === 0
            ? 'text-muted-foreground'
            : 'text-sky-600 dark:text-sky-400';
    const bgClass = isHighCurrent
        ? 'bg-rose-100 dark:bg-rose-900/40'
        : voltage === 0
            ? 'bg-muted'
            : 'bg-sky-100 dark:bg-sky-900/40';

    return (
        <Card className={`flex flex-col gap-0 p-[1.1rem] pb-[0.9rem] shadow-none ${className ?? ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${bgClass}`}>
                    <Activity className={`h-4 w-4 ${colorClass}`} strokeWidth={2} />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${bgClass} ${colorClass}`}>
                    {loading ? '...' : status}
                </span>
            </div>

            {/* Label + Voltage */}
            <div className="mt-2 mb-0.5">
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {PHASE_LABELS[phase]}
                </p>
                <p className="font-mono text-[26px] font-medium leading-[1.1] text-foreground">
                    {loading ? '—' : voltage.toFixed(1)}
                    <span className="ml-0.5 text-[13px] font-normal text-muted-foreground"> V</span>
                </p>
            </div>

            {/* Current + Power secondary stats */}
            {!loading && latest && (
                <div className="mt-1.5 flex gap-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</span>
                        <span className="font-mono text-[13px] font-medium text-foreground">
                            {current.toFixed(2)} A
                        </span>
                    </div>
                    <div className="h-full w-px bg-border" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Power</span>
                        <span className="font-mono text-[13px] font-medium text-foreground">
                            {power.toFixed(1)} W
                        </span>
                    </div>
                </div>
            )}

            <RangeBar
                percent={rangePercent}
                colorClass={colorClass}
                bgClass={bgClass}
                min="0 V"
                max={`${maxVoltage} V`}
            />

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11px] text-muted-foreground">{lastUpdated}</span>
                {deltaStr && (
                    <span className={`text-[11px] font-medium ${colorClass}`}>{deltaStr}</span>
                )}
            </div>
        </Card>
    );
}

// ─── Convenience: full grid layout ───────────────────────────────────────────

interface PowerMetricsGridProps {
    deviceId?: string;
    maxWatts?: number;
    maxVoltage?: number;
    maxCurrent?: number;
}

/**
 * Drop-in grid:
 *   Row 1: TotalPowerCard (50%) | PowerLossCard (50%)
 *   Row 2: PhaseCard P1 | P2 | P3  (each ~33%)
 *
 * Usage:
 *   <PowerMetricsGrid
 *     deviceId="power_monitor_01"
 *     device1Id="power_monitor_01"
 *     device2Id="power_monitor_02"
 *     device3Id="power_monitor_03"
 *   />
 */
export function PowerMetricsGrid({
    deviceId,
    maxWatts = 3000,
    maxVoltage = 240,
    maxCurrent = 16
}: PowerMetricsGridProps) {

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
                <PhaseCard phase="p1" deviceId={deviceId} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
            </div>
            <div className="md:col-span-2">
                <PhaseCard phase="p2" deviceId={deviceId} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
            </div>
            <div className="md:col-span-2">
                <PhaseCard phase="p3" deviceId={deviceId} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
            </div>
        </div>
    );
}