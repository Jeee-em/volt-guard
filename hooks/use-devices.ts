"use client";

import { useState, useEffect } from 'react';
import {
    getDatabase,
    ref,
    onValue,
    off,
    DataSnapshot,
    get,
    set,
    update,
    remove,
    query,
    orderByChild,
    limitToLast,
} from 'firebase/database';
import { app } from '../lib/firebase';

export interface Device {
    deviceId: string;
    name: string;
    type?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    status: 'active' | 'inactive' | 'maintenance';
    lastSeen?: number;
    actualLastSeen?: number; // Actual timestamp from latest power reading
    createdAt?: number;
    updatedAt?: number;
}

export function useDevices(): {
    devices: Device[];
    loading: boolean;
    error: Error | null;
    addDevice: (device: Omit<Device, 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateDevice: (deviceId: string, updates: Partial<Device>) => Promise<void>;
    deleteDevice: (deviceId: string) => Promise<void>;
} {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const db = getDatabase(app);
        const devicesRef = ref(db, 'devices');

        const resolveStatusForDevice = async (
            deviceId: string,
            status: 'active' | 'inactive' | 'maintenance',
            lastSeen?: number,
        ): Promise<Device> => {
            const readingsRef = ref(db, `readings/${deviceId}`);
            const latestReadingQuery = query(
                readingsRef,
                orderByChild('timestamp'),
                limitToLast(1)
            );

            let calculatedStatus: 'active' | 'inactive' | 'maintenance' = status === 'maintenance' ? 'maintenance' : 'inactive';
            let actualLastSeen = lastSeen ?? 0;

            const readingSnapshot = await get(latestReadingQuery);

            if (readingSnapshot.exists()) {
                readingSnapshot.forEach((readingChild) => {
                    const reading = readingChild.val();
                    actualLastSeen = Number(reading.timestamp);
                });

                if (actualLastSeen > 0 && status !== 'maintenance') {
                    const timeSinceLastReading = Date.now() - actualLastSeen;
                    const thresholdMs = 2 * 60 * 1000;
                    calculatedStatus = timeSinceLastReading < thresholdMs ? 'active' : 'inactive';
                }
            }

            return {
                deviceId,
                name: deviceId,
                type: 'power_monitor',
                status: calculatedStatus,
                actualLastSeen: actualLastSeen || undefined,
                lastSeen: actualLastSeen || undefined,
            };
        };

        const buildDevicesFromReadings = async () => {
            try {
                const readingsSnapshot = await get(ref(db, 'readings'));
                if (!readingsSnapshot.exists()) {
                    setDevices([]);
                    setLoading(false);
                    return;
                }

                const readingsData = readingsSnapshot.val() as Record<string, unknown> | null;
                const deviceIds = readingsData ? Object.keys(readingsData) : [];
                if (deviceIds.length === 0) {
                    setDevices([]);
                    setLoading(false);
                    return;
                }

                const devicesList = await Promise.all(
                    deviceIds.map((deviceId) => resolveStatusForDevice(deviceId, 'inactive')),
                );
                devicesList.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
                setDevices(devicesList);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to load devices'));
                setLoading(false);
            }
        };

        const handleValue = async (snapshot: DataSnapshot) => {
            try {
                if (!snapshot.exists() || !snapshot.hasChildren()) {
                    await buildDevicesFromReadings();
                    return;
                }
                const devicePromises: Promise<Device>[] = [];

                snapshot.forEach((childSnapshot) => {
                    const val = childSnapshot.val();
                    const deviceId = childSnapshot.key || '';
                    devicePromises.push(
                        resolveStatusForDevice(
                            deviceId,
                            val.status === 'maintenance' ? 'maintenance' : 'active',
                            val.lastSeen,
                        ).then((resolved) => ({
                            ...resolved,
                            name: typeof val.name === 'string' ? val.name : resolved.name,
                            type: typeof val.type === 'string' ? val.type : resolved.type,
                            location: typeof val.location === 'string' ? val.location : resolved.location,
                            latitude: typeof val.latitude === 'number' ? val.latitude : resolved.latitude,
                            longitude: typeof val.longitude === 'number' ? val.longitude : resolved.longitude,
                            status: val.status === 'maintenance' ? 'maintenance' : resolved.status,
                        })),
                    );
                });

                const resolvedList = await Promise.all(devicePromises);
                resolvedList.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
                setDevices(resolvedList);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to load devices'));
                setLoading(false);
            }
        };

        const unsubscribe = onValue(devicesRef, handleValue, (err) => {
            setError(err);
            setLoading(false);
        });

        return () => {
            off(devicesRef, 'value', handleValue);
            unsubscribe();
        };
    }, []);

    const addDevice = async (device: Omit<Device, 'createdAt' | 'updatedAt'>) => {
        const db = getDatabase(app);
        const deviceRef = ref(db, `devices/${device.deviceId}`);
        const timestamp = Date.now();

        await set(deviceRef, {
            name: device.name,
            type: device.type || 'power_monitor',
            location: device.location || '',
            latitude: device.latitude || null,
            longitude: device.longitude || null,
            status: device.status || 'active',
            lastSeen: device.lastSeen || timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    };

    const updateDevice = async (deviceId: string, updates: Partial<Device>) => {
        const db = getDatabase(app);
        const deviceRef = ref(db, `devices/${deviceId}`);

        await update(deviceRef, {
            ...updates,
            updatedAt: Date.now(),
        });
    };

    const deleteDevice = async (deviceId: string) => {
        const db = getDatabase(app);
        const deviceRef = ref(db, `devices/${deviceId}`);

        await remove(deviceRef);
    };

    return { devices, loading, error, addDevice, updateDevice, deleteDevice };
}