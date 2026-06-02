'use client';

import { useEffect, useState } from 'react';
import { usePowerLoss } from '@/hooks/use-power-loss';
import { getDatabase, ref, push, set } from 'firebase/database';
import { app } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Zap, Building2, Building, TrendingDown, CloudUpload, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SensorChart } from './sensor-chart';
import { usePowerLossHistory } from '@/hooks/use-power-loss-history';

interface PowerLossViewProps {
    transformerId: string;
    newBuildingId: string;
    oldBuildingId: string;
}

const POWER_LOSS_METRICS = [
    { key: 'total_loss', color: 'hsl(var(--destructive))', label: 'Total Loss' },
    { key: 'p1_loss', color: '#3b82f6', label: 'Phase 1 Loss' },
    { key: 'p2_loss', color: '#10b981', label: 'Phase 2 Loss' },
    { key: 'p3_loss', color: '#f59e0b', label: 'Phase 3 Loss' },
];

function fmt(v: number) { return v.toFixed(2); }

function LossValue({ value, large = false }: { value: number; large?: boolean }) {
    const isLoss = value > 0;
    return (
        <span className={cn(
            'font-mono tabular-nums',
            large ? 'text-3xl font-semibold' : 'text-base font-medium',
            isLoss
                ? 'text-destructive'
                : value < 0
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-emerald-500 dark:text-emerald-400'
        )}>
            {isLoss ? '+' : ''}{fmt(value)}
            <span className="ml-0.5 text-[11px] font-normal opacity-60">W</span>
        </span>
    );
}

interface MeterCardProps {
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    accentColor: string;
    accentBg: string;
    data?: { p1: number; p2: number; p3: number; total: number };
    loading: boolean;
}

function MeterCard({ label, sublabel, icon, accentColor, accentBg, data, loading }: MeterCardProps) {
    const phases = [
        { key: 'PT1', val: data?.p1 ?? 0 },
        { key: 'PT2', val: data?.p2 ?? 0 },
        { key: 'PT3', val: data?.p3 ?? 0 },
    ];

    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
            <div className={cn('h-1 w-full', accentColor)} />
            <div className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', accentBg)}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-sm font-semibold leading-none">{label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="text-[10px] text-muted-foreground">live</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    {phases.map(({ key, val }) => (
                        <div key={key} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                <span className="text-xs text-muted-foreground">{key}</span>
                            </div>
                            {loading
                                ? <Skeleton className="h-3.5 w-16" />
                                : <span className="font-mono text-xs tabular-nums">{fmt(val)} W</span>
                            }
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground">Total power</span>
                    {loading
                        ? <Skeleton className="h-5 w-20" />
                        : <span className="font-mono text-sm font-semibold tabular-nums">{fmt(data?.total ?? 0)} W</span>
                    }
                </div>
            </div>
        </div>
    );
}

function PhaseLossRow({ label, value, loading }: { label: string; value: number; loading: boolean }) {
    const pct = Math.min(100, (Math.abs(value) / 500) * 100);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {loading ? <Skeleton className="h-4 w-14" /> : <LossValue value={value} />}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-700',
                        value > 0 ? 'bg-destructive/70' : value < 0 ? 'bg-amber-400' : 'bg-emerald-400'
                    )}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export function PowerLossView({ transformerId, newBuildingId, oldBuildingId }: PowerLossViewProps) {
    const { latest, loading, error } = usePowerLoss(transformerId, newBuildingId, oldBuildingId);
    const { user } = useAuth();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [autoUpload, setAutoUpload] = useState(true);
    const [lastUploadedTs, setLastUploadedTs] = useState<number>(0);

    const { data: historyData, loading: historyLoading, error: historyError } = usePowerLossHistory(500);

    useEffect(() => {
        if (!user) return;
        fetch('/api/me/role')
            .then(r => r.json())
            .then(d => setUserRole(d.role))
            .catch(() => setUserRole('engineer'));
    }, [user]);

    useEffect(() => {
        const isAdmin = userRole === 'super_admin' || userRole === 'admin';
        if (!autoUpload || !isAdmin || !latest || latest.timestamp <= lastUploadedTs) return;
        const db = getDatabase(app);
        const newRef = push(ref(db, 'power_loss_history'));
        set(newRef, {
            timestamp: latest.timestamp,
            time: latest.time,
            p1_loss: latest.p1_loss,
            p2_loss: latest.p2_loss,
            p3_loss: latest.p3_loss,
            total_loss: latest.total_loss,
        })
            .then(() => setLastUploadedTs(latest.timestamp))
            .catch(console.error);
    }, [latest, autoUpload, userRole, lastUploadedTs]);

    const isAdmin = userRole === 'super_admin' || userRole === 'admin';

    if (error) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <WifiOff className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error.message}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">

            {/* header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Power Loss Monitor</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Real-time transmission loss across the 3-phase network.
                    </p>
                </div>
                {isAdmin && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
                        <CloudUpload className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Auto-upload</span>
                        <Switch
                            checked={autoUpload}
                            onCheckedChange={setAutoUpload}
                            className="scale-75 origin-right"
                        />
                    </label>
                )}
            </div>

            {/* total loss hero card */}
            <div className="relative overflow-hidden rounded-2xl border bg-card p-5">
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                            <TrendingDown className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                                Total loss
                            </p>
                            {loading
                                ? <Skeleton className="mt-1 h-8 w-28" />
                                : <LossValue value={latest?.total_loss ?? 0} large />
                            }
                        </div>
                    </div>

                    <div className="hidden h-12 w-px bg-border sm:block" />

                    <div className="flex flex-1 flex-col gap-3">
                        <PhaseLossRow label="Phase 1 (PT1)" value={latest?.p1_loss ?? 0} loading={loading} />
                        <PhaseLossRow label="Phase 2 (PT2)" value={latest?.p2_loss ?? 0} loading={loading} />
                        <PhaseLossRow label="Phase 3 (PT3)" value={latest?.p3_loss ?? 0} loading={loading} />
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-muted/50 px-2.5 py-1.5 sm:self-auto">
                        {latest
                            ? <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                            : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                        <span className="text-[11px] text-muted-foreground">
                            {latest ? 'Synced' : 'Awaiting sync'}
                        </span>
                    </div>
                </div>
            </div>

            {/* per-device meter cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <MeterCard
                    label="Transformer"
                    sublabel="Power source"
                    icon={<Zap className="h-4 w-4 text-blue-500" />}
                    accentColor="bg-blue-500"
                    accentBg="bg-blue-500/10"
                    data={latest?.transformer}
                    loading={loading}
                />
                <MeterCard
                    label="New Building"
                    sublabel="Load endpoint"
                    icon={<Building2 className="h-4 w-4 text-emerald-500" />}
                    accentColor="bg-emerald-500"
                    accentBg="bg-emerald-500/10"
                    data={latest?.new_building}
                    loading={loading}
                />
                <MeterCard
                    label="Old Building"
                    sublabel="Load endpoint"
                    icon={<Building className="h-4 w-4 text-amber-500" />}
                    accentColor="bg-amber-500"
                    accentBg="bg-amber-500/10"
                    data={latest?.old_building}
                    loading={loading}
                />
            </div>

            <div className="pt-2">
                <SensorChart 
                    title="Historical Power Loss (W)"
                    data={historyData}
                    metrics={POWER_LOSS_METRICS}
                    loading={historyLoading}
                    error={historyError?.message}
                />
            </div>

        </div>
    );
}