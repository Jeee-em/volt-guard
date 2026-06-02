import { Metadata } from "next";
import { PowerLossView } from "@/components/dashboard/power-loss-view";

export const metadata: Metadata = {
    title: "Power Loss Monitor - VoltGuard",
    description: "Monitor real-time power loss between transformer and buildings",
};

export default function PowerLossPage() {
    // Replace these with the actual device IDs from your Firebase Realtime Database
    const TRANSFORMER_DEVICE_ID = "power_monitor_01"; // Device 1
    const NEW_BUILDING_DEVICE_ID = "power_monitor_02"; // Device 2
    const OLD_BUILDING_DEVICE_ID = "power_monitor_03"; // Device 3

    return (
        <div className="flex flex-col gap-6 p-6">
            <PowerLossView 
                transformerId={TRANSFORMER_DEVICE_ID}
                newBuildingId={NEW_BUILDING_DEVICE_ID}
                oldBuildingId={OLD_BUILDING_DEVICE_ID}
            />
        </div>
    );
}