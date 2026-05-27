'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsUpDown,
    Filter,
    MinusCircle,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
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
    getMetricLabel,
    getMetricMeta,
    getMetricUnit,
    getThresholdValue,
    isThresholdMetricKey,
    type SignalThreshold,
    type ThresholdConfig,
    type ThresholdMetricKey,
} from '@/lib/thresholds';

export type ReadingLevel = 'critical' | 'warning' | 'normal' | 'no-signal';
export type ReadingMetric = ThresholdMetricKey | 'power_factor';

export interface ReadingRecord {
    id: string;
    metric: ReadingMetric;
    value: number;
    unit?: string;
    recordedAt: string;
}

interface ReadingsManagementTableProps {
    thresholds?: ThresholdConfig;
    isSuperAdmin: boolean;
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

const METRICS: ReadingMetric[] = ['voltage', 'current', 'power', 'power_loss', 'power_factor'];
const PAGE_SIZES = [10, 25, 50];

function getMetricLabelSafe(metric: ReadingMetric): string {
    if (isThresholdMetricKey(metric)) return getMetricLabel(metric);
    return metric === 'power_factor' ? 'Power Factor' : metric;
}

function getMetricUnitSafe(metric: ReadingMetric): string {
    if (isThresholdMetricKey(metric)) return getMetricUnit(metric);
    return metric === 'power_factor' ? 'pf' : '';
}

function resolveThreshold(metric: ReadingMetric, thresholds?: ThresholdConfig): SignalThreshold | null {
    if (!isThresholdMetricKey(metric)) return null;
    return {
        warning: getThresholdValue(metric, 'warning', thresholds),
        critical: getThresholdValue(metric, 'critical', thresholds),
    };
}

function getLevel(value: number, threshold: SignalThreshold | null, metric: ReadingMetric): ReadingLevel {
    if (isThresholdMetricKey(metric)) {
        const meta = getMetricMeta(metric);
        const zeroStatus = meta?.zeroStatus ?? 'no-signal';
        if (value === 0 && zeroStatus === 'no-signal') return 'no-signal';
    }
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

function toDatetimeLocalValue(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const pad = (v: number) => String(v).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromDatetimeLocalValue(value: string): string {
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Please try again.';
}

type SortKey = 'recordedAt' | 'level' | 'metric' | 'value';

type TableRow = ReadingRecord & {
    level: ReadingLevel;
    assessment: string;
    threshold: SignalThreshold | null;
    unit: string;
};

function SortBtn({
    col,
    active,
    dir,
    onClick,
}: { col: SortKey; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
    const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
    return (
        <button onClick={onClick} className="ml-1 inline-flex opacity-50 hover:opacity-100" type="button">
            <Icon className="h-3 w-3" />
        </button>
    );
}

export function ReadingsManagementTable({ thresholds, isSuperAdmin }: ReadingsManagementTableProps) {
    const [records, setRecords] = useState<ReadingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [levelFilter, setLevelFilter] = useState<ReadingLevel | 'all'>('all');
    const [metricFilter, setMetricFilter] = useState<ReadingMetric | 'all'>('all');
    const [sortKey, setSortKey] = useState<SortKey>('recordedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [rowDeleteTarget, setRowDeleteTarget] = useState<ReadingRecord | null>(null);

    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    const [draft, setDraft] = useState<Omit<ReadingRecord, 'id'>>({
        metric: 'power' as ReadingMetric,
        value: 0,
        unit: getMetricUnitSafe('power'),
        recordedAt: new Date().toISOString(),
    });

    const loadRecords = useCallback(async () => {
        if (!isSuperAdmin) {
            setRecords([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/readings', {
                method: 'GET',
                credentials: 'same-origin',
            });
            const raw = await response.text();
            let payload: { records?: ReadingRecord[]; error?: string } | null = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                throw new Error(payload?.error || raw || 'Failed to load records.');
            }
            setRecords(payload?.records ?? []);
        } catch (err) {
            setError(getErrorMessage(err));
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        void loadRecords();
    }, [loadRecords]);

    const rows = useMemo<TableRow[]>(() => {
        return records.map((record) => {
            const threshold = resolveThreshold(record.metric, thresholds);
            const level = getLevel(record.value, threshold, record.metric);
            const unit = record.unit ?? getMetricUnitSafe(record.metric);
            return {
                ...record,
                unit,
                threshold,
                level,
                assessment: getAssessment(level, threshold),
            };
        });
    }, [records, thresholds]);

    const filtered = useMemo(() => {
        return rows.filter((row) => {
            if (levelFilter !== 'all' && row.level !== levelFilter) return false;
            if (metricFilter !== 'all' && row.metric !== metricFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                const haystack = [
                    row.assessment,
                    row.level,
                    row.metric,
                    getMetricLabelSafe(row.metric),
                    String(row.value),
                    row.recordedAt,
                ].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [rows, levelFilter, metricFilter, search]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let av: string | number = 0;
            let bv: string | number = 0;

            if (sortKey === 'recordedAt') {
                av = Date.parse(a.recordedAt);
                bv = Date.parse(b.recordedAt);
            } else if (sortKey === 'level') {
                const order: Record<ReadingLevel, number> = { critical: 0, warning: 1, 'no-signal': 2, normal: 3 };
                av = order[a.level];
                bv = order[b.level];
            } else if (sortKey === 'metric') {
                av = getMetricLabelSafe(a.metric);
                bv = getMetricLabelSafe(b.metric);
            } else if (sortKey === 'value') {
                av = a.value;
                bv = b.value;
            }

            if (av === bv) return 0;
            if (sortDir === 'asc') return av > bv ? 1 : -1;
            return av < bv ? 1 : -1;
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    const allPageSelected = paginated.length > 0 && paginated.every((row) => selectedIds.has(row.id));

    const handleSort = useCallback((col: SortKey) => {
        setSortKey((prev) => {
            if (prev === col) {
                setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
                return col;
            }
            setSortDir('desc');
            return col;
        });
    }, []);

    const handleCreate = useCallback(async () => {
        setCreating(true);
        try {
            const response = await fetch('/api/admin/readings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(draft),
            });
            const raw = await response.text();
            let payload: { error?: string } | null = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                throw new Error(payload?.error || raw || 'Failed to create record.');
            }
            setShowCreate(false);
            await loadRecords();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setCreating(false);
        }
    }, [draft, loadRecords]);

    const handleUpdate = useCallback(async (id: string, next: Omit<ReadingRecord, 'id'>) => {
        setSavingId(id);
        try {
            const response = await fetch(`/api/admin/readings/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(next),
            });
            const raw = await response.text();
            let payload: { error?: string } | null = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                throw new Error(payload?.error || raw || 'Failed to update record.');
            }
            setEditingId(null);
            await loadRecords();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSavingId(null);
        }
    }, [loadRecords]);

    const handleDelete = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/admin/readings/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });
            const raw = await response.text();
            let payload: { error?: string } | null = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                throw new Error(payload?.error || raw || 'Failed to delete record.');
            }
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setRowDeleteTarget(null);
            await loadRecords();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    }, [loadRecords]);

    const handleBulkDelete = useCallback(async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        try {
            const response = await fetch('/api/admin/readings/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ ids }),
            });
            const raw = await response.text();
            let payload: { error?: string } | null = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                throw new Error(payload?.error || raw || 'Failed to delete selected records.');
            }
            setBulkDeleteOpen(false);
            setSelectedIds(new Set());
            await loadRecords();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    }, [loadRecords, selectedIds]);

    const clearFilters = () => {
        setLevelFilter('all');
        setMetricFilter('all');
        setSearch('');
        setPage(1);
    };

    if (!isSuperAdmin) {
        return null;
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Readings Management
                </h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">{records.length} total</span>
            </div>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    <div className="relative min-w-45 flex-1">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
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

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {levelFilter === 'all' ? 'Level' : LEVEL_CFG[levelFilter].label}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Level</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setLevelFilter('all')}>All</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLevelFilter('critical')}>Critical</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLevelFilter('warning')}>Warning</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLevelFilter('no-signal')}>No Signal</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLevelFilter('normal')}>Normal</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {metricFilter === 'all' ? 'Metric' : getMetricLabelSafe(metricFilter)}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Metric</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setMetricFilter('all')}>All</DropdownMenuItem>
                                {METRICS.map((metric) => (
                                    <DropdownMenuItem key={metric} onClick={() => setMetricFilter(metric)}>
                                        {getMetricLabelSafe(metric)}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {(levelFilter !== 'all' || metricFilter !== 'all' || search) && (
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

                    <Button size="sm" onClick={() => setShowCreate((v) => !v)} className="gap-1.5 text-[12px]">
                        <Plus className="h-3.5 w-3.5" />
                        Add reading
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkDeleteOpen(true)}
                        disabled={selectedIds.size === 0}
                        className="gap-1.5 text-[12px]"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete selected ({selectedIds.size})
                    </Button>
                </div>

                {showCreate && (
                    <div className="grid grid-cols-1 gap-2 border-b border-border bg-muted/20 px-4 py-3 sm:grid-cols-4">
                        <select
                            value={draft.metric}
                            onChange={(event) => {
                                const metric = event.target.value as ReadingMetric;
                                setDraft((prev) => ({ ...prev, metric, unit: getMetricUnitSafe(metric) }));
                            }}
                            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                        >
                            {METRICS.map((metric) => (
                                <option key={metric} value={metric}>{getMetricLabelSafe(metric)}</option>
                            ))}
                        </select>

                        <Input
                            type="number"
                            step="0.01"
                            value={draft.value}
                            onChange={(event) => setDraft((prev) => ({ ...prev, value: Number(event.target.value) }))}
                            className="h-9"
                            placeholder="Value"
                        />

                        <Input
                            type="datetime-local"
                            value={toDatetimeLocalValue(draft.recordedAt)}
                            onChange={(event) => setDraft((prev) => ({ ...prev, recordedAt: fromDatetimeLocalValue(event.target.value) }))}
                            className="h-9"
                        />

                        <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} disabled={creating}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5">
                                {creating ? 'Saving...' : 'Create'}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full min-w-210 text-[12px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                <th className="px-4 py-2.5 text-left">
                                    <input
                                        type="checkbox"
                                        checked={allPageSelected}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            setSelectedIds((prev) => {
                                                const next = new Set(prev);
                                                if (checked) {
                                                    paginated.forEach((row) => next.add(row.id));
                                                } else {
                                                    paginated.forEach((row) => next.delete(row.id));
                                                }
                                                return next;
                                            });
                                        }}
                                    />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Level
                                    <SortBtn col="level" active={sortKey === 'level'} dir={sortDir} onClick={() => handleSort('level')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Metric
                                    <SortBtn col="metric" active={sortKey === 'metric'} dir={sortDir} onClick={() => handleSort('metric')} />
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Value
                                    <SortBtn col="value" active={sortKey === 'value'} dir={sortDir} onClick={() => handleSort('value')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Assessment
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Recorded
                                    <SortBtn col="recordedAt" active={sortKey === 'recordedAt'} dir={sortDir} onClick={() => handleSort('recordedAt')} />
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-[13px] text-muted-foreground">Loading readings...</td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-[13px] text-muted-foreground">No records found.</td>
                                </tr>
                            ) : (
                                paginated.map((row) => {
                                    const level = LEVEL_CFG[row.level];
                                    const LevelIcon = level.icon;
                                    const isEditing = editingId === row.id;

                                    if (isEditing) {
                                        return (
                                            <EditableRow
                                                key={row.id}
                                                row={row}
                                                saving={savingId === row.id}
                                                onCancel={() => setEditingId(null)}
                                                onSave={(next) => handleUpdate(row.id, next)}
                                                selected={selectedIds.has(row.id)}
                                                onToggleSelect={(checked) => {
                                                    setSelectedIds((prev) => {
                                                        const next = new Set(prev);
                                                        if (checked) next.add(row.id);
                                                        else next.delete(row.id);
                                                        return next;
                                                    });
                                                }}
                                            />
                                        );
                                    }

                                    return (
                                        <tr key={row.id} className="transition-colors hover:bg-muted/20">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(row.id)}
                                                    onChange={(event) => {
                                                        const checked = event.target.checked;
                                                        setSelectedIds((prev) => {
                                                            const next = new Set(prev);
                                                            if (checked) next.add(row.id);
                                                            else next.delete(row.id);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${level.pill}`}>
                                                    <LevelIcon className="h-3 w-3" />
                                                    {level.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[12px] text-foreground">{getMetricLabelSafe(row.metric)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-medium text-foreground">{row.value.toFixed(2)} {row.unit}</td>
                                            <td className="px-4 py-3 text-foreground">{row.assessment}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-mono text-[11px] text-foreground">{formatDateTime(row.recordedAt)}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(row.id)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={() => setRowDeleteTarget(row)}
                                                        className="text-destructive hover:text-destructive"
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
                        <span>{sorted.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, sorted.length)}`} of {sorted.length}</span>
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

            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete selected readings?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove {selectedIds.size} selected reading entries.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete}>Delete selected</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={Boolean(rowDeleteTarget)} onOpenChange={(open) => !open && setRowDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete reading?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the selected reading record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => rowDeleteTarget && handleDelete(rowDeleteTarget.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}

function EditableRow({
    row,
    selected,
    onToggleSelect,
    onCancel,
    onSave,
    saving,
}: {
    row: TableRow;
    selected: boolean;
    onToggleSelect: (checked: boolean) => void;
    onCancel: () => void;
    onSave: (next: Omit<ReadingRecord, 'id'>) => void;
    saving: boolean;
}) {
    const [metric, setMetric] = useState<ReadingMetric>(row.metric);
    const [value, setValue] = useState<number>(row.value);
    const [unit, setUnit] = useState<string>(row.unit || getMetricUnitSafe(row.metric));
    const [recordedAt, setRecordedAt] = useState<string>(toDatetimeLocalValue(row.recordedAt));

    return (
        <tr className="bg-muted/20">
            <td className="px-4 py-3">
                <input type="checkbox" checked={selected} onChange={(event) => onToggleSelect(event.target.checked)} />
            </td>
            <td className="px-4 py-3" colSpan={2}>
                <select
                    value={metric}
                    onChange={(event) => {
                        const nextMetric = event.target.value as ReadingMetric;
                        setMetric(nextMetric);
                        setUnit(getMetricUnitSafe(nextMetric));
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                    {METRICS.map((option) => (
                        <option key={option} value={option}>{getMetricLabelSafe(option)}</option>
                    ))}
                </select>
            </td>
            <td className="px-4 py-3">
                <Input type="number" step="0.01" value={value} onChange={(event) => setValue(Number(event.target.value))} className="h-9" />
            </td>
            <td className="px-4 py-3">
                <Input value={unit} onChange={(event) => setUnit(event.target.value)} className="h-9" />
            </td>
            <td className="px-4 py-3">
                <Input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} className="h-9" />
            </td>
            <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={onCancel} disabled={saving}>
                        <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        size="icon-sm"
                        onClick={() => onSave({ metric, value, unit, recordedAt: fromDatetimeLocalValue(recordedAt) })}
                        disabled={saving}
                    >
                        {saving ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                </div>
            </td>
        </tr>
    );
}
