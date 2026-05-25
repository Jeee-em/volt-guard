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
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

    // Initialize from localStorage and auto-select first device
    useEffect(() => {
        if (loading) return;

        const stored = localStorage.getItem(STORAGE_KEY);

        if (devices.length === 0) {
            if (stored && stored !== selectedDeviceId) {
                setSelectedDeviceId(stored);
            }
            return;
        }

        // Try to get from localStorage
        console.log('🔄 DeviceContext - Available devices:', devices.map(d => d.deviceId));
        console.log('💾 DeviceContext - Stored device from localStorage:', stored);

        if (stored) {
            const deviceExists = devices.some(d => d.deviceId === stored);
            if (deviceExists) {
                console.log('✅ DeviceContext - Using stored device:', stored);
                setSelectedDeviceId(stored);
                return;
            } else {
                console.log('⚠️ DeviceContext - Stored device not found, will auto-select');
            }
        }

        const firstActiveDevice = devices.find(d => d.status === 'active');
        if (firstActiveDevice) {
            setSelectedDeviceId(firstActiveDevice.deviceId);
            localStorage.setItem(STORAGE_KEY, firstActiveDevice.deviceId);
        } else if (devices.length > 0) {
            setSelectedDeviceId(devices[0].deviceId);
            localStorage.setItem(STORAGE_KEY, devices[0].deviceId);
        }
    }, [devices, loading, selectedDeviceId]);

    const setSelectedDevice = (deviceId: string) => {
        console.log('📱 DeviceContext - Setting device to:', deviceId);
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