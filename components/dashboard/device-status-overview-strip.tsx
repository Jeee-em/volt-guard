'use client';

import { useMemo } from 'react';
import {
    Cpu,
    Zap,
    Activity,
    Wifi,
    WifiOff,
    AlertTriangle,
    Wrench,
    CheckCircle2,
    TrendingUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeviceType   = 'esp32' | 'current_sensor' | 'voltage_sensor';
export type DeviceStatus = 'online' | 'offline' | 'maintenance';

export interface DeviceOverviewItem {
    id:     string;
    type:   DeviceType;
    status: DeviceStatus;
    /** Active anomaly count on this device */
    activeAlerts: number;
    /** paired sensor id — for current/voltage sensor pairing */
    pairedWith?: string;
}

export interface DeviceStatusOverviewStripProps {
    devices: DeviceOverviewItem[];
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface DeviceTypeSummary {
    type:       DeviceType;
    total:      number;
    online:     number;
    offline:    number;
    maintenance:number;
    alerts:     number;
}

interface StatCardConfig {
    label:     string;
    value:     string | number;
    sublabel:  string;
    icon:      React.ElementType;
    iconClass: string;
    accent:    string;
}

interface PairHealth {
    pairIndex:      number;
    esp32Id:        string;
    esp32Status:    DeviceStatus;
    currentStatus:  DeviceStatus;
    voltageStatus:  DeviceStatus;
    alerts:         number;
    allOnline:      boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG = {
    esp32: {
        label:     'ESP32',
        sublabel:  'Microcontroller',
        icon:      Cpu,
        color:     '#1D9E75',
        bgClass:   'bg-teal-50 dark:bg-teal-950/30',
        iconClass: 'text-teal-600 dark:text-teal-400',
    },
    current_sensor: {
        label:     'Current',
        sublabel:  'ACS712 Sensor',
        icon:      Activity,
        color:     '#BA7517',
        bgClass:   'bg-amber-50 dark:bg-amber-950/30',
        iconClass: 'text-amber-600 dark:text-amber-400',
    },
    voltage_sensor: {
        label:     'Voltage',
        sublabel:  'ZMPT101B Sensor',
        icon:      Zap,
        color:     '#378ADD',
        bgClass:   'bg-blue-50 dark:bg-blue-950/30',
        iconClass: 'text-blue-600 dark:text-blue-400',
    },
} as const satisfies Record<DeviceType, {
    label:     string;
    sublabel:  string;
    icon:      React.ElementType;
    color:     string;
    bgClass:   string;
    iconClass: string;
}>;

const STATUS_CFG = {
    online: {
        label:     'Online',
        dot:       'bg-green-500',
        textClass: 'text-green-600 dark:text-green-400',
        icon:      Wifi,
    },
    offline: {
        label:     'Offline',
        dot:       'bg-red-500',
        textClass: 'text-red-600 dark:text-red-400',
        icon:      WifiOff,
    },
    maintenance: {
        label:     'Maintenance',
        dot:       'bg-amber-400',
        textClass: 'text-amber-600 dark:text-amber-400',
        icon:      Wrench,
    },
} as const satisfies Record<DeviceStatus, {
    label:     string;
    dot:       string;
    textClass: string;
    icon:      React.ElementType;
}>;

const DEVICE_TYPES: DeviceType[] = ['esp32', 'current_sensor', 'voltage_sensor'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function summariseByType(devices: DeviceOverviewItem[]): DeviceTypeSummary[] {
    return DEVICE_TYPES.map((type) => {
        const group = devices.filter((d) => d.type === type);
        return {
            type,
            total:       group.length,
            online:      group.filter((d) => d.status === 'online').length,
            offline:     group.filter((d) => d.status === 'offline').length,
            maintenance: group.filter((d) => d.status === 'maintenance').length,
            alerts:      group.reduce((sum, d) => sum + d.activeAlerts, 0),
        };
    });
}

function healthLabel(online: number, total: number): string {
    if (total === 0)          return '—';
    if (online === total)     return 'All online';
    if (online === 0)         return 'All offline';
    return `${online} / ${total} online`;
}

// ─── Mini status bar ──────────────────────────────────────────────────────────

interface StatusBarProps {
    online:      number;
    offline:     number;
    maintenance: number;
    total:       number;
}

function StatusBar({ online, offline, maintenance, total }: StatusBarProps) {
    if (total === 0) return null;
    const onlinePct      = (online      / total) * 100;
    const maintenancePct = (maintenance / total) * 100;
    const offlinePct     = (offline     / total) * 100;

    return (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            {onlinePct > 0 && (
                <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${onlinePct}%` }}
                />
            )}
            {maintenancePct > 0 && (
                <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${maintenancePct}%` }}
                />
            )}
            {offlinePct > 0 && (
                <div
                    className="h-full bg-red-400 transition-all"
                    style={{ width: `${offlinePct}%` }}
                />
            )}
        </div>
    );
}

// ─── Device type card ─────────────────────────────────────────────────────────

interface DeviceTypeCardProps {
    summary: DeviceTypeSummary;
}

function DeviceTypeCard({ summary }: DeviceTypeCardProps) {
    const cfg      = TYPE_CFG[summary.type];
    const TypeIcon = cfg.icon;
    const allOnline = summary.online === summary.total && summary.total > 0;

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3.5">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bgClass}`}>
                    <TypeIcon className={`h-4.5 w-4.5 ${cfg.iconClass}`} style={{ width: 18, height: 18 }} />
                </div>
                {summary.alerts > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {summary.alerts}
                    </span>
                )}
                {allOnline && summary.alerts === 0 && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
            </div>

            {/* Label + count */}
            <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    {cfg.label}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                    {cfg.sublabel}
                </p>
                <p className="mt-1.5 font-mono text-[24px] font-medium leading-none text-foreground">
                    {summary.online}
                    <span className="text-[14px] font-normal text-muted-foreground">
                        /{summary.total}
                    </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {healthLabel(summary.online, summary.total)}
                </p>
            </div>

            {/* Status bar */}
            <StatusBar
                online={summary.online}
                offline={summary.offline}
                maintenance={summary.maintenance}
                total={summary.total}
            />

            {/* Breakdown pills */}
            <div className="flex flex-wrap gap-1.5">
                {summary.online > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {summary.online} online
                    </span>
                )}
                {summary.maintenance > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        {summary.maintenance} maintenance
                    </span>
                )}
                {summary.offline > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        {summary.offline} offline
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Pair health row ──────────────────────────────────────────────────────────

interface PairHealthRowProps {
    pair: PairHealth;
}

function PairStatusDot({ status }: { status: DeviceStatus }) {
    return (
        <span
            className={`inline-block h-2 w-2 rounded-full ${STATUS_CFG[status].dot}`}
            title={STATUS_CFG[status].label}
        />
    );
}

function PairHealthRow({ pair }: PairHealthRowProps) {
    const allOnline = pair.allOnline;

    return (
        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
            allOnline
                ? 'border-border bg-background'
                : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
        }`}>
            {/* Pair index */}
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                P{pair.pairIndex}
            </span>

            {/* ESP32 */}
            <div className="flex items-center gap-1.5">
                <PairStatusDot status={pair.esp32Status} />
                <Cpu className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span className="text-[11px] text-muted-foreground">ESP32</span>
            </div>

            <span className="text-muted-foreground/30">·</span>

            {/* Current sensor */}
            <div className="flex items-center gap-1.5">
                <PairStatusDot status={pair.currentStatus} />
                <Activity className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] text-muted-foreground">Current</span>
            </div>

            <span className="text-muted-foreground/30">·</span>

            {/* Voltage sensor */}
            <div className="flex items-center gap-1.5">
                <PairStatusDot status={pair.voltageStatus} />
                <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[11px] text-muted-foreground">Voltage</span>
            </div>

            <div className="flex-1" />

            {/* Alerts */}
            {pair.alerts > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-300">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {pair.alerts}
                </span>
            )}

            {/* Health indicator */}
            <span className={`text-[11px] font-medium ${
                allOnline
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
            }`}>
                {allOnline ? 'Healthy' : 'Degraded'}
            </span>
        </div>
    );
}

// ─── Summary stat ─────────────────────────────────────────────────────────────

interface SummaryStatProps {
    label:     string;
    value:     number;
    total?:    number;
    icon:      React.ElementType;
    iconClass: string;
    emphasis?: boolean;
}

function SummaryStat({ label, value, total, icon: Icon, iconClass, emphasis = false }: SummaryStatProps) {
    return (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            emphasis && value > 0
                ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                : 'border-border bg-background'
        }`}>
            <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
            <div>
                <p className="font-mono text-[18px] font-medium leading-none text-foreground">
                    {value}
                    {total !== undefined && (
                        <span className="text-[12px] font-normal text-muted-foreground">
                            /{total}
                        </span>
                    )}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DeviceStatusOverviewStrip({ devices }: DeviceStatusOverviewStripProps) {
    const typeSummaries = useMemo(() => summariseByType(devices), [devices]);

    const totalDevices   = devices.length;
    const totalOnline    = devices.filter((d) => d.status === 'online').length;
    const totalOffline   = devices.filter((d) => d.status === 'offline').length;
    const totalMaint     = devices.filter((d) => d.status === 'maintenance').length;
    const totalAlerts    = devices.reduce((sum, d) => sum + d.activeAlerts, 0);
    const allHealthy     = totalOnline === totalDevices && totalAlerts === 0;

    // Build pair health — assumes devices are ordered as:
    // esp32[0], current[0], voltage[0], esp32[1], current[1], voltage[1], ...
    const esp32s    = devices.filter((d) => d.type === 'esp32');
    const currents  = devices.filter((d) => d.type === 'current_sensor');
    const voltages  = devices.filter((d) => d.type === 'voltage_sensor');

    const pairs = useMemo<PairHealth[]>(() => {
        return esp32s.map((esp, i) => {
            const cur = currents[i];
            const vol = voltages[i];
            const pairAlerts =
                esp.activeAlerts +
                (cur?.activeAlerts ?? 0) +
                (vol?.activeAlerts ?? 0);
            const currentStatus = cur?.status ?? 'offline';
            const voltageStatus = vol?.status ?? 'offline';
            return {
                pairIndex:     i + 1,
                esp32Id:       esp.id,
                esp32Status:   esp.status,
                currentStatus,
                voltageStatus,
                alerts:        pairAlerts,
                allOnline:
                    esp.status === 'online' &&
                    currentStatus === 'online' &&
                    voltageStatus === 'online',
            };
        });
    }, [esp32s, currents, voltages]);

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Device Overview
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2">
                    {allHealthy ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-300">
                            <CheckCircle2 className="h-3 w-3" />
                            All systems healthy
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Attention required
                        </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                        {totalDevices} devices · {pairs.length} pairs
                    </span>
                </div>
            </div>

            {/* ── Top row: summary stats ── */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryStat
                    label="Total online"
                    value={totalOnline}
                    total={totalDevices}
                    icon={Wifi}
                    iconClass="text-green-500"
                />
                <SummaryStat
                    label="Offline"
                    value={totalOffline}
                    icon={WifiOff}
                    iconClass={totalOffline > 0 ? 'text-red-500' : 'text-muted-foreground'}
                    emphasis={totalOffline > 0}
                />
                <SummaryStat
                    label="Maintenance"
                    value={totalMaint}
                    icon={Wrench}
                    iconClass={totalMaint > 0 ? 'text-amber-500' : 'text-muted-foreground'}
                />
                <SummaryStat
                    label="Active alerts"
                    value={totalAlerts}
                    icon={AlertTriangle}
                    iconClass={totalAlerts > 0 ? 'text-red-500' : 'text-muted-foreground'}
                    emphasis={totalAlerts > 0}
                />
            </div>

            {/* ── Middle row: per device-type cards ── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {typeSummaries.map((summary) => (
                    <DeviceTypeCard key={summary.type} summary={summary} />
                ))}
            </div>

            {/* ── Bottom row: pair health ── */}
            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2.5">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Sensor pair health
                    </span>
                    <div className="flex-1" />
                    <span className="text-[11px] text-muted-foreground">
                        {pairs.filter((p) => p.allOnline).length} / {pairs.length} pairs healthy
                    </span>
                </div>
                <div className="space-y-2 p-3">
                    {pairs.length === 0 ? (
                        <p className="py-4 text-center text-[13px] text-muted-foreground">
                            No sensor pairs configured.
                        </p>
                    ) : (
                        pairs.map((pair) => (
                            <PairHealthRow key={pair.esp32Id} pair={pair} />
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}