'use client';

import { useEffect, useRef, useState } from 'react';
import { usePowerLoss, type Remarks } from '@/hooks/use-power-loss';
import { useThresholds } from '@/hooks/use-thresholds';
import { getDatabase, ref, push, set } from 'firebase/database';
import { app } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
    Zap, Building2, Building, CloudUpload, WifiOff,
    CheckCircle2, AlertTriangle, ShieldAlert, Activity, AlertCircle, RotateCcw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PowerDistributionHistoryTable } from './power-distribution-history-table';
import { usePowerDistributionHistory } from '@/hooks/use-power-distribution-history';

interface PowerLossViewProps {
    transformerId: string;
    newBuildingId: string;
    oldBuildingId: string;
}

function fmt(v: number) { return v.toFixed(2); }

// ─── Remarks config ───────────────────────────────────────────────────────────

const REMARKS_CONFIG: Record<Remarks, {
    label: string;
    description: string;
    icon: React.ElementType;
    bg: string; text: string; border: string; stripe: string; dot: string;
}> = {
    normal: {
        label: 'Normal', description: 'Distribution balanced',
        icon: CheckCircle2,
        bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/30', stripe: 'bg-emerald-500', dot: 'bg-emerald-500',
    },
    unstable: {
        label: 'Unstable', description: 'Minor deviation detected',
        icon: AlertTriangle,
        bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30', stripe: 'bg-amber-500', dot: 'bg-amber-500',
    },
    pilferage: {
        label: 'Pilferage', description: 'Significant loss detected',
        icon: ShieldAlert,
        bg: 'bg-destructive/10', text: 'text-destructive',
        border: 'border-destructive/30', stripe: 'bg-destructive', dot: 'bg-destructive',
    },
};

// ─── Remarks badge ────────────────────────────────────────────────────────────

function RemarksBadge({ remarks, loading }: { remarks: Remarks; loading: boolean }) {
    if (loading) return <Skeleton className="h-7 w-24 rounded-full" />;
    const cfg = REMARKS_CONFIG[remarks];
    const Icon = cfg.icon;
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', cfg.bg, cfg.text, cfg.border)}>
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

function PowerDistributionCard({ loading, pt, pn, po, deviation, remarks }: {
    loading: boolean; pt: number; pn: number; po: number; deviation: number; remarks: Remarks;
}) {
    const cfg = REMARKS_CONFIG[remarks];
    const Icon = cfg.icon;

    return (
        <div className={cn('overflow-hidden rounded-2xl border bg-card', cfg.border)}>
            <div className={cn('h-1.5 w-full', cfg.stripe)} />
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', cfg.bg)}>
                        <Icon className={cn('h-5 w-5', cfg.text)} />
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Power Distribution</p>
                        {loading ? <Skeleton className="mt-1 h-5 w-32" /> : <p className="text-base font-semibold text-foreground">{cfg.description}</p>}
                    </div>
                </div>

                {/* Deviation KPI */}
                <div className={cn('mt-6 rounded-2xl border p-6 text-center', cfg.border, cfg.bg)}>
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Power Deviation</p>
                    {loading ? <Skeleton className="mx-auto mt-4 h-14 w-40" /> : (
                        <>
                            <div className={cn('mt-2 text-6xl font-black tracking-tight tabular-nums', cfg.text)}>
                                {fmt(Math.abs(deviation))}
                            </div>
                            <p className="text-lg font-medium text-muted-foreground">Watts Difference</p>
                            <div className={cn('mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold capitalize', cfg.bg, cfg.text)}>
                                <Icon className="h-3.5 w-3.5" />
                                {remarks}
                            </div>
                        </>
                    )}
                </div>

                {/* Equation: PT = PN + PO */}
                <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-muted/40 px-4 py-4">
                    {loading ? <Skeleton className="h-8 w-full" /> : (
                        <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">PT</span>
                                <span className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{fmt(pt)} W</span>
                            </div>
                            <span className="mt-5 text-xl font-light text-muted-foreground">=</span>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">PN</span>
                                <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(pn)} W</span>
                            </div>
                            <span className="mt-5 text-xl font-light text-muted-foreground">+</span>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">PO</span>
                                <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{fmt(po)} W</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                    {[
                        { dot: 'bg-emerald-500', label: 'Normal', range: '0 W' },
                        { dot: 'bg-amber-500', label: 'Unstable', range: '> Unstable threshold' },
                        { dot: 'bg-destructive', label: 'Pilferage', range: '> Pilferage threshold' },
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

// ─── Device card (PT / PN / PO) ───────────────────────────────────────────────

function DeviceCard({ label, name, sublabel, icon, accentColor, accentBg, accentText, total, loading }: {
    label: string; name: string; sublabel: string; icon: React.ReactNode;
    accentColor: string; accentBg: string; accentText: string; total: number; loading: boolean;
}) {
    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
            <div className={cn('h-1 w-full', accentColor)} />
            <div className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', accentBg)}>{icon}</div>
                        <div>
                            <p className="text-sm font-semibold leading-none">{name}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
                        </div>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide', accentBg, accentText)}>{label}</span>
                </div>
                <div className={cn('flex flex-col items-center justify-center rounded-xl py-5', accentBg)}>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Power</span>
                    {loading
                        ? <Skeleton className="h-10 w-28" />
                        : <span className={cn('font-mono text-3xl font-bold tabular-nums', accentText)}>
                            {fmt(total)}<span className="ml-1 text-sm font-normal text-muted-foreground">W</span>
                        </span>
                    }
                </div>
                <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Live reading</span>
                    <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', accentColor, !loading && 'animate-pulse')} />
                </div>
            </div>
        </div>
    );
}

// ─── Power Distribution Threshold Panel ───────────────────────────────────────

function PowerDistributionThresholdPanel({ userId, currentDeviation, remarks, loading }: {
    userId?: string; currentDeviation: number; remarks: Remarks; loading: boolean;
}) {
    const { thresholds, saveThreshold, resetThreshold, saving, lastSavedAt, lastSavedAction } = useThresholds(userId);
    const { toast } = useToast();
    const lastToastAt = useRef<number | null>(null);

    const pdThreshold = thresholds.power_distribution;

    const [draft, setDraft] = useState({ warning: pdThreshold.warning, critical: pdThreshold.critical });

    // Sync draft when thresholds load from Firebase
    useEffect(() => {
        setDraft({ warning: pdThreshold.warning, critical: pdThreshold.critical });
    }, [pdThreshold.warning, pdThreshold.critical]);

    // Toast on save/reset
    useEffect(() => {
        if (!lastSavedAt || lastToastAt.current === lastSavedAt) return;
        lastToastAt.current = lastSavedAt;
        const title = lastSavedAction === 'reset' ? 'Thresholds reset' : 'Thresholds saved';
        toast({ title, description: 'Power distribution thresholds updated.' });
    }, [lastSavedAt, lastSavedAction, toast]);

    const isDirty = draft.warning !== pdThreshold.warning || draft.critical !== pdThreshold.critical;
    const isInvalid = draft.warning >= draft.critical;
    const canSave = isDirty && !isInvalid && !saving;

    const handleSave = () => {
        if (!canSave) return;
        saveThreshold('power_distribution', { warning: draft.warning, critical: draft.critical });
    };

    const handleReset = () => {
        resetThreshold('power_distribution');
    };

    // Range bar geometry
    const absDeviation = Math.abs(currentDeviation);
    const maxRange = Math.max(draft.critical * 1.5, absDeviation * 1.2, 20);
    const warnPct = (draft.warning / maxRange) * 100;
    const pilfPct = (draft.critical / maxRange) * 100;
    const currentPct = Math.min((absDeviation / maxRange) * 100, 100);

    const statusColors: Record<Remarks, string> = {
        normal: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
        unstable: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
        pilferage: 'text-red-500 bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
    };

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Power Distribution Threshold
                </h2>
                <div className="h-px flex-1 bg-border" />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-background">
                {/* Header row */}
                <div className="flex w-full items-center gap-3 px-4 py-3">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                    <span className="flex-1 text-[13px] font-medium text-foreground">Deviation Thresholds</span>
                    {!loading && (
                        <span className="font-mono text-[13px] font-medium text-foreground">
                            {fmt(Math.abs(currentDeviation))}
                            <span className="ml-0.5 text-[11px] font-normal text-muted-foreground"> W</span>
                        </span>
                    )}
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', statusColors[remarks])}>
                        {remarks}
                    </span>
                </div>

                {/* Body */}
                <div className="border-t border-border px-4 pb-4 pt-3">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                        {/* Left — stat pills + range bar */}
                        <div>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current Deviation</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Deviation', value: loading ? '—' : fmt(absDeviation), unit: 'W' },
                                    { label: 'Unstable >', value: fmt(draft.warning), unit: 'W' },
                                    { label: 'Pilferage >', value: fmt(draft.critical), unit: 'W' },
                                ].map(({ label, value, unit }) => (
                                    <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                                        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
                                        <span className="font-mono text-[15px] font-medium text-foreground">
                                            {value}<span className="ml-0.5 text-[11px] font-normal text-muted-foreground"> {unit}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right — threshold inputs */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Thresholds</p>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleReset}
                                        disabled={saving}
                                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                                    >
                                        <RotateCcw className="h-2.5 w-2.5" /> Reset
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!canSave}
                                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                                    >
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {/* Unstable — maps to threshold.warning */}
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                    <span className="w-24 text-[11px] text-muted-foreground">Unstable (&gt;)</span>
                                    <div className="relative flex flex-1 items-center overflow-hidden rounded-md border border-border transition-colors focus-within:border-amber-400">
                                        <Input
                                            type="number" value={draft.warning} step="0.1" min={0}
                                            onChange={(e) => setDraft((p) => ({ ...p, warning: parseFloat(e.target.value) || 0 }))}
                                            className="h-8 border-0 bg-transparent pr-10 text-right font-mono text-[12px] shadow-none focus-visible:ring-0"
                                        />
                                        <span className="pointer-events-none absolute right-2.5 text-[11px] text-muted-foreground">W</span>
                                    </div>
                                </div>

                                {/* Pilferage — maps to threshold.critical */}
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
                                    <span className="w-24 text-[11px] text-muted-foreground">Pilferage (&gt;)</span>
                                    <div className="relative flex flex-1 items-center overflow-hidden rounded-md border border-border transition-colors focus-within:border-destructive">
                                        <Input
                                            type="number" value={draft.critical} step="0.1" min={0}
                                            onChange={(e) => setDraft((p) => ({ ...p, critical: parseFloat(e.target.value) || 0 }))}
                                            className="h-8 border-0 bg-transparent pr-10 text-right font-mono text-[12px] shadow-none focus-visible:ring-0"
                                        />
                                        <span className="pointer-events-none absolute right-2.5 text-[11px] text-muted-foreground">W</span>
                                    </div>
                                </div>
                            </div>

                            {isInvalid && (
                                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Unstable threshold must be below pilferage.
                                </p>
                            )}
                        </div>

                    </div>
                    {/* Range bar */}
                    <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                            <span>0 W</span>
                            <span className="font-medium text-foreground">
                                Current: {loading ? '—' : fmt(absDeviation)} W
                            </span>
                            <span>{fmt(maxRange)} W</span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="absolute inset-y-0 bg-amber-200 dark:bg-amber-900"
                                style={{ left: `${warnPct}%`, right: `${100 - pilfPct}%` }} />
                            <div className="absolute inset-y-0 bg-red-200 dark:bg-red-900"
                                style={{ left: `${pilfPct}%`, right: 0 }} />
                            <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-foreground"
                                style={{ left: `${currentPct}%` }} />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[10px]">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Normal</span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Unstable</span>
                            <span className="text-destructive font-medium">Pilferage</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PowerLossView({ transformerId, newBuildingId, oldBuildingId }: PowerLossViewProps) {
    const { user } = useAuth();
    const { latest, loading, error } = usePowerLoss(transformerId, newBuildingId, oldBuildingId, user?.uid);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [autoUpload, setAutoUpload] = useState(true);
    const [lastUploadedTs, setLastUploadedTs] = useState<number>(0);
    const isInitialMount = useRef(true);

    const { data: historyData, loading: historyLoading, error: historyError } = usePowerDistributionHistory(500);

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

        // Catch the page refresh / initial load
        if (isInitialMount.current) {
            isInitialMount.current = false;
            setLastUploadedTs(latest.timestamp);
            return;
        }

        // Normal 30-second throttle check
        if (latest.timestamp - lastUploadedTs < 30000) return;

        const db = getDatabase(app);
        const newRef = push(ref(db, 'pt_history'));
        set(newRef, {
            timestamp: latest.timestamp,
            time: latest.time,
            pt_total: latest.pt, // Maps directly to new twm_total_power via the hook above
            pn_total: latest.pn, // Maps directly to new twm_total_power via the hook above
            po_total: latest.po, // Maps directly to new twm_total_power via the hook above
            deviation: latest.deviation,
            remarks: latest.remarks,
        })
            .then(() => setLastUploadedTs(latest.timestamp))
            .catch(console.error);

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
                        <RemarksBadge remarks={remarks} loading={loading} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Real-time verification of{' '}
                        <span className="font-mono font-medium text-foreground">PT = PN + PO</span>
                    </p>
                </div>
                {isAdmin && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
                        <CloudUpload className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Auto-upload</span>
                        <Switch checked={autoUpload} onCheckedChange={setAutoUpload} className="scale-75 origin-right" />
                    </label>
                )}
            </div>

            {/* Power Distribution hero card */}
            <PowerDistributionCard
                loading={loading}
                pt={latest?.pt ?? 0} pn={latest?.pn ?? 0} po={latest?.po ?? 0}
                deviation={latest?.deviation ?? 0} remarks={remarks}
            />

            {/* PT / PN / PO device cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <DeviceCard label="PT" name="Transformer" sublabel="Power source"
                    icon={<Zap className="h-4 w-4 text-indigo-500" />}
                    accentColor="bg-indigo-500" accentBg="bg-indigo-500/10" accentText="text-indigo-600 dark:text-indigo-400"
                    total={latest?.pt ?? 0} loading={loading} />
                <DeviceCard label="PN" name="New Building" sublabel="Load endpoint"
                    icon={<Building2 className="h-4 w-4 text-emerald-500" />}
                    accentColor="bg-emerald-500" accentBg="bg-emerald-500/10" accentText="text-emerald-600 dark:text-emerald-400"
                    total={latest?.pn ?? 0} loading={loading} />
                <DeviceCard label="PO" name="Old Building" sublabel="Load endpoint"
                    icon={<Building className="h-4 w-4 text-amber-500" />}
                    accentColor="bg-amber-500" accentBg="bg-amber-500/10" accentText="text-amber-600 dark:text-amber-400"
                    total={latest?.po ?? 0} loading={loading} />
            </div>

            {/* Threshold panel */}
            <PowerDistributionThresholdPanel
                userId={user?.uid}
                currentDeviation={latest?.deviation ?? 0}
                remarks={remarks}
                loading={loading}
            />

            <PowerDistributionHistoryTable
                records={historyData}
                loading={historyLoading}
            />
        </div>
    );
}