import { DeviceOverviewItem, DeviceStatusOverviewStrip } from '@/components/dashboard/device-status-overview-strip';
import React from 'react'

const DeviceManagement = () => {
    const devices: DeviceOverviewItem[] = [
        // Pair 1
        { id: 'esp32-1', type: 'esp32', status: 'online', activeAlerts: 0 },
        { id: 'cur-1', type: 'current_sensor', status: 'online', activeAlerts: 1 },
        { id: 'vol-1', type: 'voltage_sensor', status: 'online', activeAlerts: 0 },
        // Pair 2
        { id: 'esp32-2', type: 'esp32', status: 'online', activeAlerts: 0 },
        { id: 'cur-2', type: 'current_sensor', status: 'offline', activeAlerts: 0 },
        { id: 'vol-2', type: 'voltage_sensor', status: 'offline', activeAlerts: 0 },
        // Pair 3
        { id: 'esp32-3', type: 'esp32', status: 'maintenance', activeAlerts: 0 },
        { id: 'cur-3', type: 'current_sensor', status: 'maintenance', activeAlerts: 0 },
        { id: 'vol-3', type: 'voltage_sensor', status: 'online', activeAlerts: 0 },
    ];
    return (
        <div className='container mx-auto p-6 space-y-8'>
            <DeviceStatusOverviewStrip devices={devices} />
        </div>
    )
}

export default DeviceManagement