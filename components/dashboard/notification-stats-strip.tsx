'use client';

import { useMemo } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle2,
    Clock,
    TrendingUp,
    TrendingDown,
    Minus,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationSeverity = 'critical' | 'warning' | 'info';
export type NotificationStatus   = 'unread' | 'read';

export interface NotificationStatsItem {
    id:         string;
    severity:   NotificationSeverity;
    status:     NotificationStatus;
    receivedAt: string;  // ISO
    resolvedAt?: string; // ISO — undefined if still active
}

export interface NotificationStatsStripProps {
    notifications: NotificationStatsItem[];
    /** How many past days to include in the window. Default: 7 */
    windowDays?: number;
}

// ─── Internal computed types ──────────────────────────────────────────────────

interface DayBucket {
    label:    string;  // "Mon", "Tue", etc.
    dateKey:  string;  // YYYY-MM-DD
    total:    number;
    critical: number;
    warning:  number;
    info:     number;
}

interface StatCardData {
    label:     string;
    value:     string;
    sublabel?: string;
    icon:      React.ElementType;
    iconClass: string;
    trend?:    'up' | 'down' | 'neutral';
    trendLabel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
    return iso.slice(0, 10);
}

function dayLabel(dateKey: string): string {
    return new Date(dateKey).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatDuration(seconds: number): string {
    if (seconds < 60)    return `${Math.round(seconds)}s`;
    if (seconds < 3_600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86_400)return `${(seconds / 3_600).toFixed(1)}h`;
    return `${(seconds / 86_400).toFixed(1)}d`;
}

function getPastDateKeys(windowDays: number): string[] {
    const keys: string[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000);
        keys.push(toDateKey(d.toISOString()));
    }
    return keys;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps {
    buckets:     DayBucket[];
    height?:     number;
    activeIndex: number | null;
    onHover:     (index: number | null) => void;
}

function Sparkline({ buckets, height = 40, activeIndex, onHover }: SparklineProps) {
    const max = Math.max(...buckets.map((b) => b.total), 1);
    const w   = 100 / buckets.length;

    return (
        <div
            className="relative select-none"
            style={{ height }}
            onMouseLeave={() => onHover(null)}
        >
            <svg
                viewBox={`0 0 ${buckets.length * 10} ${height}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
            >
                {/* Baseline */}
                <line
                    x1="0" y1={height - 1}
                    x2={buckets.length * 10} y2={height - 1}
                    stroke="hsl(var(--border))"
                    strokeWidth="0.5"
                />

                {/* Polyline */}
                <polyline
                    fill="none"
                    stroke="hsl(var(--foreground))"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                    points={buckets
                        .map((b, i) => {
                            const x = i * 10 + 5;
                            const y = height - 2 - ((b.total / max) * (height - 6));
                            return `${x},${y}`;
                        })
                        .join(' ')}
                />

                {/* Dots */}
                {buckets.map((b, i) => {
                    const x        = i * 10 + 5;
                    const y        = height - 2 - ((b.total / max) * (height - 6));
                    const isActive = activeIndex === i;
                    return (
                        <circle
                            key={b.dateKey}
                            cx={x} cy={y} r={isActive ? 2.5 : 1.5}
                            fill={
                                b.critical > 0 ? '#ef4444'
                                : b.warning > 0 ? '#f59e0b'
                                : 'hsl(var(--foreground))'
                            }
                            fillOpacity={isActive ? 1 : 0.5}
                        />
                    );
                })}
            </svg>

            {/* Hover zones */}
            <div className="absolute inset-0 flex">
                {buckets.map((b, i) => (
                    <div
                        key={b.dateKey}
                        className="h-full flex-1 cursor-default"
                        onMouseEnter={() => onHover(i)}
                    />
                ))}
            </div>

            {/* Hover tooltip */}
            {activeIndex !== null && (
                <div
                    className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-md border border-border bg-background px-2 py-1 text-[11px] shadow-sm"
                    style={{ left: `${(activeIndex / buckets.length) * 100 + 100 / buckets.length / 2}%` }}
                >
                    <span className="font-mono font-medium text-foreground">
                        {buckets[activeIndex].total}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                        {buckets[activeIndex].label}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ data }: { data: StatCardData }) {
    const Icon = data.icon;

    const TrendIcon =
        data.trend === 'up'   ? TrendingUp   :
        data.trend === 'down' ? TrendingDown :
        data.trend === 'neutral' ? Minus     : null;

    const trendColor =
        data.trend === 'up'      ? 'text-red-500'   :
        data.trend === 'down'    ? 'text-green-500' :
        'text-muted-foreground';

    return (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {data.label}
                </span>
                <Icon className={`h-3.5 w-3.5 ${data.iconClass}`} />
            </div>

            <span className="font-mono text-[22px] font-medium leading-none text-foreground">
                {data.value}
            </span>

            <div className="flex items-center gap-1">
                {TrendIcon && (
                    <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                )}
                {data.sublabel && (
                    <span className={`text-[11px] ${data.trend ? trendColor : 'text-muted-foreground'}`}>
                        {data.sublabel}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

import { useState } from 'react';

export function NotificationStatsStrip({
    notifications,
    windowDays = 7,
}: NotificationStatsStripProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const dateKeys = useMemo(() => getPastDateKeys(windowDays), [windowDays]);

    // Filter to window
    const windowStart = new Date(Date.now() - windowDays * 86_400_000).toISOString();
    const inWindow = useMemo(
        () => notifications.filter((n) => n.receivedAt >= windowStart),
        [notifications, windowStart]
    );

    // Previous window for trend comparison
    const prevWindowStart = new Date(Date.now() - windowDays * 2 * 86_400_000).toISOString();
    const inPrevWindow = useMemo(
        () => notifications.filter(
            (n) => n.receivedAt >= prevWindowStart && n.receivedAt < windowStart
        ),
        [notifications, prevWindowStart, windowStart]
    );

    // Day buckets for sparkline
    const buckets = useMemo<DayBucket[]>(() => {
        return dateKeys.map((dateKey) => {
            const dayItems = inWindow.filter((n) => toDateKey(n.receivedAt) === dateKey);
            return {
                label:    dayLabel(dateKey),
                dateKey,
                total:    dayItems.length,
                critical: dayItems.filter((n) => n.severity === 'critical').length,
                warning:  dayItems.filter((n) => n.severity === 'warning').length,
                info:     dayItems.filter((n) => n.severity === 'info').length,
            };
        });
    }, [dateKeys, inWindow]);

    // Stats
    const totalThisWindow = inWindow.length;
    const totalPrevWindow = inPrevWindow.length;
    const criticalCount   = inWindow.filter((n) => n.severity === 'critical').length;
    const unreadCount     = inWindow.filter((n) => n.status === 'unread').length;

    // Average resolution time (resolved items only)
    const resolutionTimes = inWindow
        .filter((n): n is NotificationStatsItem & { resolvedAt: string } =>
            n.resolvedAt !== undefined
        )
        .map((n) =>
            (new Date(n.resolvedAt).getTime() - new Date(n.receivedAt).getTime()) / 1000
        )
        .filter((t) => t >= 0);

    const avgResolution = resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : null;

    // Volume trend vs previous window
    const volumeTrend: 'up' | 'down' | 'neutral' =
        totalThisWindow > totalPrevWindow ? 'up'   :
        totalThisWindow < totalPrevWindow ? 'down' : 'neutral';

    const volumeDelta = totalPrevWindow === 0
        ? null
        : Math.round(Math.abs(((totalThisWindow - totalPrevWindow) / totalPrevWindow) * 100));

    // Stat cards
    const statCards = useMemo<StatCardData[]>(() => [
        {
            label:     `Total (${windowDays}d)`,
            value:     String(totalThisWindow),
            icon:      AlertCircle,
            iconClass: 'text-muted-foreground',
            trend:     volumeTrend,
            sublabel:  volumeDelta !== null
                ? `${volumeDelta}% vs prev ${windowDays}d`
                : 'No prior data',
        },
        {
            label:     'Critical',
            value:     String(criticalCount),
            icon:      AlertCircle,
            iconClass: 'text-red-500',
            sublabel:  totalThisWindow > 0
                ? `${Math.round((criticalCount / totalThisWindow) * 100)}% of total`
                : '—',
        },
        {
            label:     'Unread',
            value:     String(unreadCount),
            icon:      AlertTriangle,
            iconClass: unreadCount > 0 ? 'text-amber-500' : 'text-muted-foreground',
            sublabel:  unreadCount === 0 ? 'All caught up' : 'Needs attention',
        },
        {
            label:     'Avg resolution',
            value:     avgResolution !== null ? formatDuration(avgResolution) : '—',
            icon:      Clock,
            iconClass: 'text-muted-foreground',
            sublabel:  resolutionTimes.length > 0
                ? `from ${resolutionTimes.length} resolved`
                : 'No resolved items',
        },
    ], [
        totalThisWindow, criticalCount, unreadCount,
        avgResolution, resolutionTimes.length,
        volumeTrend, volumeDelta, windowDays,
    ]);

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Overview
                </h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">
                    Last {windowDays} days
                </span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_200px]">
                {/* Stat cards */}
                {statCards.map((card) => (
                    <StatCard key={card.label} data={card} />
                ))}

                {/* Sparkline card */}
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-background px-4 py-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Frequency
                        </span>
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>

                    <div className="relative mt-1">
                        <Sparkline
                            buckets={buckets}
                            height={38}
                            activeIndex={hoverIndex}
                            onHover={setHoverIndex}
                        />
                    </div>

                    {/* Day labels */}
                    <div className="flex justify-between">
                        {buckets.map((b, i) => (
                            <span
                                key={b.dateKey}
                                className={`text-[9px] transition-colors ${
                                    hoverIndex === i
                                        ? 'font-medium text-foreground'
                                        : 'text-muted-foreground/50'
                                }`}
                            >
                                {b.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}