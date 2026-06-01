'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsUpDown,
    Download,
    Edit2,
    Filter,
    MinusCircle,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { getDatabase, push, ref, remove, set, update } from 'firebase/database';
import { app } from '@/lib/firebase';
import { useSensorData, type PowerReading } from '@/hooks/use-sensor-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    getMetricMeta,
    getThresholdValue,
    isThresholdMetricKey,
    type SignalThreshold,
    type ThresholdConfig,
} from '@/lib/thresholds';

export type ReadingLevel = 'critical' | 'warning' | 'normal' | 'no-signal';

interface ReadingsManagementTableProps {
    thresholds?: ThresholdConfig;
    isSuperAdmin: boolean;
    deviceId?: string | null;
}

interface RawReadingDraft {
    recordedAt: string;
    p1_voltage: number;
    p1_current: number;
    p1_power: number;
    p2_voltage: number;
    p2_current: number;
    p2_power: number;
    p3_voltage: number;
    p3_current: number;
    p3_power: number;
    total_power: number;
}

interface TableRow {
    id: string;
    recordedAt: string;
    voltage: number;
    current: number;
    power: number;
    level: ReadingLevel;
    assessment: string;
    threshold: SignalThreshold | null;
    searchText: string;
}

const LEVEL_CFG: Record<ReadingLevel, { icon: React.ElementType; label: string; pill: string }> = {
    critical: {
        icon: AlertCircle,
        label: 'Critical',
        pill: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    },
    warning: {
        icon: AlertTriangle,
        label: 'Warning',
        pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    },
    normal: {
        icon: CheckCircle2,
        label: 'Normal',
        pill: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    },
    'no-signal': {
        icon: MinusCircle,
        label: 'No Signal',
        pill: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
    },
};

const PAGE_SIZES = [10, 25, 50];

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Please try again.';
}

function average(values: Array<number | undefined>, ignoreZero = false): number {
    const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (valid.length === 0) return 0;
    const sample = ignoreZero ? valid.filter((value) => Math.abs(value) > 1e-9) : valid;
    const source = sample.length > 0 ? sample : valid;
    return source.reduce((sum, value) => sum + value, 0) / source.length;
}

function toFinite(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function formatThresholds(threshold: SignalThreshold | null, unit: string): string {
    if (!threshold) return '—';
    return `${threshold.warning} / ${threshold.critical} ${unit}`;
}

function resolveThreshold(metric: 'current', thresholds?: ThresholdConfig): SignalThreshold | null {
    if (!isThresholdMetricKey(metric)) return null;
    return {
        warning: getThresholdValue(metric, 'warning', thresholds),
        critical: getThresholdValue(metric, 'critical', thresholds),
    };
}

function getLevel(value: number, threshold: SignalThreshold | null): ReadingLevel {
    if (!threshold) return 'normal';
    if (value >= threshold.critical) return 'critical';
    if (value >= threshold.warning) return 'warning';
    return 'normal';
}

function getAssessment(level: ReadingLevel, threshold: SignalThreshold | null): string {
    if (!threshold) return 'No thresholds configured';
    if (level === 'no-signal') return 'No signal detected';
    if (level === 'critical') return 'Above critical threshold';
    if (level === 'warning') return 'Above warning threshold';
    return 'Within threshold';
}

function rawReadingToRow(id: string, reading: PowerReading, thresholds?: ThresholdConfig): TableRow {
    const timestamp = Number(reading.timestamp);
    const recordedAt = Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : (Date.parse(reading.timestamp) ? new Date(Date.parse(reading.timestamp)).toISOString() : new Date().toISOString());

    const voltage = average([reading.p1_voltage, reading.p2_voltage, reading.p3_voltage], true);
    const current = average([reading.p1_current, reading.p2_current, reading.p3_current], true);
    const power = Number.isFinite(reading.total_power) ? reading.total_power : reading.p1_power + reading.p2_power + reading.p3_power;
    const threshold = resolveThreshold('current', thresholds);
    const level = getLevel(current, threshold);

    const searchText = [
        id,
        formatDateTime(recordedAt),
        String(voltage),
        String(current),
        String(power),
        level,
        getAssessment(level, threshold),
    ].join(' ').toLowerCase();

    return {
        id,
        recordedAt,
        voltage,
        current,
        power,
        threshold,
        level,
        assessment: getAssessment(level, threshold),
        searchText,
    };
}

function emptyDraft(): RawReadingDraft {
    return {
        recordedAt: new Date().toISOString(),
        p1_voltage: 0,
        p1_current: 0,
        p1_power: 0,
        p2_voltage: 0,
        p2_current: 0,
        p2_power: 0,
        p3_voltage: 0,
        p3_current: 0,
        p3_power: 0,
        total_power: 0,
    };
}

function draftFromReading(reading: PowerReading): RawReadingDraft {
    return {
        recordedAt: reading.timestamp || new Date().toISOString(),
        p1_voltage: reading.p1_voltage,
        p1_current: reading.p1_current,
        p1_power: reading.p1_power,
        p2_voltage: reading.p2_voltage,
        p2_current: reading.p2_current,
        p2_power: reading.p2_power,
        p3_voltage: reading.p3_voltage,
        p3_current: reading.p3_current,
        p3_power: reading.p3_power,
        total_power: reading.total_power,
    };
}

function draftToPayload(draft: RawReadingDraft) {
    const recordedAt = new Date(draft.recordedAt);
    const timestamp = recordedAt.toISOString();
    return {
        timestamp,
        time: timestamp,
        device_id: undefined,
        p1_voltage: draft.p1_voltage,
        p1_current: draft.p1_current,
        p1_power: draft.p1_power,
        p2_voltage: draft.p2_voltage,
        p2_current: draft.p2_current,
        p2_power: draft.p2_power,
        p3_voltage: draft.p3_voltage,
        p3_current: draft.p3_current,
        p3_power: draft.p3_power,
        total_power: draft.total_power,
    };
}

type SortKey = 'recordedAt' | 'voltage' | 'current' | 'power';

function downloadCSV(rows: TableRow[], filename = 'readings-management.csv') {
    const headers = ['id', 'voltage', 'current', 'power', 'warningThreshold', 'criticalThreshold', 'recordedAt'];
    const records = rows.map((row) => [
        row.id,
        row.voltage,
        row.current,
        row.power,
        row.threshold?.warning ?? '',
        row.threshold?.critical ?? '',
        row.recordedAt,
    ].join(','));
    const blob = new Blob([[headers.join(','), ...records].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function SortBtn({ active, dir, onClick }: { active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
    const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
    return (
        <button onClick={onClick} className="ml-1 inline-flex opacity-50 hover:opacity-100" type="button">
            <Icon className="h-3 w-3" />
        </button>
    );
}

function EditableField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (next: number) => void;
}) {
    return (
        <label className="space-y-1 text-[11px] text-muted-foreground">
            <span className="block font-medium uppercase tracking-widest">{label}</span>
            <Input
                type="number"
                step="0.01"
                value={value}
                onChange={(event) => onChange(toFinite(event.target.value))}
                className="h-9 text-[13px]"
            />
        </label>
    );
}

export function ReadingsManagementTable({ thresholds, isSuperAdmin, deviceId }: ReadingsManagementTableProps) {
    const { data: sensorData, loading, error } = useSensorData(deviceId ?? undefined);
    const db = useMemo(() => getDatabase(app), []);
    const readingsById = useMemo(() => {
        return new Map(sensorData.map((reading) => [reading.key, reading]));
    }, [sensorData]);

    const [search, setSearch] = useState('');
    const [/*levelFilter*/, /*setLevelFilter*/] = useState<ReadingLevel | 'all'>('all');
    const [sortKey, setSortKey] = useState<SortKey>('recordedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [draft, setDraft] = useState<RawReadingDraft>(emptyDraft());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const deferredSearch = useDeferredValue(search);

    const rows = useMemo<TableRow[]>(() => {
        return sensorData.map((reading) => rawReadingToRow(reading.key, reading, thresholds));
    }, [sensorData, thresholds]);

    const metricSummary = useMemo(() => {
        return {
            critical: rows.filter((row) => row.level === 'critical').length,
            warning: rows.filter((row) => row.level === 'warning').length,
            noSignal: rows.filter((row) => row.level === 'no-signal').length,
        };
    }, [rows]);

    const filtered = useMemo(() => {
        const query = deferredSearch.trim().toLowerCase();
        return rows.filter((row) => {
            if (query && !row.searchText.includes(query)) return false;
            return true;
        });
    }, [rows, deferredSearch]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let av: string | number = 0;
            let bv: string | number = 0;

            if (sortKey === 'recordedAt') {
                av = Date.parse(a.recordedAt);
                bv = Date.parse(b.recordedAt);
            } else if (sortKey === 'voltage') {
                av = a.voltage;
                bv = b.voltage;
            } else if (sortKey === 'current') {
                av = a.current;
                bv = b.current;
            } else if (sortKey === 'power') {
                av = a.power;
                bv = b.power;
            }

            if (av === bv) return 0;
            if (sortDir === 'asc') return av > bv ? 1 : -1;
            return av < bv ? 1 : -1;
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
    const hasFilters = search !== '';

    const currentRefPath = useMemo(() => {
        if (!deviceId) return null;
        return `readings/${deviceId}`;
    }, [deviceId]);

    const resetForm = useCallback(() => {
        setDraft(emptyDraft());
        setEditingId(null);
        setFormOpen(false);
        setActionError(null);
    }, []);

    const openCreate = useCallback(() => {
        setDraft(emptyDraft());
        setEditingId(null);
        setFormOpen(true);
        setActionError(null);
    }, []);

    const openEdit = useCallback((reading: PowerReading) => {
        setDraft(draftFromReading(reading));
        setEditingId(reading.key);
        setFormOpen(true);
        setActionError(null);
    }, []);

    const handleSave = useCallback(async () => {
        if (!currentRefPath) {
            setActionError('Select a device before saving readings.');
            return;
        }

        setSaving(true);
        setActionError(null);
        try {
            const payload = draftToPayload(draft);
            if (editingId) {
                await update(ref(db, `${currentRefPath}/${editingId}`), payload);
            } else {
                const nextRef = push(ref(db, currentRefPath));
                if (!nextRef.key) {
                    throw new Error('Could not create a new reading key.');
                }
                await set(nextRef, payload);
            }
            resetForm();
        } catch (saveError) {
            setActionError(getErrorMessage(saveError));
        } finally {
            setSaving(false);
        }
    }, [currentRefPath, db, draft, editingId, resetForm]);

    const handleDelete = useCallback(async () => {
        if (!currentRefPath || !deleteTarget) return;
        setSaving(true);
        setActionError(null);
        try {
            await remove(ref(db, `${currentRefPath}/${deleteTarget}`));
            setDeleteTarget(null);
        } catch (deleteError) {
            setActionError(getErrorMessage(deleteError));
        } finally {
            setSaving(false);
        }
    }, [currentRefPath, db, deleteTarget]);

    const clearFilters = useCallback(() => {
        setSearch('');
        setPage(1);
    }, []);

    const handleSort = useCallback((nextKey: SortKey) => {
        setSortKey((prev) => {
            if (prev === nextKey) {
                setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
                return nextKey;
            }
            setSortDir('desc');
            return nextKey;
        });
        setPage(1);
    }, []);

    if (!isSuperAdmin) {
        return null;
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Live Readings Management
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{metricSummary.critical} critical</span>
                    <span>· {metricSummary.warning} warning</span>
                    <span>· {metricSummary.noSignal} no signal</span>
                    <span>· {rows.length} total</span>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {getErrorMessage(error)}
                </div>
            )}

            {actionError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {actionError}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    <div className="relative min-w-45 flex-1">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Search readings..."
                            className="h-8 border-border pl-8 text-[12px] shadow-none"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Filter className="h-3 w-3 text-muted-foreground" />

                        {/* level filter removed */}

                        {hasFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="flex-1" />

                    <Button size="sm" onClick={openCreate} className="gap-1.5 text-[12px]">
                        <Plus className="h-3.5 w-3.5" />
                        Add reading
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCSV(sorted)}
                        className="gap-1.5 text-[12px]"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </Button>
                </div>

                {formOpen && (
                    <div className="border-b border-border bg-muted/20 px-4 py-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                                {editingId ? 'Edit reading' : 'Create reading'}
                            </p>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                Close
                            </button>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <label className="space-y-1 text-[11px] text-muted-foreground lg:col-span-2">
                                <span className="block font-medium uppercase tracking-widest">Recorded At</span>
                                <Input
                                    type="datetime-local"
                                    value={(() => {
                                        const d = new Date(draft.recordedAt);
                                        if (!Number.isFinite(d.getTime())) return '';
                                        const pad = (v: number) => String(v).padStart(2, '0');
                                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                    })()}
                                    onChange={(event) => {
                                        const ts = Date.parse(event.target.value);
                                        setDraft((prev) => ({
                                            ...prev,
                                            recordedAt: Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString(),
                                        }));
                                    }}
                                    className="h-9 text-[13px]"
                                />
                            </label>

                            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Phase 1</p>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <EditableField label="Voltage" value={draft.p1_voltage} onChange={(value) => setDraft((prev) => ({ ...prev, p1_voltage: value }))} />
                                    <EditableField label="Current" value={draft.p1_current} onChange={(value) => setDraft((prev) => ({ ...prev, p1_current: value }))} />
                                    <EditableField label="Power" value={draft.p1_power} onChange={(value) => setDraft((prev) => ({ ...prev, p1_power: value }))} />
                                </div>
                            </div>

                            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Phase 2</p>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <EditableField label="Voltage" value={draft.p2_voltage} onChange={(value) => setDraft((prev) => ({ ...prev, p2_voltage: value }))} />
                                    <EditableField label="Current" value={draft.p2_current} onChange={(value) => setDraft((prev) => ({ ...prev, p2_current: value }))} />
                                    <EditableField label="Power" value={draft.p2_power} onChange={(value) => setDraft((prev) => ({ ...prev, p2_power: value }))} />
                                </div>
                            </div>

                            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Phase 3</p>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <EditableField label="Voltage" value={draft.p3_voltage} onChange={(value) => setDraft((prev) => ({ ...prev, p3_voltage: value }))} />
                                    <EditableField label="Current" value={draft.p3_current} onChange={(value) => setDraft((prev) => ({ ...prev, p3_current: value }))} />
                                    <EditableField label="Power" value={draft.p3_power} onChange={(value) => setDraft((prev) => ({ ...prev, p3_power: value }))} />
                                </div>
                            </div>

                            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total</p>
                                <EditableField label="Total Power" value={draft.total_power} onChange={(value) => setDraft((prev) => ({ ...prev, total_power: value }))} />
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full min-w-180 text-[12px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Recorded
                                    <SortBtn active={sortKey === 'recordedAt'} dir={sortDir} onClick={() => handleSort('recordedAt')} />
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Voltage
                                    <SortBtn active={sortKey === 'voltage'} dir={sortDir} onClick={() => handleSort('voltage')} />
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Current
                                    <SortBtn active={sortKey === 'current'} dir={sortDir} onClick={() => handleSort('current')} />
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Power
                                    <SortBtn active={sortKey === 'power'} dir={sortDir} onClick={() => handleSort('power')} />
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-[13px] text-muted-foreground">
                                        Loading live readings...
                                    </td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-[13px] text-muted-foreground">
                                        {hasFilters ? 'No readings match the current filters.' : 'No readings yet.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((row) => {
                                    return (
                                        <tr key={row.id} className="transition-colors hover:bg-muted/20">

                                            <td className="px-4 py-3">
                                                <p className="font-mono text-[11px] text-foreground">{formatDateTime(row.recordedAt)}</p>
                                            </td>

                                            <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                                                {row.voltage.toFixed(2)} V
                                            </td>

                                            <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                                                {row.current.toFixed(2)} A
                                            </td>

                                            <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                                                {row.power.toFixed(2)} W
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={() => {
                                                            const reading = readingsById.get(row.id);
                                                            if (reading) openEdit(reading);
                                                        }}
                                                        title="Edit reading"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={() => setDeleteTarget(row.id)}
                                                        className="text-destructive hover:text-destructive"
                                                        title="Delete reading"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span>Rows per page</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-[12px]">
                                    {pageSize}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {PAGE_SIZES.map((size) => (
                                    <DropdownMenuItem key={size} onClick={() => { setPageSize(size); setPage(1); }}>
                                        {size}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <span>
                            {sorted.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, sorted.length)}`} of {sorted.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={safePage === 1}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-2 text-[12px] text-muted-foreground">{safePage} / {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={safePage === totalPages}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete reading?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the selected reading from Firebase.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={saving}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
