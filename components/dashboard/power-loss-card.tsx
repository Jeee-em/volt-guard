'use client';

import { Card } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { usePowerLoss } from '@/hooks/use-power-loss';
import { formatDistanceToNowStrict } from 'date-fns';
import { getThresholdValue, type SignalThreshold } from '@/lib/thresholds';

export interface PowerLossCardProps {
    device1Id: string;
    device2Id: string;
    device3Id: string;
    /** Bucket window in ms. Default: 60_000 (1 min) */
    bucketMs?: number;
    /** Skew threshold in ms above which a warning is shown. Default: 15_000 (15s) */
    skewWarnMs?: number;
    /** Optional override thresholds for power loss status */
    thresholds?: SignalThreshold;
}

const SKEW_WARN_DEFAULT = 15_000;

export function PowerLossCard({
    device1Id,
    device2Id,
    device3Id,
    bucketMs = 120_000,
    skewWarnMs = SKEW_WARN_DEFAULT,
    thresholds,
}: PowerLossCardProps) {
    const { latest, losses, loading, error } = usePowerLoss(device1Id, device2Id, device3Id, { bucketMs });

    // Fall back gracefully: if no matched buckets yet, show zeros rather than hiding
    const p1_loss = latest?.p1_loss ?? 0;
    const p2_loss = latest?.p2_loss ?? 0;
    const p3_loss = latest?.p3_loss ?? 0;
    const totalLoss = latest?.total_loss ?? 0;
    const skewMs = latest?.skewMs ?? 0;
    const highSkew = skewMs > skewWarnMs;

    const warningThreshold = thresholds?.warning ?? getThresholdValue('power_loss', 'warning');
    const criticalThreshold = thresholds?.critical ?? getThresholdValue('power_loss', 'critical');

    const isNegative = totalLoss < 0;
    const isCritical = totalLoss >= criticalThreshold;
    const isWarning = totalLoss >= warningThreshold && !isCritical;

    const colorClass = isNegative
        ? 'text-rose-600 dark:text-rose-400'
        : isCritical
        ? 'text-red-600 dark:text-red-400'
        : isWarning
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';
    const bgClass = isNegative
        ? 'bg-rose-100 dark:bg-rose-900/40'
        : isCritical
        ? 'bg-red-100 dark:bg-red-900/40'
        : isWarning
        ? 'bg-amber-100 dark:bg-amber-900/40'
        : 'bg-emerald-100 dark:bg-emerald-900/40';

    const status = loading
        ? '...'
        : error
        ? 'Error'
        : isNegative
        ? 'Check Wiring'
        : isCritical
        ? 'Critical Loss'
        : isWarning
        ? 'High Loss'
        : losses.length === 0
        ? 'Syncing'
        : 'Normal';

    // Use latest bucket timestamp if available, otherwise show syncing state
    const lastUpdated = latest?.bucketTs
        ? `Updated ${formatDistanceToNowStrict(latest.bucketTs)} ago`
        : loading
        ? 'Loading...'
        : 'Awaiting sync';

    const phases = [
        { label: 'Phase 1', value: p1_loss },
        { label: 'Phase 2', value: p2_loss },
        { label: 'Phase 3', value: p3_loss },
    ];

    return (
        <Card className="flex h-full flex-col gap-0 p-[1.1rem] pb-[0.9rem] shadow-none">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg ${bgClass}`}>
                    <Zap className={`h-5 w-5 ${colorClass}`} strokeWidth={2} />
                </div>
                <div className="flex items-center gap-1.5">
                    {highSkew && (
                        <span
                            className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                            title={`Max skew: ${(skewMs / 1000).toFixed(1)}s`}
                        >
                            ⚠ {(skewMs / 1000).toFixed(0)}s skew
                        </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${bgClass} ${colorClass}`}>
                        {status}
                    </span>
                </div>
            </div>

            {/* Total loss headline — matches TotalPowerCard value size */}
            <div className="mt-2 mb-0.5">
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Total Power Loss
                </p>
                <p className="font-mono text-[32px] font-medium leading-[1.1] text-foreground">
                    {loading ? '—' : totalLoss.toFixed(1)}
                    <span className="ml-0.5 text-[14px] font-normal text-muted-foreground"> W</span>
                </p>
            </div>

            {/* Per-phase breakdown — always rendered, zeros when no data */}
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2">
                {phases.map(({ label, value }) => {
                    const phaseColor = value < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : value > 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400';
                    return (
                        <div key={label} className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {label}
                            </span>
                            <span className={`font-mono text-[13px] font-medium ${phaseColor}`}>
                                {loading ? '—' : `${value.toFixed(1)} W`}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Spacer to push footer down, matching TotalPowerCard height */}
            <div className="flex-1" />

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11px] text-muted-foreground">{lastUpdated}</span>
                <span className="text-[11px] text-muted-foreground">
                    {bucketMs / 1000}s bucket
                </span>
            </div>
        </Card>
    );
}