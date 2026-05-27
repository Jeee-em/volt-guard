'use client';

import { useState, useMemo, useCallback } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle2,
    Trash2,
    ChevronDown,
    ChevronRight,
    Search,
    X,
    Filter,
    ExternalLink,
    Bell,
    BellOff,
    MailOpen,
    Zap,
    Activity,
    Gauge,
    PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationSeverity = 'critical' | 'warning' | 'info';
export type NotificationMetric   = 'voltage' | 'current' | 'power' | 'power_loss' | 'power_factor';
export type NotificationStatus   = 'unread' | 'read';

export interface NotificationItem {
    id: string;
    severity: NotificationSeverity;
    status: NotificationStatus;
    metric: NotificationMetric;
    /** Short title shown in the feed row */
    title: string;
    /** Full description shown in the inline detail */
    description: string;
    /** Measured value that triggered the alert */
    value: number;
    unit: string;
    /** The threshold that was breached */
    threshold: number;
    /** Name of the rule that triggered this */
    ruleName: string;
    /** Optional rule id for dedupe/persistence */
    ruleId?: string;
    /** ISO timestamp */
    receivedAt: string;
    /** Deep-link to analytics page at this timestamp */
    analyticsHref: string;
}

type FilterSeverity = NotificationSeverity | 'all';
type FilterStatus   = NotificationStatus   | 'all';
type FilterMetric   = NotificationMetric   | 'all';

interface DayGroup {
    label: string;       // "Today", "Yesterday", "Apr 20", etc.
    date: string;        // YYYY-MM-DD key
    items: NotificationItem[];
}

export interface NotificationFeedProps {
    notifications: NotificationItem[];
    onMarkRead:    (id: string)    => void | Promise<void>;
    onMarkAllRead: ()              => void | Promise<void>;
    onDismiss:     (id: string)    => void | Promise<void>;
    loading?: boolean;
    loadingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void | Promise<void>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG = {
    critical: {
        icon:      AlertCircle,
        pill:      'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        iconClass: 'text-red-500',
        rowClass:  'border-l-red-500',
        dotClass:  'bg-red-500',
    },
    warning: {
        icon:      AlertTriangle,
        pill:      'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        iconClass: 'text-amber-500',
        rowClass:  'border-l-amber-500',
        dotClass:  'bg-amber-500',
    },
    info: {
        icon:      Info,
        pill:      'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        iconClass: 'text-blue-500',
        rowClass:  'border-l-blue-500',
        dotClass:  'bg-blue-500',
    },
} as const satisfies Record<NotificationSeverity, {
    icon:      React.ElementType;
    pill:      string;
    iconClass: string;
    rowClass:  string;
    dotClass:  string;
}>;

const METRIC_CFG = {
    voltage:      { label: 'Voltage',      icon: Zap,      unit: 'V'  },
    current:      { label: 'Current',      icon: Activity, unit: 'A'  },
    power:        { label: 'Power',        icon: Gauge,    unit: 'W'  },
    power_loss:   { label: 'Power Loss',   icon: AlertTriangle, unit: 'W'  },
    power_factor: { label: 'Power Factor', icon: PenLine,  unit: 'pf' },
} as const satisfies Record<NotificationMetric, {
    label: string;
    icon:  React.ElementType;
    unit:  string;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
    return iso.slice(0, 10); // YYYY-MM-DD
}

function toDayLabel(dateKey: string): string {
    const today     = toDateKey(new Date().toISOString());
    const yesterday = toDateKey(new Date(Date.now() - 86_400_000).toISOString());
    if (dateKey === today)     return 'Today';
    if (dateKey === yesterday) return 'Yesterday';
    return new Date(dateKey).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
    });
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3_600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86_400)return `${Math.floor(diff / 3_600)}h ago`;
    return `${Math.floor(diff / 86_400)}d ago`;
}

function groupByDay(items: NotificationItem[]): DayGroup[] {
    const map = new Map<string, NotificationItem[]>();
    for (const item of items) {
        const key = toDateKey(item.receivedAt);
        const bucket = map.get(key);
        if (bucket) bucket.push(item);
        else map.set(key, [item]);
    }
    return Array.from(map.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayItems]) => ({
            label: toDayLabel(date),
            date,
            items: dayItems.sort(
                (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
            ),
        }));
}

// ─── Inline detail panel ──────────────────────────────────────────────────────

interface DetailPanelProps {
    item:     NotificationItem;
    onClose:  () => void;
    onMarkRead: () => void;
    onRequestDelete:  () => void;
}

function DetailPanel({ item, onClose, onMarkRead, onRequestDelete }: DetailPanelProps) {
    const cfg        = SEVERITY_CFG[item.severity];
    const SevIcon    = cfg.icon;
    const MetricIcon = METRIC_CFG[item.metric].icon;

    return (
        <div className="border-t border-border bg-muted/20 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <SevIcon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconClass}`} />
                    <div>
                        <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                            {item.description}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Stats grid */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                    [
                        { label: 'Metric',    value: METRIC_CFG[item.metric].label, mono: false },
                        { label: 'Value',     value: `${item.value.toFixed(2)} ${item.unit}`, mono: true },
                        { label: 'Threshold', value: `${item.threshold} ${item.unit}`,        mono: true },
                        { label: 'Rule',      value: item.ruleName,                           mono: false },
                    ] as const
                ).map(({ label, value, mono }) => (
                    <div key={label} className="rounded-lg border border-border bg-background px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                            {label}
                        </p>
                        <p className={`mt-0.5 truncate text-[12px] font-medium text-foreground ${mono ? 'font-mono' : ''}`}>
                            {value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Footer actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                    href={item.analyticsHref}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View in analytics
                </a>
                {item.status === 'unread' && (
                    <button
                        onClick={onMarkRead}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <MailOpen className="h-3.5 w-3.5" />
                        Mark as read
                    </button>
                )}
                <button
                    onClick={onRequestDelete}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                </button>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {formatTime(item.receivedAt)} · {timeAgo(item.receivedAt)}
                </span>
            </div>
        </div>
    );
}

// ─── Single notification row ──────────────────────────────────────────────────

interface NotificationRowProps {
    item:        NotificationItem;
    isExpanded:  boolean;
    onExpand:    () => void;
    onCollapse:  () => void;
    onMarkRead:  () => void;
    onRequestDelete:   () => void;
}

function NotificationRow({
    item,
    isExpanded,
    onExpand,
    onCollapse,
    onMarkRead,
    onRequestDelete,
}: NotificationRowProps) {
    const cfg     = SEVERITY_CFG[item.severity];
    const SevIcon = cfg.icon;
    const isUnread = item.status === 'unread';

    const handleClick = useCallback(() => {
        if (isExpanded) {
            onCollapse();
        } else {
            onExpand();
            if (isUnread) onMarkRead();
        }
    }, [isExpanded, onExpand, onCollapse, isUnread, onMarkRead]);

    return (
        <li className={`border-l-2 ${cfg.rowClass} ${!isUnread ? 'opacity-60' : ''}`}>
            <div className="flex items-start">
                <button
                    onClick={handleClick}
                    className="flex w-full flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                >
                {/* Unread dot */}
                <span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {isUnread ? (
                        <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
                    ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                </span>

                {/* Icon */}
                <SevIcon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconClass}`} />

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className={`truncate text-[13px] ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                            {item.title}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.pill}`}>
                            {item.severity}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {METRIC_CFG[item.metric].label} · {item.value.toFixed(2)} {item.unit}
                    </p>
                </div>

                {/* Time + chevron */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted-foreground">{timeAgo(item.receivedAt)}</span>
                    {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                </div>
                </button>

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRequestDelete();
                    }}
                    className="mt-2.5 mr-3 flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Delete notification"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Inline detail */}
            {isExpanded && (
                <DetailPanel
                    item={item}
                    onClose={onCollapse}
                    onMarkRead={onMarkRead}
                    onRequestDelete={onRequestDelete}
                />
            )}
        </li>
    );
}

// ─── Day group ────────────────────────────────────────────────────────────────

interface DayGroupSectionProps {
    group:      DayGroup;
    expandedId: string | null;
    onExpand:   (id: string) => void;
    onCollapse: ()           => void;
    onMarkRead: (id: string) => void;
    onRequestDelete:  (item: NotificationItem) => void;
}

function DayGroupSection({
    group,
    expandedId,
    onExpand,
    onCollapse,
    onMarkRead,
    onRequestDelete,
}: DayGroupSectionProps) {
    const unreadCount = group.items.filter((i) => i.status === 'unread').length;

    return (
        <div>
            {/* Day label */}
            <div className="flex items-center gap-3 bg-muted/30 px-4 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                </span>
                {unreadCount > 0 && (
                    <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
                        {unreadCount}
                    </span>
                )}
                <div className="h-px flex-1 bg-border" />
            </div>

            <ul className="divide-y divide-border">
                {group.items.map((item) => (
                    <NotificationRow
                        key={item.id}
                        item={item}
                        isExpanded={expandedId === item.id}
                        onExpand={() => onExpand(item.id)}
                        onCollapse={onCollapse}
                        onMarkRead={() => onMarkRead(item.id)}
                        onRequestDelete={() => onRequestDelete(item)}
                    />
                ))}
            </ul>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationFeed({
    notifications,
    onMarkRead,
    onMarkAllRead,
    onDismiss,
    loading = false,
    loadingMore = false,
    hasMore = false,
    onLoadMore,
}: NotificationFeedProps) {
    const [expandedId,      setExpandedId]      = useState<string | null>(null);
    const [search,          setSearch]           = useState<string>('');
    const [filterSeverity,  setFilterSeverity]   = useState<FilterSeverity>('all');
    const [filterStatus,    setFilterStatus]     = useState<FilterStatus>('all');
    const [filterMetric,    setFilterMetric]     = useState<FilterMetric>('all');
    const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const unreadCount = notifications.filter((n) => n.status === 'unread').length;
    const hasFilters  = filterSeverity !== 'all' || filterStatus !== 'all' || filterMetric !== 'all' || search !== '';

    const clearFilters = useCallback(() => {
        setFilterSeverity('all');
        setFilterStatus('all');
        setFilterMetric('all');
        setSearch('');
    }, []);

    const handleRequestDelete = useCallback((item: NotificationItem) => {
        setDeleteTarget(item);
        setDeleteOpen(true);
    }, []);

    const handleDeleteOpenChange = useCallback((open: boolean) => {
        setDeleteOpen(open);
        if (!open) setDeleteTarget(null);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget) return;
        await onDismiss(deleteTarget.id);
        setDeleteOpen(false);
        setDeleteTarget(null);
    }, [deleteTarget, onDismiss]);

    // Filter
    const filtered = useMemo<NotificationItem[]>(() => {
        return notifications.filter((n) => {
            if (filterSeverity !== 'all' && n.severity !== filterSeverity) return false;
            if (filterStatus   !== 'all' && n.status   !== filterStatus)   return false;
            if (filterMetric   !== 'all' && n.metric   !== filterMetric)   return false;
            if (search) {
                const q = search.toLowerCase();
                const matches =
                    n.title.toLowerCase().includes(q)       ||
                    n.description.toLowerCase().includes(q) ||
                    n.ruleName.toLowerCase().includes(q)    ||
                    METRIC_CFG[n.metric].label.toLowerCase().includes(q);
                if (!matches) return false;
            }
            return true;
        });
    }, [notifications, filterSeverity, filterStatus, filterMetric, search]);

    // Group by day
    const groups = useMemo<DayGroup[]>(() => groupByDay(filtered), [filtered]);

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Notification Feed
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {unreadCount > 0 && (
                        <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                            {unreadCount} unread
                        </span>
                    )}
                    <span>{notifications.length} total</span>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    {/* Search */}
                    <div className="relative min-w-45 flex-1">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search notifications…"
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

                    {/* Filter dropdowns */}
                    <div className="flex items-center gap-1.5">
                        <Filter className="h-3 w-3 text-muted-foreground" />

                        {/* Severity */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {filterSeverity === 'all' ? 'Severity' : filterSeverity}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Severity</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
                                    <DropdownMenuItem key={s} onClick={() => setFilterSeverity(s)} className="capitalize text-[13px]">
                                        {s}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Status */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {filterStatus === 'all' ? 'Status' : filterStatus}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(['all', 'unread', 'read'] as const).map((s) => (
                                    <DropdownMenuItem key={s} onClick={() => setFilterStatus(s)} className="capitalize text-[13px]">
                                        {s}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Metric */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {filterMetric === 'all' ? 'Metric' : METRIC_CFG[filterMetric].label}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Metric</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setFilterMetric('all')} className="text-[13px]">All</DropdownMenuItem>
                                {(Object.keys(METRIC_CFG) as NotificationMetric[]).map((k) => (
                                    <DropdownMenuItem key={k} onClick={() => setFilterMetric(k)} className="text-[13px]">
                                        {METRIC_CFG[k].label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-3 w-3" /> Clear
                            </button>
                        )}
                    </div>

                    <div className="flex-1" />

                    {/* Mark all read */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMarkAllRead}
                        disabled={unreadCount === 0}
                        className="gap-1.5 text-[12px]"
                    >
                        <MailOpen className="h-3.5 w-3.5" />
                        Mark all read
                    </Button>
                </div>

                {/* ── Feed ── */}
                {loading && notifications.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
                        Loading notifications...
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        {hasFilters ? (
                            <>
                                <Bell className="h-8 w-8 text-muted-foreground/30" />
                                <p className="text-[13px] text-muted-foreground">No notifications match the current filters.</p>
                                <button onClick={clearFilters} className="text-[12px] text-foreground underline underline-offset-4">
                                    Clear filters
                                </button>
                            </>
                        ) : (
                            <>
                                <BellOff className="h-8 w-8 text-muted-foreground/30" />
                                <p className="text-[13px] text-muted-foreground">No notifications yet.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {groups.map((group) => (
                            <DayGroupSection
                                key={group.date}
                                group={group}
                                expandedId={expandedId}
                                onExpand={(id) => setExpandedId(id)}
                                onCollapse={() => setExpandedId(null)}
                                onMarkRead={onMarkRead}
                                onRequestDelete={handleRequestDelete}
                            />
                        ))}
                    </div>
                )}

                {/* ── Footer count ── */}
                {groups.length > 0 && (
                    <div className="border-t border-border px-4 py-3 text-center text-[11px] text-muted-foreground">
                        {hasMore && onLoadMore && (
                            <div className="mb-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onLoadMore}
                                    disabled={loadingMore}
                                    className="h-8 text-[12px]"
                                >
                                    {loadingMore ? 'Loading...' : 'Load more'}
                                </Button>
                            </div>
                        )}
                        Showing {filtered.length} of {notifications.length} notifications
                    </div>
                )}
            </div>

            <AlertDialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete notification?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove "{deleteTarget?.title}" from the feed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}