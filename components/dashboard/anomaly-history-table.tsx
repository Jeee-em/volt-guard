'use client';

import { useState, useMemo, useCallback } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle2,
    Clock,
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus   = 'active' | 'resolved';
export type AlertMetric   = 'voltage' | 'current' | 'power' | 'power_factor';

export interface AnomalyRecord {
    id: string;
    severity: AlertSeverity;
    status: AlertStatus;
    metric: AlertMetric;
    message: string;
    value: number;
    unit: string;
    threshold: number;
    triggeredAt: string;   // ISO
    resolvedAt?: string;   // ISO
    duration?: number;     // seconds; undefined if still active
}

export interface AnomalyHistoryTableProps {
    records: AnomalyRecord[];
    pageSize?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG = {
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
    info: {
        icon: Info,
        label: 'Info',
        pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        dot: 'bg-blue-500',
    },
} as const;

const STATUS_CFG = {
    active: {
        label: 'Active',
        pill: 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
        icon: Clock,
    },
    resolved: {
        label: 'Resolved',
        pill: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800',
        icon: CheckCircle2,
    },
} as const;

const METRIC_LABELS: Record<AlertMetric, string> = {
    voltage: 'Voltage',
    current: 'Current',
    power: 'Power',
    power_factor: 'Power Factor',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

function formatDuration(seconds?: number): string {
    if (seconds == null) return '—';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function downloadCSV(records: AnomalyRecord[], filename = 'anomaly-history.csv') {
    const headers = ['id', 'severity', 'status', 'metric', 'message', 'value', 'unit', 'threshold', 'triggeredAt', 'resolvedAt', 'duration'];
    const rows = records.map((r) => [
        r.id, r.severity, r.status, r.metric,
        `"${r.message}"`, r.value, r.unit, r.threshold,
        r.triggeredAt, r.resolvedAt ?? '', r.duration ?? '',
    ].join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ─── Sort button ──────────────────────────────────────────────────────────────

type SortKey = 'triggeredAt' | 'severity' | 'metric' | 'value' | 'duration' | 'status';
type SortDir = 'asc' | 'desc';

function SortBtn({
    col, active, dir, onClick,
}: { col: SortKey; active: boolean; dir: SortDir; onClick: () => void }) {
    const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
    return (
        <button onClick={onClick} className="ml-1 inline-flex opacity-50 hover:opacity-100">
            <Icon className="h-3 w-3" />
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50];

export function AnomalyHistoryTable({
    records,
    pageSize: defaultPageSize = 10,
}: AnomalyHistoryTableProps) {
    const [search, setSearch] = useState('');
    const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
    const [statusFilter, setStatusFilter]     = useState<AlertStatus | 'all'>('all');
    const [metricFilter, setMetricFilter]     = useState<AlertMetric | 'all'>('all');
    const [sortKey, setSortKey]   = useState<SortKey>('triggeredAt');
    const [sortDir, setSortDir]   = useState<SortDir>('desc');
    const [page, setPage]         = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const handleSort = useCallback((col: SortKey) => {
        setSortKey((prev) => {
            if (prev === col) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); return col; }
            setSortDir('desc');
            return col;
        });
        setPage(1);
    }, []);

    // Filter
    const filtered = useMemo(() => {
        return records.filter((r) => {
            if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
            if (statusFilter   !== 'all' && r.status   !== statusFilter)   return false;
            if (metricFilter   !== 'all' && r.metric   !== metricFilter)   return false;
            if (search) {
                const q = search.toLowerCase();
                if (
                    !r.message.toLowerCase().includes(q) &&
                    !METRIC_LABELS[r.metric].toLowerCase().includes(q) &&
                    !r.severity.includes(q) &&
                    !r.status.includes(q)
                ) return false;
            }
            return true;
        });
    }, [records, severityFilter, statusFilter, metricFilter, search]);

    // Sort
    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let av: any, bv: any;
            if (sortKey === 'triggeredAt') { av = new Date(a.triggeredAt).getTime(); bv = new Date(b.triggeredAt).getTime(); }
            else if (sortKey === 'severity') { const order = { critical: 0, warning: 1, info: 2 }; av = order[a.severity]; bv = order[b.severity]; }
            else if (sortKey === 'metric')   { av = a.metric; bv = b.metric; }
            else if (sortKey === 'value')    { av = a.value; bv = b.value; }
            else if (sortKey === 'duration') { av = a.duration ?? Infinity; bv = b.duration ?? Infinity; }
            else if (sortKey === 'status')   { av = a.status; bv = b.status; }
            return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
    }, [filtered, sortKey, sortDir]);

    // Paginate
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage   = Math.min(page, totalPages);
    const paginated  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    const hasFilters = severityFilter !== 'all' || statusFilter !== 'all' || metricFilter !== 'all' || search;

    const clearFilters = () => {
        setSeverityFilter('all'); setStatusFilter('all');
        setMetricFilter('all');   setSearch('');
        setPage(1);
    };

    const activeCount   = records.filter((r) => r.status === 'active').length;
    const criticalCount = records.filter((r) => r.severity === 'critical' && r.status === 'active').length;

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Anomaly History
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2">
                    {criticalCount > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                            {criticalCount} critical
                        </span>
                    )}
                    {activeCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            {activeCount} active
                        </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                        {records.length} total
                    </span>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    {/* Search */}
                    <div className="relative min-w-[180px] flex-1">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search alerts…"
                            className="h-8 border-border pl-8 text-[12px] shadow-none"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-1.5">
                        <Filter className="h-3 w-3 text-muted-foreground" />

                        {/* Severity filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {severityFilter === 'all' ? 'Severity' : SEVERITY_CFG[severityFilter].label}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Severity</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setSeverityFilter('all'); setPage(1); }}>All</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSeverityFilter('critical'); setPage(1); }}>Critical</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSeverityFilter('warning'); setPage(1); }}>Warning</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSeverityFilter('info'); setPage(1); }}>Info</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Status filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {statusFilter === 'all' ? 'Status' : STATUS_CFG[statusFilter].label}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setStatusFilter('all'); setPage(1); }}>All</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setStatusFilter('active'); setPage(1); }}>Active</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setStatusFilter('resolved'); setPage(1); }}>Resolved</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Metric filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {metricFilter === 'all' ? 'Metric' : METRIC_LABELS[metricFilter]}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Metric</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setMetricFilter('all'); setPage(1); }}>All</DropdownMenuItem>
                                {(Object.keys(METRIC_LABELS) as AlertMetric[]).map((k) => (
                                    <DropdownMenuItem key={k} onClick={() => { setMetricFilter(k); setPage(1); }}>
                                        {METRIC_LABELS[k]}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Clear filters */}
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

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Export */}
                    <button
                        onClick={() => downloadCSV(sorted)}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </button>
                </div>

                {/* ── Table ── */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-[12px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Severity
                                    <SortBtn col="severity" active={sortKey === 'severity'} dir={sortDir} onClick={() => handleSort('severity')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Metric
                                    <SortBtn col="metric" active={sortKey === 'metric'} dir={sortDir} onClick={() => handleSort('metric')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Message
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Value
                                    <SortBtn col="value" active={sortKey === 'value'} dir={sortDir} onClick={() => handleSort('value')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Triggered
                                    <SortBtn col="triggeredAt" active={sortKey === 'triggeredAt'} dir={sortDir} onClick={() => handleSort('triggeredAt')} />
                                </th>
                                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Duration
                                    <SortBtn col="duration" active={sortKey === 'duration'} dir={sortDir} onClick={() => handleSort('duration')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Status
                                    <SortBtn col="status" active={sortKey === 'status'} dir={sortDir} onClick={() => handleSort('status')} />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-[13px] text-muted-foreground">
                                        {hasFilters ? 'No anomalies match the current filters.' : 'No anomaly records yet.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((r) => {
                                    const sev = SEVERITY_CFG[r.severity];
                                    const SevIcon = sev.icon;
                                    const st = STATUS_CFG[r.status];
                                    const StIcon = st.icon;
                                    return (
                                        <tr key={r.id} className="transition-colors hover:bg-muted/20">
                                            {/* Severity */}
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${sev.pill}`}>
                                                    <SevIcon className="h-3 w-3" />
                                                    {sev.label}
                                                </span>
                                            </td>

                                            {/* Metric */}
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-[12px] text-foreground">
                                                    {METRIC_LABELS[r.metric]}
                                                </span>
                                            </td>

                                            {/* Message */}
                                            <td className="max-w-[240px] px-4 py-3">
                                                <p className="truncate text-foreground">{r.message}</p>
                                                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                                    Threshold: {r.threshold} {r.unit}
                                                </p>
                                            </td>

                                            {/* Value */}
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-mono font-medium text-foreground">
                                                    {r.value.toFixed(2)}
                                                </span>
                                                <span className="ml-1 text-[11px] text-muted-foreground">{r.unit}</span>
                                            </td>

                                            {/* Triggered */}
                                            <td className="px-4 py-3">
                                                <p className="font-mono text-[11px] text-foreground">
                                                    {formatDateTime(r.triggeredAt)}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {timeAgo(r.triggeredAt)}
                                                </p>
                                            </td>

                                            {/* Duration */}
                                            <td className="px-4 py-3 text-right font-mono text-[12px] text-foreground">
                                                {r.status === 'active' ? (
                                                    <span className="text-amber-600 dark:text-amber-400">Ongoing</span>
                                                ) : (
                                                    formatDuration(r.duration)
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.pill}`}>
                                                    <StIcon className="h-3 w-3" />
                                                    {st.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
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

                        {/* Page number pills */}
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
                                        className={`min-w-[28px] rounded px-2 py-1 text-[12px] transition-colors ${
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