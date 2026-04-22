"use client";

import { useState, useEffect } from 'react';
import {
    getDatabase,
    ref,
    onValue,
    off,
    DataSnapshot,
    set,
    update,
    remove,
    query,
    orderByChild,
    limitToLast,
} from 'firebase/database';
import { app } from '@/lib/firebase';

export interface Device {
    deviceId: string;
    name: string;
    type?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    status: 'active' | 'inactive' | 'maintenance';
    lastSeen?: number;
    actualLastSeen?: number; // Actual timestamp from latest sensor reading
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

        const handleValue = async (snapshot: DataSnapshot) => {
            const devicesList: Device[] = [];
            
            // For each device, check its latest reading to determine real status
            const statusPromises: Promise<void>[] = [];
            
            snapshot.forEach((childSnapshot) => {
                const val = childSnapshot.val();
                const deviceId = childSnapshot.key || '';
                
                // Create a promise to check latest reading for this device
                const statusPromise = new Promise<void>((resolve) => {
                    // Query the latest reading for this device
                    const readingsRef = ref(db, `readings/${deviceId}`);
                    const latestReadingQuery = query(
                        readingsRef,
                        orderByChild('timestamp'),
                        limitToLast(1)
                    );
                    
                    onValue(latestReadingQuery, (readingSnapshot) => {
                        let calculatedStatus: 'active' | 'inactive' | 'maintenance' = 'inactive';
                        let actualLastSeen = 0;
                        
                        // If manually set to maintenance, respect that
                        if (val.status === 'maintenance') {
                            calculatedStatus = 'maintenance';
                        }
                        
                        if (readingSnapshot.exists()) {
                            // Check the timestamp of the latest reading
                            readingSnapshot.forEach((readingChild) => {
                                const reading = readingChild.val();
                                actualLastSeen = Number(reading.timestamp);
                            });
                            
                            if (actualLastSeen > 0 && val.status !== 'maintenance') {
                                // Device sends data every 30 minutes, consider active if within 35 minutes
                                const timeSinceLastReading = Date.now() - actualLastSeen;
                                const thresholdMs = 35 * 60 * 1000; // 35 minutes
                                calculatedStatus = timeSinceLastReading < thresholdMs ? 'active' : 'inactive';
                            }
                        }
                        
                        devicesList.push({
                            deviceId,
                            ...val,
                            status: calculatedStatus,
                            actualLastSeen: actualLastSeen > 0 ? actualLastSeen : val.lastSeen,
                        });
                        resolve();
                    }, { onlyOnce: true });
                });
                
                statusPromises.push(statusPromise);
            });
            
            // Wait for all status checks to complete
            await Promise.all(statusPromises);
            setDevices(devicesList);
            setLoading(false);
        };

        const unsubscribe = onValue(devicesRef, handleValue, (error) => {
            setError(error);
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
            type: device.type || 'soil_sensor',
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