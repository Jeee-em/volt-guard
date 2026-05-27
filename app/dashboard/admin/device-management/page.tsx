'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useDevices, type Device } from '@/hooks/use-devices';
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
import { DeviceStatusOverviewStrip, type DeviceOverviewItem } from '@/components/dashboard/device-status-overview-strip';
import { ChevronDown, Cpu, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

const SENSOR_LABELS = {
    current_sensor: 'PZCT-02 CT SENSOR',
    voltage_sensor: 'ZMPT101B AC voltage sensor',
} as const;

const DEVICE_TYPES = ['power_monitor', 'esp32', 'current_sensor', 'voltage_sensor'] as const;
const DEVICE_STATUSES = ['active', 'inactive', 'maintenance'] as const;
type DeviceStatusValue = (typeof DEVICE_STATUSES)[number];

interface AdminUserSummary {
    role?: 'super_admin' | 'admin' | 'engineer';
}

interface DeviceDraft {
    deviceId: string;
    name: string;
    type: string;
    location: string;
    status: DeviceStatusValue;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Please try again.';
}

function mapDeviceStatus(status: Device['status']): 'online' | 'offline' | 'maintenance' {
    if (status === 'maintenance') return 'maintenance';
    if (status === 'active') return 'online';
    return 'offline';
}

function formatLastSeen(lastSeen?: number, actualLastSeen?: number) {
    const value = actualLastSeen ?? lastSeen;
    if (!value) return 'Never';
    return new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function buildOverviewDevices(devices: Device[]): DeviceOverviewItem[] {
    const sorted = [...devices].sort((a, b) => a.deviceId.localeCompare(b.deviceId));

    return sorted.flatMap((device) => {
        const overviewStatus = mapDeviceStatus(device.status);
        const activeAlerts = device.status === 'inactive' ? 1 : 0;
        const shared = {
            activeAlerts,
            status: overviewStatus,
        } as const;

        return [
            {
                id: `${device.deviceId}-esp32`,
                type: 'esp32',
                ...shared,
            },
            {
                id: `${device.deviceId}-current`,
                type: 'current_sensor',
                ...shared,
            },
            {
                id: `${device.deviceId}-voltage`,
                type: 'voltage_sensor',
                ...shared,
            },
        ];
    });
}

export default function DeviceManagement() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const { devices, loading: devicesLoading, error: devicesError, addDevice, updateDevice, deleteDevice } = useDevices();

    const [adminRole, setAdminRole] = useState<AdminUserSummary['role'] | null>(null);
    const [roleChecked, setRoleChecked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatusValue>('all');
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [draft, setDraft] = useState<DeviceDraft>({
        deviceId: '',
        name: '',
        type: 'power_monitor',
        location: '',
        status: 'active',
    });

    useEffect(() => {
        let cancelled = false;

        async function loadAdminRole() {
            if (!user?.uid) {
                setAdminRole(null);
                setRoleChecked(true);
                return;
            }

            try {
                const response = await fetch('/api/me/role', {
                    method: 'GET',
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    if (!cancelled) {
                        setAdminRole('engineer');
                        router.replace('/dashboard');
                    }
                    return;
                }

                const payload = await response.json() as AdminUserSummary;
                if (!cancelled) {
                    const role = payload.role ?? 'engineer';
                    setAdminRole(role);
                    if (role === 'engineer') {
                        router.replace('/dashboard');
                    }
                }
            } catch {
                if (!cancelled) {
                    setAdminRole('engineer');
                    router.replace('/dashboard');
                }
            } finally {
                if (!cancelled) {
                    setRoleChecked(true);
                }
            }
        }

        void loadAdminRole();

        return () => {
            cancelled = true;
        };
    }, [user?.uid, router]);

    const overviewDevices = useMemo(() => buildOverviewDevices(devices), [devices]);

    const filteredDevices = useMemo(() => {
        return devices.filter((device) => {
            if (statusFilter !== 'all' && device.status !== statusFilter) return false;
            if (!search) return true;
            const query = search.toLowerCase();
            return [device.deviceId, device.name, device.type, device.location]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query);
        });
    }, [devices, search, statusFilter]);

    const selectedDevice = useMemo(() => {
        if (!editingId) return null;
        return devices.find((device) => device.deviceId === editingId) ?? null;
    }, [devices, editingId]);

    useEffect(() => {
        if (!selectedDevice) return;
        setDraft({
            deviceId: selectedDevice.deviceId,
            name: selectedDevice.name,
            type: selectedDevice.type ?? 'power_monitor',
            location: selectedDevice.location ?? '',
            status: selectedDevice.status,
        });
    }, [selectedDevice]);

    const clearForm = useCallback(() => {
        setDraft({
            deviceId: '',
            name: '',
            type: 'power_monitor',
            location: '',
            status: 'active',
        });
        setEditingId(null);
        setShowCreate(false);
    }, []);

    const startEdit = useCallback((device: Device) => {
        setDraft({
            deviceId: device.deviceId,
            name: device.name,
            type: device.type ?? 'power_monitor',
            location: device.location ?? '',
            status: device.status,
        });
        setEditingId(device.deviceId);
        setShowCreate(true);
    }, []);

    const handleSave = useCallback(async () => {
        setBusyId(draft.deviceId || 'create');
        try {
            if (!draft.deviceId.trim()) {
                throw new Error('Device ID is required.');
            }
            if (!draft.name.trim()) {
                throw new Error('Device name is required.');
            }

            const payload = {
                deviceId: draft.deviceId.trim(),
                name: draft.name.trim(),
                type: draft.type || 'power_monitor',
                location: draft.location.trim(),
                status: draft.status,
            };

            if (editingId) {
                await updateDevice(editingId, {
                    name: payload.name,
                    type: payload.type,
                    location: payload.location,
                    status: payload.status,
                });
                toast({
                    title: 'Device updated',
                    description: `${payload.name} was updated successfully.`,
                });
            } else {
                await addDevice({
                    ...payload,
                    lastSeen: Date.now(),
                });
                toast({
                    title: 'Device added',
                    description: `${payload.name} was added successfully.`,
                });
            }

            clearForm();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusyId(null);
        }
    }, [addDevice, clearForm, draft, editingId, toast, updateDevice]);

    const handleDelete = useCallback(async (deviceId: string) => {
        setBusyId(deviceId);
        try {
            await deleteDevice(deviceId);
            toast({
                title: 'Device deleted',
                description: 'The device record was removed.',
            });
            if (editingId === deviceId) {
                clearForm();
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusyId(null);
        }
    }, [clearForm, deleteDevice, editingId, toast]);

    const canAccess = roleChecked && (adminRole === 'super_admin' || adminRole === 'admin');
    const loading = authLoading || devicesLoading || !roleChecked;

    if (!loading && !canAccess) {
        return (
            <div className="container mx-auto p-6">
                <div className="rounded-xl border border-border bg-background px-4 py-6 text-sm text-muted-foreground">
                    Redirecting...
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-8">
            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {devicesError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {devicesError.message}
                </div>
            )}

            <DeviceStatusOverviewStrip devices={overviewDevices} />

            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Device Registry
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground">
                        {filteredDevices.length} shown · {devices.length} total
                    </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                        <div className="relative min-w-55 flex-1">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search devices..."
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

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {statusFilter === 'all' ? 'Status' : statusFilter}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setStatusFilter('all')} className="capitalize text-[13px]">
                                    All
                                </DropdownMenuItem>
                                {DEVICE_STATUSES.map((status) => (
                                    <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)} className="capitalize text-[13px]">
                                        {status}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex-1" />

                        <Button
                            size="sm"
                            onClick={() => {
                                setShowCreate((value) => !value);
                                setEditingId(null);
                                setDraft({
                                    deviceId: '',
                                    name: '',
                                    type: 'power_monitor',
                                    location: '',
                                    status: 'active',
                                });
                            }}
                            className="gap-1.5 text-[12px]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add device
                        </Button>
                    </div>

                    {showCreate && (
                        <div className="grid grid-cols-1 gap-2 border-b border-border bg-muted/20 px-4 py-3 lg:grid-cols-5">
                            <Input
                                value={draft.deviceId}
                                onChange={(event) => setDraft((prev) => ({ ...prev, deviceId: event.target.value }))}
                                placeholder="Device ID"
                                className="h-9"
                                disabled={Boolean(editingId)}
                            />
                            <Input
                                value={draft.name}
                                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder="Device name"
                                className="h-9"
                            />
                            <select
                                value={draft.type}
                                onChange={(event) => setDraft((prev) => ({ ...prev, type: event.target.value }))}
                                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                            >
                                {DEVICE_TYPES.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <select
                                value={draft.status}
                                onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as DeviceStatusValue }))}
                                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                            >
                                {DEVICE_STATUSES.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={draft.location}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
                                    placeholder="Location"
                                    className="h-9"
                                />
                                <Button variant="ghost" size="sm" onClick={clearForm} disabled={busyId !== null}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={busyId !== null} className="gap-1.5">
                                    {busyId ? 'Saving...' : editingId ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-225 text-[12px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/20">
                                    <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Device</th>
                                    <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Type</th>
                                    <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Status</th>
                                    <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Location</th>
                                    <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Last seen</th>
                                    <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-[13px] text-muted-foreground">
                                            Loading devices...
                                        </td>
                                    </tr>
                                ) : filteredDevices.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-[13px] text-muted-foreground">
                                            No devices match the current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDevices.map((device) => (
                                        <tr key={device.deviceId} className="transition-colors hover:bg-muted/20">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/30">
                                                        <Cpu className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-medium text-foreground">{device.name}</p>
                                                        <p className="font-mono text-[11px] text-muted-foreground">{device.deviceId}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[12px] text-foreground">{device.type || 'power_monitor'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${device.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : device.status === 'inactive' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                                                    {device.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[12px] text-foreground">{device.location || '—'}</td>
                                            <td className="px-4 py-3 text-[12px] text-foreground">
                                                {formatLastSeen(device.lastSeen, device.actualLastSeen)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(device)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(device.deviceId)}
                                                        disabled={busyId === device.deviceId}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
                Sensor labels are mapped to the actual hardware names: <span className="font-medium text-foreground">{SENSOR_LABELS.current_sensor}</span> and <span className="font-medium text-foreground">{SENSOR_LABELS.voltage_sensor}</span>.
            </div>
        </div>
    );
}
