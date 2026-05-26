'use client';

import { useState, useMemo, useCallback } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    MinusCircle,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Search,
    X,
    Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReadingLevel = 'critical' | 'warning' | 'normal' | 'no-signal';
export type ReadingMetric = ThresholdMetricKey | 'power_factor';

export interface ReadingRecord {
    id: string;
    metric: ReadingMetric;
    value: number;
    unit?: string;
    recordedAt: string;   // ISO
}

export interface ReadingsTableProps {
    records: ReadingRecord[];
    thresholds?: ThresholdConfig;
    pageSize?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LEVEL_CFG: Record<ReadingLevel, { icon: React.ElementType; label: string; pill: string; dot: string }> = {
    critical: {
        icon: AlertCircle,
        label: 'Critical',
        pill: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        dot: 'bg-red-500',
    },
    warning: {
        icon: AlertTriangle,
        label: 'Warning',
        pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        dot: 'bg-amber-500',
    },
    normal: {
        icon: CheckCircle2,
        label: 'Normal',
        pill: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
        dot: 'bg-green-500',
    },
    'no-signal': {
        icon: MinusCircle,
        label: 'No Signal',
        pill: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
        dot: 'bg-slate-400',
    },
};

const METRIC_FALLBACK = {
    power_factor: { label: 'Power Factor', unit: 'pf' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMetricLabelSafe(metric: ReadingMetric): string {
    if (isThresholdMetricKey(metric)) return getMetricLabel(metric);
    return METRIC_FALLBACK[metric]?.label ?? metric;
}

function getMetricUnitSafe(metric: ReadingMetric): string {
    if (isThresholdMetricKey(metric)) return getMetricUnit(metric);
    return METRIC_FALLBACK[metric]?.unit ?? '';
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

function formatSearchDate(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return [
        d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        d.toLocaleDateString('en-US'),
        formatDateTime(iso),
    ].join(' ');
}

function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function formatThresholds(threshold: SignalThreshold | null, unit: string): string {
    if (!threshold) return '—';
    return `${threshold.warning} / ${threshold.critical} ${unit}`;
}

type TableRow = ReadingRecord & {
    level: ReadingLevel;
    assessment: string;
    threshold: SignalThreshold | null;
    unit: string;
};

function downloadCSV(rows: TableRow[], filename = 'readings.csv') {
    const headers = ['id', 'level', 'metric', 'value', 'unit', 'warningThreshold', 'criticalThreshold', 'recordedAt', 'assessment'];
    const records = rows.map((r) => [
        r.id,
        r.level,
        r.metric,
        r.value,
        r.unit,
        r.threshold?.warning ?? '',
        r.threshold?.critical ?? '',
        r.recordedAt,
        `"${r.assessment}"`,
    ].join(','));
    const blob = new Blob([[headers.join(','), ...records].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Sort button ──────────────────────────────────────────────────────────────

type SortKey = 'recordedAt' | 'level' | 'metric' | 'value';

function SortBtn({
    col, active, dir, onClick,
}: { col: SortKey; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
    const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
    return (
        <button onClick={onClick} className="ml-1 inline-flex opacity-50 hover:opacity-100">
            <Icon className="h-3 w-3" />
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50];

export function ReadingsTable({
    records,
    thresholds,
    pageSize: defaultPageSize = 10,
}: ReadingsTableProps) {
    const [search, setSearch] = useState('');
    const [levelFilter, setLevelFilter] = useState<ReadingLevel | 'all'>('all');
    const [metricFilter, setMetricFilter] = useState<ReadingMetric | 'all'>('all');
    const [sortKey, setSortKey] = useState<SortKey>('recordedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

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

    const metricOptions = useMemo<ReadingMetric[]>(() => {
        const unique = new Set<ReadingMetric>();
        rows.forEach((row) => unique.add(row.metric));
        return Array.from(unique);
    }, [rows]);

    const handleSort = useCallback((col: SortKey) => {
        setSortKey((prev) => {
            if (prev === col) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                return col;
            }
            setSortDir('desc');
            return col;
        });
        setPage(1);
    }, []);

    const filtered = useMemo(() => {
        return rows.filter((r) => {
            if (levelFilter !== 'all' && r.level !== levelFilter) return false;
            if (metricFilter !== 'all' && r.metric !== metricFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                const haystack = [
                    r.assessment,
                    getMetricLabelSafe(r.metric),
                    r.level,
                    r.unit,
                    String(r.value),
                    r.recordedAt,
                    formatSearchDate(r.recordedAt),
                ].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [rows, levelFilter, metricFilter, search]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let av: any, bv: any;
            if (sortKey === 'recordedAt') {
                av = new Date(a.recordedAt).getTime();
                bv = new Date(b.recordedAt).getTime();
            } else if (sortKey === 'level') {
                const order = { critical: 0, warning: 1, 'no-signal': 2, normal: 3 };
                av = order[a.level];
                bv = order[b.level];
            } else if (sortKey === 'metric') {
                av = getMetricLabelSafe(a.metric);
                bv = getMetricLabelSafe(b.metric);
            } else if (sortKey === 'value') {
                av = a.value;
                bv = b.value;
            }
            return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    const hasFilters = levelFilter !== 'all' || metricFilter !== 'all' || search;

    const clearFilters = () => {
        setLevelFilter('all');
        setMetricFilter('all');
        setSearch('');
        setPage(1);
    };

    const criticalCount = rows.filter((r) => r.level === 'critical').length;
    const warningCount = rows.filter((r) => r.level === 'warning').length;
    const noSignalCount = rows.filter((r) => r.level === 'no-signal').length;

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Readings Table
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2">
                    {criticalCount > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                            {criticalCount} critical
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            {warningCount} warning
                        </span>
                    )}
                    {noSignalCount > 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            {noSignalCount} no signal
                        </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                        {records.length} total
                    </span>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    <div className="relative min-w-45 flex-1">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search readings…"
                            className="h-8 border-border pl-8 text-[12px] shadow-none"
                        />
                        {search && (
                            <button
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
                                <DropdownMenuItem onClick={() => { setLevelFilter('all'); setPage(1); }}>All</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setLevelFilter('critical'); setPage(1); }}>Critical</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setLevelFilter('warning'); setPage(1); }}>Warning</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setLevelFilter('no-signal'); setPage(1); }}>No Signal</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setLevelFilter('normal'); setPage(1); }}>Normal</DropdownMenuItem>
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
                                <DropdownMenuItem onClick={() => { setMetricFilter('all'); setPage(1); }}>All</DropdownMenuItem>
                                {(metricOptions.length > 0
                                    ? metricOptions
                                    : (['voltage', 'current', 'power', 'power_loss', 'power_factor'] as ReadingMetric[])
                                ).map((k) => (
                                    <DropdownMenuItem key={k} onClick={() => { setMetricFilter(k); setPage(1); }}>
                                        {getMetricLabelSafe(k)}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="flex-1" />

                    <button
                        onClick={() => downloadCSV(sorted)}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-190 text-[12px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Level
                                    <SortBtn col="level" active={sortKey === 'level'} dir={sortDir} onClick={() => handleSort('level')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Metric
                                    <SortBtn col="metric" active={sortKey === 'metric'} dir={sortDir} onClick={() => handleSort('metric')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Assessment
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Value
                                    <SortBtn col="value" active={sortKey === 'value'} dir={sortDir} onClick={() => handleSort('value')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Thresholds
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Recorded
                                    <SortBtn col="recordedAt" active={sortKey === 'recordedAt'} dir={sortDir} onClick={() => handleSort('recordedAt')} />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-[13px] text-muted-foreground">
                                        {hasFilters ? 'No readings match the current filters.' : 'No readings yet.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((r) => {
                                    const lvl = LEVEL_CFG[r.level];
                                    const LevelIcon = lvl.icon;
                                    const metricLabel = getMetricLabelSafe(r.metric);
                                    return (
                                        <tr key={r.id} className="transition-colors hover:bg-muted/20">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${lvl.pill}`}>
                                                    <LevelIcon className="h-3 w-3" />
                                                    {lvl.label}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className="font-mono text-[12px] text-foreground">{metricLabel}</span>
                                            </td>

                                            <td className="max-w-65 px-4 py-3">
                                                <p className="truncate text-foreground">{r.assessment}</p>
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <span className="font-mono font-medium text-foreground">
                                                    {r.value.toFixed(2)}
                                                </span>
                                                <span className="ml-1 text-[11px] text-muted-foreground">{r.unit}</span>
                                            </td>

                                            <td className="px-4 py-3">
                                                <p className="font-mono text-[11px] text-foreground">
                                                    {formatThresholds(r.threshold, r.unit)}
                                                </p>
                                                {r.threshold && (
                                                    <p className="text-[10px] text-muted-foreground">Warning / Critical</p>
                                                )}
                                            </td>

                                            <td className="px-4 py-3">
                                                <p className="font-mono text-[11px] text-foreground">
                                                    {formatDateTime(r.recordedAt)}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {timeAgo(r.recordedAt)}
                                                </p>
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
                                {PAGE_SIZES.map((s) => (
                                    <DropdownMenuItem key={s} onClick={() => { setPageSize(s); setPage(1); }}>
                                        {s}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <span>
                            {sorted.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)}`} of {sorted.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                            .reduce<(number | '...')[]>((acc, p, i, arr) => {
                                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, i) =>
                                p === '...' ? (
                                    <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-muted-foreground">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p as number)}
                                        className={`min-w-7 rounded px-2 py-1 text-[12px] transition-colors ${
                                            safePage === p
                                                ? 'bg-foreground text-background font-medium'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}

                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
