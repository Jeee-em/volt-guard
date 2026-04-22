"use client";

import { useDevice } from "@/context/DeviceContext";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Wifi, WifiOff, Wrench, MapPin } from "lucide-react";

export function DeviceSelector() {
    const {
        selectedDeviceId,
        setSelectedDevice,
        availableDevices,
        devicesLoading
    } = useDevice();

    if (devicesLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading devices...
            </div>
        );
    }

    if (availableDevices.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                No devices available
            </div>
        );
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <Wifi className="h-4 w-4 text-green-500" />;
            case 'inactive':
                return <WifiOff className="h-4 w-4 text-gray-400" />;
            case 'maintenance':
                return <Wrench className="h-4 w-4 text-yellow-500" />;
            default:
                return null;
        }
    };

    const selectedDevice = availableDevices.find(d => d.deviceId === selectedDeviceId);

    return (
        <div className="flex flex-col gap-2 w-full">
            <Select
                value={selectedDeviceId || ''}
                onValueChange={setSelectedDevice}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a device">
                        {selectedDevice && (
                            <div className="flex items-center gap-2 truncate">
                                {getStatusIcon(selectedDevice.status)}
                                <span className="font-medium truncate">{selectedDevice.name}</span>
                            </div>
                        )}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {availableDevices.map((device) => (
                        <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                        >
                            <div className="flex flex-col gap-1 py-1">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(device.status)}
                                    <span className="font-medium">{device.name}</span>
                                </div>
                                {device.location && (
                                    <span className="text-xs text-muted-foreground pl-5">
                                        {device.location}
                                    </span>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedDevice && selectedDevice.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 truncate">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{selectedDevice.location}</span>
                </div>
            )}
        </div>
    );
}
