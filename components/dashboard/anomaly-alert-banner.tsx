'use client';

import { useState, useMemo } from 'react';
import {
    AlertTriangle,
    AlertCircle,
    Info,
    ChevronDown,
    ChevronUp,
    X,
    CheckCircle2,
    Bell,
    BellOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'resolved';
export type AlertMetric = 'voltage' | 'current' | 'power' | 'power_loss' | 'power_factor';

export interface AnomalyAlert {
    id: string;
    severity: AlertSeverity;
    status: AlertStatus;
    metric: AlertMetric;
    message: string;
    value: number;
    unit: string;
    threshold: number;
    timestamp: string; // ISO string
    resolvedAt?: string; // ISO string
}

export interface AnomalyAlertBannerProps {
    alerts: AnomalyAlert[];
    /** Called when user dismisses a single alert */
    onDismiss?: (id: string) => void;
    /** Called when user clears all resolved alerts */
    onClearResolved?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
    critical: {
        icon: AlertCircle,
        label: 'Critical',
        rowClass: 'border-l-red-500 bg-red-50 dark:bg-red-950/30',
        badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
        iconClass: 'text-red-500',
        dotClass: 'bg-red-500',
    },
    warning: {
        icon: AlertTriangle,
        label: 'Warning',
        rowClass: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
        iconClass: 'text-amber-500',
        dotClass: 'bg-amber-500',
    },
    info: {
        icon: Info,
        label: 'Info',
        rowClass: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
        badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        iconClass: 'text-blue-500',
        dotClass: 'bg-blue-500',
    },
} as const;

const METRIC_LABELS: Record<AlertMetric, string> = {
    voltage: 'Voltage',
    current: 'Current',
    power: 'Power',
    power_loss: 'Power Loss',
    power_factor: 'Power Factor',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Single alert row ─────────────────────────────────────────────────────────

function AlertRow({
    alert,
    onDismiss,
}: {
    alert: AnomalyAlert;
    onDismiss?: (id: string) => void;
}) {
    const cfg = SEVERITY_CONFIG[alert.severity];
    const Icon = cfg.icon;
    const isResolved = alert.status === 'resolved';

    return (
        <div
            className={`flex items-start gap-3 border-l-2 px-4 py-3 transition-colors ${cfg.rowClass} ${
                isResolved ? 'opacity-50' : ''
            }`}
        >
            {/* Icon */}
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconClass}`} />

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Severity badge */}
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.badgeClass}`}
                    >
                        {cfg.label}
                    </span>

                    {/* Metric */}
                    <span className="font-mono text-[11px] font-medium text-muted-foreground">
                        {METRIC_LABELS[alert.metric]}
                    </span>

                    {/* Resolved badge */}
                    {isResolved && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Resolved
                        </span>
                    )}
                </div>

                {/* Message */}
                <p className="mt-0.5 text-[12px] text-foreground">{alert.message}</p>

                {/* Value + threshold + time */}
                <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">
                        Value:{' '}
                        <span className="font-medium text-foreground">
                            {alert.value} {alert.unit}
                        </span>
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                        Threshold:{' '}
                        <span className="font-medium text-foreground">
                            {alert.threshold} {alert.unit}
                        </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        {formatTime(alert.timestamp)} · {timeAgo(alert.timestamp)}
                    </span>
                    {isResolved && alert.resolvedAt && (
                        <span className="text-[11px] text-muted-foreground">
                            Resolved {timeAgo(alert.resolvedAt)}
                        </span>
                    )}
                </div>
            </div>

            {/* Dismiss button */}
            {onDismiss && (
                <button
                    onClick={() => onDismiss(alert.id)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
                    aria-label="Dismiss alert"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnomalyAlertBanner({
    alerts,
    onDismiss,
    onClearResolved,
}: AnomalyAlertBannerProps) {
    const [expanded, setExpanded] = useState(true);
    const [muted, setMuted] = useState(false);
    const [showResolved, setShowResolved] = useState(false);

    const active = useMemo(() => alerts.filter((a) => a.status === 'active'), [alerts]);
    const resolved = useMemo(() => alerts.filter((a) => a.status === 'resolved'), [alerts]);

    const criticalCount = active.filter((a) => a.severity === 'critical').length;
    const warningCount = active.filter((a) => a.severity === 'warning').length;

    const visibleAlerts = [
        ...active,
        ...(showResolved ? resolved : []),
    ];

    if (alerts.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">

            {/* ── Header ── */}
            <div
                className="flex cursor-pointer items-center justify-between border-b border-border px-4 py-2.5"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex items-center gap-3">
                    {/* Live dot */}
                    {active.length > 0 && !muted && (
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                    )}

                    <span className="text-[13px] font-medium text-foreground">
                        Anomaly Feed
                    </span>

                    {/* Count pills */}
                    <div className="flex items-center gap-1.5">
                        {criticalCount > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                                {criticalCount} critical
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                {warningCount} warning
                            </span>
                        )}
                        {active.length === 0 && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">
                                All clear
                            </span>
                        )}
                    </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Mute toggle */}
                    <button
                        onClick={() => setMuted((v) => !v)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}
                        title={muted ? 'Unmute' : 'Mute'}
                    >
                        {muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    </button>

                    {/* Show/hide resolved */}
                    {resolved.length > 0 && (
                        <button
                            onClick={() => setShowResolved((v) => !v)}
                            className="rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            {showResolved ? 'Hide resolved' : `+${resolved.length} resolved`}
                        </button>
                    )}

                    {/* Clear resolved */}
                    {showResolved && resolved.length > 0 && onClearResolved && (
                        <button
                            onClick={onClearResolved}
                            className="rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            Clear
                        </button>
                    )}

                    {/* Expand/collapse */}
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* ── Alert list ── */}
            {expanded && (
                <div className="divide-y divide-border">
                    {visibleAlerts.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            No active anomalies detected
                        </div>
                    ) : (
                        visibleAlerts.map((alert) => (
                            <AlertRow key={alert.id} alert={alert} onDismiss={onDismiss} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}