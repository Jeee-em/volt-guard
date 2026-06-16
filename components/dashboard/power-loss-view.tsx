'use client';

import { useEffect, useState } from 'react';
import { usePowerLoss, type Remarks } from '@/hooks/use-power-loss';
import { getDatabase, ref, push, set } from 'firebase/database';
import { app } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
    Zap, Building2, Building, CloudUpload, WifiOff,
    CheckCircle2, AlertTriangle, ShieldAlert, Activity,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SensorBarChart } from './sensor-bar-chart';
import { usePowerLossHistory } from '@/hooks/use-power-loss-history';

interface PowerLossViewProps {
    transformerId: string;
    newBuildingId: string;
    oldBuildingId: string;
}

const PT_METRICS = [
    { key: 'pt_total', color: '#6366f1', label: 'PT (Total)' },
];

function fmt(v: number) { return v.toFixed(2); }

// ─── Remarks config ───────────────────────────────────────────────────────────

const REMARKS_CONFIG: Record<Remarks, {
    label: string;
    description: string;
    icon: React.ElementType;
    bg: string;
    text: string;
    border: string;
    stripe: string;
    dot: string;
}> = {
    normal: {
        label: 'Normal',
        description: 'Distribution balanced',
        icon: CheckCircle2,
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/30',
        stripe: 'bg-emerald-500',
        dot: 'bg-emerald-500',
    },
    unstable: {
        label: 'Unstable',
        description: 'Minor deviation detected',
        icon: AlertTriangle,
        bg: 'bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30',
        stripe: 'bg-amber-500',
        dot: 'bg-amber-500',
    },
    pilferage: {
        label: 'Pilferage',
        description: 'Significant loss detected',
        icon: ShieldAlert,
        bg: 'bg-destructive/10',
        text: 'text-destructive',
        border: 'border-destructive/30',
        stripe: 'bg-destructive',
        dot: 'bg-destructive',
    },
};

// ─── Remarks badge ────────────────────────────────────────────────────────────

function RemarksBadge({ remarks, loading }: { remarks: Remarks; loading: boolean }) {
    if (loading) return <Skeleton className="h-7 w-24 rounded-full" />;
    const cfg = REMARKS_CONFIG[remarks];
    const Icon = cfg.icon;
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
            cfg.bg, cfg.text, cfg.border
        )}>
            <span className="relative flex h-2 w-2">
                {remarks !== 'normal' && (
                    <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', cfg.dot)} />
                )}
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', cfg.dot)} />
            </span>
            <Icon className="h-3.5 w-3.5" />
            {cfg.label}
        </span>
    );
}

// ─── Power Distribution hero card ─────────────────────────────────────────────

function PowerDistributionCard({
    loading,
    pt,
    pn,
    po,
    deviation,
    remarks,
}: {
    loading: boolean;
    pt: number;
    pn: number;
    po: number;
    deviation: number;
    remarks: Remarks;
}) {
    const cfg = REMARKS_CONFIG[remarks];
    const Icon = cfg.icon;

    return (
        <div className={cn('overflow-hidden rounded-2xl border bg-card', cfg.border)}>
            {/* Color stripe */}
            <div className={cn('h-1.5 w-full', cfg.stripe)} />

            <div className="p-6">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            cfg.bg
                        )}
                    >
                        <Icon className={cn('h-5 w-5', cfg.text)} />
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Power Distribution
                        </p>

                        {loading ? (
                            <Skeleton className="mt-1 h-5 w-32" />
                        ) : (
                            <p className="text-base font-semibold text-foreground">
                                {cfg.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Main KPI - MOST IMPORTANT */}
                <div
                    className={cn(
                        'mt-6 rounded-2xl border p-6 text-center',
                        cfg.border,
                        cfg.bg
                    )}
                >
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                        Power Deviation
                    </p>

                    {loading ? (
                        <Skeleton className="mx-auto mt-4 h-14 w-40" />
                    ) : (
                        <>
                            <div
                                className={cn(
                                    'mt-2 text-6xl font-black tracking-tight tabular-nums',
                                    cfg.text
                                )}
                            >
                                {fmt(deviation)}
                            </div>

                            <p className="text-lg font-medium text-muted-foreground">
                                Watts Difference
                            </p>

                            <div
                                className={cn(
                                    'mx-auto mt-4 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold',
                                    cfg.bg,
                                    cfg.text
                                )}
                            >
                                {remarks}
                            </div>
                        </>
                    )}
                </div>

                {/* Equation row: PT = PN + PO */}
                <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-muted/40 px-4 py-4">
                    {loading ? (
                        <Skeleton className="h-8 w-full" />
                    ) : (
                        <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
                            {/* PT */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">PT</span>
                                <span className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                    {fmt(pt)} W
                                </span>
                            </div>

                            <span className="mb-0 mt-5 text-xl font-light text-muted-foreground">=</span>

                            {/* PN */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">PN</span>
                                <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    {fmt(pn)} W
                                </span>
                            </div>

                            <span className="mb-0 mt-5 text-xl font-light text-muted-foreground">+</span>

                            {/* PO */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">PO</span>
                                <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                    {fmt(po)} W
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Threshold legend */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                    {[
                        { dot: 'bg-emerald-500', label: 'Normal', range: '0 W' },
                        { dot: 'bg-amber-500', label: 'Unstable', range: '1 – 10 W' },
                        { dot: 'bg-destructive', label: 'Pilferage', range: '> 10 W' },
                    ].map(({ dot, label, range }) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                            <span className="text-[11px] text-muted-foreground">
                                <span className="font-medium text-foreground">{label}</span> — {range}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Individual device card (PT / PN / PO) ────────────────────────────────────

interface DeviceCardProps {
    label: string;
    name: string;
    sublabel: string;
    icon: React.ReactNode;
    accentColor: string;
    accentBg: string;
    accentText: string;
    total: number;
    loading: boolean;
}

function DeviceCard({
    label, name, sublabel, icon, accentColor, accentBg, accentText, total, loading,
}: DeviceCardProps) {
    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
            <div className={cn('h-1 w-full', accentColor)} />
            <div className="flex flex-col gap-4 p-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', accentBg)}>
                            {icon}
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-none">{name}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
                        </div>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide', accentBg, accentText)}>
                        {label}
                    </span>
                </div>

                {/* Big total */}
                <div className={cn('flex flex-col items-center justify-center rounded-xl py-5', accentBg)}>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                        Total Power
                    </span>
                    {loading
                        ? <Skeleton className="h-10 w-28" />
                        : (
                            <span className={cn('font-mono text-3xl font-bold tabular-nums', accentText)}>
                                {fmt(total)}
                                <span className="ml-1 text-sm font-normal text-muted-foreground">W</span>
                            </span>
                        )
                    }
                </div>

                {/* Live indicator */}
                <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Live reading</span>
                    <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', accentColor, !loading && 'animate-pulse')} />
                </div>
            </div>
        </div>
    );
}

// ─── Main view ────────────────────────────────────────────────────────────────

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
        if (!autoUpload || !isAdmin || !latest) return;
        if (latest.timestamp - lastUploadedTs < 30000) return;

        const db = getDatabase(app);

        // NEW: upload PT, PN, PO totals + deviation to pt_history
        const newRef = push(ref(db, 'pt_history'));
        set(newRef, {
            timestamp: latest.timestamp,
            time: latest.time,
            pt_total: latest.pt,
            pn_total: latest.pn,
            po_total: latest.po,
            deviation: latest.deviation,
            remarks: latest.remarks,
        })
            .then(() => setLastUploadedTs(latest.timestamp))
            .catch(console.error);

        // OLD: upload power loss to power_loss_history
        // const oldRef = push(ref(db, 'power_loss_history'));
        // set(oldRef, { timestamp, time, p1_loss, p2_loss, p3_loss, total_loss })
        //     .then(() => setLastUploadedTs(latest.timestamp))
        //     .catch(console.error);

    }, [latest, autoUpload, userRole, lastUploadedTs]);

    const isAdmin = userRole === 'super_admin' || userRole === 'admin';
    const remarks = latest?.remarks ?? 'normal';

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

            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold tracking-tight">Power Distribution Monitor</h2>
                        {/* <RemarksBadge remarks={remarks} loading={loading} /> */}
                    </div>
                </div>
                {/* {isAdmin && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
                        <CloudUpload className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Auto-upload</span>
                        <Switch
                            checked={autoUpload}
                            onCheckedChange={setAutoUpload}
                            className="scale-75 origin-right"
                        />
                    </label>
                )} */}
            </div>

            {/* Power Distribution card */}
            <PowerDistributionCard
                loading={loading}
                pt={latest?.pt ?? 0}
                pn={latest?.pn ?? 0}
                po={latest?.po ?? 0}
                deviation={latest?.deviation ?? 0}
                remarks={remarks}
            />

            {/* PT / PN / PO device cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <DeviceCard
                    label="PT"
                    name="Transformer"
                    sublabel="Power source"
                    icon={<Zap className="h-4 w-4 text-indigo-500" />}
                    accentColor="bg-indigo-500"
                    accentBg="bg-indigo-500/10"
                    accentText="text-indigo-600 dark:text-indigo-400"
                    total={latest?.pt ?? 0}
                    loading={loading}
                />
                <DeviceCard
                    label="PN"
                    name="New Building"
                    sublabel="Load endpoint"
                    icon={<Building2 className="h-4 w-4 text-emerald-500" />}
                    accentColor="bg-emerald-500"
                    accentBg="bg-emerald-500/10"
                    accentText="text-emerald-600 dark:text-emerald-400"
                    total={latest?.pn ?? 0}
                    loading={loading}
                />
                <DeviceCard
                    label="PO"
                    name="Old Building"
                    sublabel="Load endpoint"
                    icon={<Building className="h-4 w-4 text-amber-500" />}
                    accentColor="bg-amber-500"
                    accentBg="bg-amber-500/10"
                    accentText="text-amber-600 dark:text-amber-400"
                    total={latest?.po ?? 0}
                    loading={loading}
                />
            </div>

            {/* Bar chart — PT history */}
            {/* <div className="pt-2">
                <SensorBarChart
                    title="PT History (W)"
                    description="Computed PT = PN + PO over time"
                    data={historyData}
                    metrics={PT_METRICS}
                    loading={historyLoading}
                    error={historyError?.message}
                />
            </div> */}

        </div>
    );
}