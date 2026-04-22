'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff, ChevronDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRange = '5m' | '15m' | '1h' | '6h' | '24h' | '7d';

export type RefreshInterval = 0 | 5 | 10 | 30 | 60;

export interface AnalyticsHeaderProps {
    /** Current connection status of the sensor feed */
    isConnected: boolean;
    /** Called when date range changes */
    onRangeChange: (range: DateRange) => void;
    /** Called when refresh interval changes (0 = manual only) */
    onRefreshIntervalChange: (interval: RefreshInterval) => void;
    /** Called when the user manually triggers a refresh */
    onRefresh: () => void;
    /** Whether a data fetch is currently in progress */
    loading?: boolean;
    /** Device or feed name shown in the header */
    deviceName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGES: { value: DateRange; label: string }[] = [
    { value: '5m',  label: 'Last 5 min' },
    { value: '15m', label: 'Last 15 min' },
    { value: '1h',  label: 'Last 1 hour' },
    { value: '6h',  label: 'Last 6 hours' },
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d',  label: 'Last 7 days' },
];

const REFRESH_INTERVALS: { value: RefreshInterval; label: string }[] = [
    { value: 0,  label: 'Manual' },
    { value: 5,  label: 'Every 5s' },
    { value: 10, label: 'Every 10s' },
    { value: 30, label: 'Every 30s' },
    { value: 60, label: 'Every 1 min' },
];

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
    const [time, setTime] = useState('');

    useEffect(() => {
        const fmt = () =>
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

// ─── Refresh countdown ring ───────────────────────────────────────────────────

function CountdownRing({ interval, onTick }: { interval: RefreshInterval; onTick: () => void }) {
    const [remaining, setRemaining] = useState<number>(interval);

    useEffect(() => {
        if (interval === 0) return;
        setRemaining(interval);
        const id = setInterval(() => {
            setRemaining((r) => {
                if (r <= 1) {
                    onTick();
                    return interval;
                }
                return r - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [interval, onTick]);

    if (interval === 0) return null;

    const pct = (remaining / interval) * 100;
    const r = 7;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;

    return (
        <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
            <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
            <circle
                cx="10" cy="10" r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                className="text-foreground transition-all duration-1000"
            />
        </svg>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyticsHeader({
    isConnected,
    onRangeChange,
    onRefreshIntervalChange,
    onRefresh,
    loading = false,
    deviceName = 'Sensor Feed',
}: AnalyticsHeaderProps) {
    const [activeRange, setActiveRange] = useState<DateRange>('1h');
    const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10);

    const handleRangeChange = (range: DateRange) => {
        setActiveRange(range);
        onRangeChange(range);
    };

    const handleIntervalChange = (interval: RefreshInterval) => {
        setRefreshInterval(interval);
        onRefreshIntervalChange(interval);
    };

    const handleTick = useCallback(() => {
        onRefresh();
    }, [onRefresh]);

    const activeRangeLabel = DATE_RANGES.find((r) => r.value === activeRange)?.label ?? 'Last 1 hour';
    const activeIntervalLabel = REFRESH_INTERVALS.find((r) => r.value === refreshInterval)?.label ?? 'Every 10s';

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex h-14 items-center justify-between gap-4 px-6">

                {/* Left — brand + device */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-muted-foreground">
                            {deviceName}
                        </span>
                    </div>
                </div>

                {/* Center — date range pills */}
                <nav className="hidden items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5 sm:flex">
                    {DATE_RANGES.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => handleRangeChange(value)}
                            className={`rounded-md px-3 py-1 text-[12px] font-medium transition-all ${
                                activeRange === value
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Mobile range — dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-[12px] sm:hidden">
                            {activeRangeLabel}
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                        {DATE_RANGES.map(({ value, label }) => (
                            <DropdownMenuItem key={value} onClick={() => handleRangeChange(value)}>
                                {label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Right — live clock · connection · refresh */}
                <div className="flex items-center gap-3">
                    <LiveClock />

                    {/* Connection badge */}
                    <div
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            isConnected
                                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                        }`}
                    >
                        <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${
                                isConnected ? 'animate-pulse bg-green-500' : 'bg-red-500'
                            }`}
                        />
                        {isConnected ? 'Live' : 'Offline'}
                        {isConnected ? (
                            <Wifi className="h-3 w-3" />
                        ) : (
                            <WifiOff className="h-3 w-3" />
                        )}
                    </div>

                    {/* Refresh interval */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-[12px]"
                                disabled={loading}
                            >
                                <CountdownRing interval={refreshInterval} onTick={handleTick} />
                                {activeIntervalLabel}
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {REFRESH_INTERVALS.map(({ value, label }) => (
                                <DropdownMenuItem
                                    key={value}
                                    onClick={() => handleIntervalChange(value)}
                                    className={refreshInterval === value ? 'font-medium' : ''}
                                >
                                    {label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Manual refresh */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onRefresh}
                        disabled={loading}
                        aria-label="Refresh data"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>
        </header>
    );
}