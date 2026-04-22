import React from 'react';

// 1. Strictly type the expected data payload
interface ElectricalData {
    power: number;
    current: number;
    voltage: number;
}

// 2. Define the component props
interface ElectricalMetricsCardProps {
    data: ElectricalData;
}

export default function ElectricalMetricsCard({ data }: ElectricalMetricsCardProps) {
    return (
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">

            {/* Card Header */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                    System Metrics
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Live electrical output and consumption
                </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-4 divide-x divide-neutral-100 dark:divide-neutral-800">

                {/* Power Metric */}
                <div className="flex flex-col items-center justify-center px-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Power
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            {data.power}
                        </span>
                        <span className="text-sm font-medium text-neutral-500">W</span>
                    </div>
                </div>

                {/* Current Metric */}
                <div className="flex flex-col items-center justify-center px-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Current
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            {data.current}
                        </span>
                        <span className="text-sm font-medium text-neutral-500">A</span>
                    </div>
                </div>

                {/* Voltage Metric */}
                <div className="flex flex-col items-center justify-center px-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Voltage
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            {data.voltage}
                        </span>
                        <span className="text-sm font-medium text-neutral-500">V</span>
                    </div>
                </div>

            </div>
        </div>
    );
}