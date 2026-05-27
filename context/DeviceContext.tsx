"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDevices, Device } from '../hooks/use-devices';

interface DeviceContextType {
    selectedDeviceId: string | null;
    setSelectedDevice: (deviceId: string) => void;
    availableDevices: Device[];
    devicesLoading: boolean;
    devicesError: Error | null;
    selectedDevice: Device | null;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

const STORAGE_KEY = 'berrymax_selected_device';

export function DeviceProvider({ children }: { children: ReactNode }) {
    const { devices, loading, error } = useDevices();
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(STORAGE_KEY);
    });

    // Initialize from localStorage and auto-select first device
    useEffect(() => {
        if (loading) return;

        if (devices.length === 0) {
            return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        const selectedExists = selectedDeviceId ? devices.some((device) => device.deviceId === selectedDeviceId) : false;

        if (selectedExists) {
            if (stored !== selectedDeviceId) {
                localStorage.setItem(STORAGE_KEY, selectedDeviceId as string);
            }
            return;
        }

        if (stored) {
            const storedExists = devices.some((device) => device.deviceId === stored);
            if (storedExists) {
                setSelectedDeviceId(stored);
                return;
            }
        }

        const firstActiveDevice = devices.find((device) => device.status === 'active');
        const fallbackDevice = firstActiveDevice ?? devices[0];
        if (fallbackDevice) {
            setSelectedDeviceId(fallbackDevice.deviceId);
            localStorage.setItem(STORAGE_KEY, fallbackDevice.deviceId);
        }
    }, [devices, loading, selectedDeviceId]);

    const setSelectedDevice = (deviceId: string) => {
        setSelectedDeviceId(deviceId);
        localStorage.setItem(STORAGE_KEY, deviceId);
    };

    const selectedDevice = selectedDeviceId 
        ? devices.find(d => d.deviceId === selectedDeviceId) || null
        : null;

    const value: DeviceContextType = {
        selectedDeviceId,
        setSelectedDevice,
        availableDevices: devices,
        devicesLoading: loading,
        devicesError: error,
        selectedDevice,
    };

    return (
        <DeviceContext.Provider value={value}>
            {children}
        </DeviceContext.Provider>
    );
}

export function useDevice() {
    const context = useContext(DeviceContext);
    if (context === undefined) {
        throw new Error('useDevice must be used within a DeviceProvider');
    }
    return context;
}