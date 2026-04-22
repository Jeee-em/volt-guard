'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Bell,
    BellOff,
    CheckCheck,
    Settings,
    ChevronDown,
    Zap,
    Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MuteDuration = 30 | 60 | 120 | 480 | -1; // minutes; -1 = indefinite

export interface NotificationSeverityCounts {
    critical: number;
    warning: number;
    info: number;
}

export interface MuteState {
    muted: boolean;
    until: Date | null; // null when indefinite or not muted
}

export interface NotificationCenterHeaderProps {
    unreadCount: number;
    severityCounts: NotificationSeverityCounts;
    muteState: MuteState;
    onMarkAllRead: () => void;
    onMute: (duration: MuteDuration) => void;
    onUnmute: () => void;
    onOpenSettings: () => void;
    /** ISO string — when the feed last received a new notification */
    lastReceivedAt: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

interface MuteOption {
    value: MuteDuration;
    label: string;
}

const MUTE_OPTIONS: MuteOption[] = [
    { value: 30,  label: '30 minutes' },
    { value: 60,  label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 480, label: 'Until morning (8 hrs)' },
    { value: -1,  label: 'Until I turn it back on' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMuteRemaining(until: Date): string {
    const diff = Math.max(0, until.getTime() - Date.now());
    const mins = Math.floor(diff / 60_000);
    if (mins <= 0) return 'Expiring…';
    if (mins < 60) return `${mins}m remaining`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m remaining` : `${hrs}h remaining`;
}

function formatLastReceived(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 10)   return 'just now';
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Severity pill ────────────────────────────────────────────────────────────

interface SeverityPillProps {
    count: number;
    label: string;
    pillClass: string;
}

function SeverityPill({ count, label, pillClass }: SeverityPillProps) {
    if (count === 0) return null;
    return (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillClass}`}>
            {count} {label}
        </span>
    );
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
    const [time, setTime] = useState<string>('');

    useEffect(() => {
        const fmt = (): string =>
            new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
        setTime(fmt());
        const id = setInterval(() => setTime(fmt()), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {time}
        </span>
    );
}

// ─── Mute countdown ───────────────────────────────────────────────────────────

interface MuteCountdownProps {
    until: Date;
    onExpired: () => void;
}

function MuteCountdown({ until, onExpired }: MuteCountdownProps) {
    const [label, setLabel] = useState<string>(formatMuteRemaining(until));

    useEffect(() => {
        const id = setInterval(() => {
            const remaining = until.getTime() - Date.now();
            if (remaining <= 0) {
                onExpired();
                clearInterval(id);
            } else {
                setLabel(formatMuteRemaining(until));
            }
        }, 10_000);
        return () => clearInterval(id);
    }, [until, onExpired]);

    return (
        <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
            {label}
        </span>
    );
}

// ─── Unread badge ─────────────────────────────────────────────────────────────

interface UnreadBadgeProps {
    count: number;
}

function UnreadBadge({ count }: UnreadBadgeProps) {
    if (count === 0) return null;
    return (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {count > 99 ? '99+' : count}
        </span>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationCenterHeader({
    unreadCount,
    severityCounts,
    muteState,
    onMarkAllRead,
    onMute,
    onUnmute,
    onOpenSettings,
    lastReceivedAt,
}: NotificationCenterHeaderProps) {
    const [lastReceivedLabel, setLastReceivedLabel] = useState<string>(
        lastReceivedAt ? formatLastReceived(lastReceivedAt) : '—'
    );

    // Refresh "last received" label every 15s
    useEffect(() => {
        if (!lastReceivedAt) return;
        setLastReceivedLabel(formatLastReceived(lastReceivedAt));
        const id = setInterval(() => {
            setLastReceivedLabel(formatLastReceived(lastReceivedAt));
        }, 15_000);
        return () => clearInterval(id);
    }, [lastReceivedAt]);

    const handleMuteExpired = useCallback(() => {
        onUnmute();
    }, [onUnmute]);

    const totalUnread = unreadCount;
    const hasCritical = severityCounts.critical > 0;

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex h-14 items-center justify-between gap-4 px-6">

                {/* ── Center: severity summary + last received ── */}
                <div className="hidden items-center gap-3 sm:flex">
                    {hasCritical && (
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                    )}

                    <SeverityPill
                        count={severityCounts.critical}
                        label="critical"
                        pillClass="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                    />
                    <SeverityPill
                        count={severityCounts.warning}
                        label="warning"
                        pillClass="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                    />
                    <SeverityPill
                        count={severityCounts.info}
                        label="info"
                        pillClass="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    />

                    {severityCounts.critical === 0 &&
                     severityCounts.warning === 0 &&
                     severityCounts.info === 0 && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-300">
                            All clear
                        </span>
                    )}

                    <span className="text-muted-foreground">·</span>

                    <span className="text-[11px] text-muted-foreground">
                        Last received{' '}
                        <span className="font-medium text-foreground">
                            {lastReceivedLabel}
                        </span>
                    </span>
                </div>

                {/* ── Right: clock + actions ── */}
                <div className="flex items-center gap-2">
                    <LiveClock />

                    {/* Mute status indicator */}
                    {muteState.muted && (
                        <div className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 dark:border-amber-800 dark:bg-amber-950/40 sm:flex">
                            <Moon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                Muted
                            </span>
                            {muteState.until !== null && (
                                <MuteCountdown
                                    until={muteState.until}
                                    onExpired={handleMuteExpired}
                                />
                            )}
                        </div>
                    )}

                    {/* Mark all read */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMarkAllRead}
                        disabled={totalUnread === 0}
                        className="hidden gap-1.5 text-[12px] sm:flex"
                        title="Mark all as read"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                    </Button>

                    {/* Mute / unmute dropdown */}
                    {muteState.muted ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onUnmute}
                            className="gap-1.5 text-[12px]"
                        >
                            <Bell className="h-3.5 w-3.5" />
                            Unmute
                        </Button>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5 text-[12px]">
                                    <BellOff className="h-3.5 w-3.5" />
                                    Mute
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Mute notifications for…
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {MUTE_OPTIONS.map(({ value, label }) => (
                                    <DropdownMenuItem
                                        key={value}
                                        onClick={() => onMute(value)}
                                        className="text-[13px]"
                                    >
                                        {label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Bell icon with unread badge */}
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`${totalUnread} unread notifications`}
                        >
                            <Bell className="h-4 w-4" />
                        </Button>
                        <UnreadBadge count={totalUnread} />
                    </div>

                    {/* Settings */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onOpenSettings}
                        aria-label="Notification settings"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* ── Mobile severity bar ── */}
            <div className="flex items-center gap-2 border-t border-border px-6 py-1.5 sm:hidden">
                <SeverityPill
                    count={severityCounts.critical}
                    label="critical"
                    pillClass="bg-red-100 text-red-700"
                />
                <SeverityPill
                    count={severityCounts.warning}
                    label="warning"
                    pillClass="bg-amber-100 text-amber-700"
                />
                <SeverityPill
                    count={severityCounts.info}
                    label="info"
                    pillClass="bg-blue-100 text-blue-700"
                />
                <span className="ml-auto text-[11px] text-muted-foreground">
                    Last: {lastReceivedLabel}
                </span>
            </div>
        </header>
    );
}