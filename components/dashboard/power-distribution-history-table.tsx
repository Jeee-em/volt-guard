'use client';

import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Search,
    X,
    Filter,
    Loader2,
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
import { cn } from '@/lib/utils';
import type { Remarks } from '@/hooks/use-power-loss';
import type { PowerDistributionRecord } from '@/hooks/use-power-distribution-history';

// ─── Config ───────────────────────────────────────────────────────────────────

const REMARKS_CFG: Record<Remarks, { icon: React.ElementType; label: string; pill: string; dot: string }> = {
    normal: {
        icon: CheckCircle2,
        label: 'Normal',
        pill: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
        dot: 'bg-emerald-500',
    },
    unstable: {
        icon: AlertTriangle,
        label: 'Unstable',
        pill: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
        dot: 'bg-amber-500',
    },
    pilferage: {
        icon: ShieldAlert,
        label: 'Pilferage',
        pill: 'bg-destructive/10 text-destructive border border-destructive/30',
        dot: 'bg-destructive',
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TableRow = PowerDistributionRecord & {
    searchText: string;
};

function downloadCSV(rows: TableRow[], filename = 'power-distribution-history.csv') {
    // 1. Update headers to only include the three you want
    const headers = ['time', 'deviation', 'remarks'];

    // 2. Map only the corresponding fields from the row
    const records = rows.map((r) => [
        `"${r.time}"`,
        r.deviation,
        `"${r.remarks}"`,
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

type SortKey = 'timestamp' | 'deviation' | 'remarks';

function SortBtn({ col, active, dir, onClick }: { col: SortKey; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
    const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
    return (
        <button onClick={onClick} className="ml-1 inline-flex opacity-50 hover:opacity-100">
            <Icon className="h-3 w-3" />
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50];

interface PowerDistributionHistoryTableProps {
    records: PowerDistributionRecord[];
    loading: boolean;
    pageSize?: number;
}

export function PowerDistributionHistoryTable({
    records,
    loading,
    pageSize: defaultPageSize = 10,
}: PowerDistributionHistoryTableProps) {
    const [search, setSearch] = useState('');
    const [remarksFilter, setRemarksFilter] = useState<Remarks | 'all'>('all');
    const [sortKey, setSortKey] = useState<SortKey>('timestamp');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);
    const deferredSearch = useDeferredValue(search);

    const rows = useMemo<TableRow[]>(() => {
        return records.map((record) => ({
            ...record,
            searchText: [
                record.time,
                String(record.deviation),
                record.remarks,
            ].join(' ').toLowerCase(),
        }));
    }, [records]);

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
        const query = deferredSearch.trim().toLowerCase();
        return rows.filter((r) => {
            if (remarksFilter !== 'all' && r.remarks !== remarksFilter) return false;
            if (query && !r.searchText.includes(query)) return false;
            return true;
        });
    }, [rows, remarksFilter, deferredSearch]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let av: string | number;
            let bv: string | number;

            if (sortKey === 'timestamp') {
                av = a.timestamp;
                bv = b.timestamp;
            } else if (sortKey === 'deviation') {
                av = Math.abs(a.deviation);
                bv = Math.abs(b.deviation);
            } else {
                const order: Record<Remarks, number> = { pilferage: 0, unstable: 1, normal: 2 };
                av = order[a.remarks];
                bv = order[b.remarks];
            }

            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            return 0;
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    const hasFilters = remarksFilter !== 'all' || search;

    const clearFilters = () => {
        setRemarksFilter('all');
        setSearch('');
        setPage(1);
    };

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    History
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                        {loading ? 'Loading...' : `${records.length} records`}
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
                            placeholder="Search time, deviation, remarks…"
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
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px] capitalize">
                                    {remarksFilter === 'all' ? 'Remarks' : remarksFilter}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Filter by Remarks</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setRemarksFilter('all'); setPage(1); }}>All</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRemarksFilter('pilferage'); setPage(1); }}>Pilferage</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRemarksFilter('unstable'); setPage(1); }}>Unstable</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRemarksFilter('normal'); setPage(1); }}>Normal</DropdownMenuItem>
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
                        disabled={records.length === 0}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-190 text-[12px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Time
                                    <SortBtn col="timestamp" active={sortKey === 'timestamp'} dir={sortDir} onClick={() => handleSort('timestamp')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Deviation
                                    <SortBtn col="deviation" active={sortKey === 'deviation'} dir={sortDir} onClick={() => handleSort('deviation')} />
                                </th>
                                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Remarks
                                    <SortBtn col="remarks" active={sortKey === 'remarks'} dir={sortDir} onClick={() => handleSort('remarks')} />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-[13px] text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading history...
                                        </div>
                                    </td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-[13px] text-muted-foreground">
                                        {hasFilters ? 'No records match the current filters.' : 'No distribution records yet.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((r) => {
                                    const rCfg = REMARKS_CFG[r.remarks];
                                    const RemarkIcon = rCfg.icon;
                                    return (
                                        <tr key={r.time} className="transition-colors hover:bg-muted/20">
                                            <td className="px-4 py-3">
                                                <p className="font-mono text-[12px] text-foreground">
                                                    {r.time}
                                                </p>
                                            </td>

                                            <td className="px-4 py-3 ">
                                                <span className="font-mono font-medium text-foreground">
                                                    {Math.abs(r.deviation).toFixed(2)}
                                                </span>
                                                <span className="ml-1 text-[11px] text-muted-foreground">W</span>
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium', rCfg.pill)}>
                                                    <RemarkIcon className="h-3 w-3" />
                                                    {rCfg.label}
                                                </span>
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

                        <span className="px-2 text-[12px] text-muted-foreground">
                            Page {safePage} of {totalPages}
                        </span>

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