'use client';

import { useMemo } from 'react';
import { useWattage } from '@/hooks/use-wattage';

export type Remarks = 'normal' | 'unstable' | 'pilferage';

export interface PowerLossData {
    timestamp: number;
    time: string;

    // Total wattage per device (Wab + Wbc)
    pt: number;   // Transformer (measured)
    pn: number;   // New Building
    po: number;   // Old Building

    // Deviation: PT_measured − (PN + PO)
    deviation: number;
    remarks: Remarks;
}

interface UsePowerLossResult {
    latest: PowerLossData | null;
    loading: boolean;
    error: Error | null;
}

function computeRemarks(deviation: number): Remarks {
    const abs = Math.abs(deviation);
    if (abs === 0)      return 'normal';
    if (abs <= 10)      return 'unstable';
    return 'pilferage';
}

export function usePowerLoss(
    transformerId: string,
    newBuildingId: string,
    oldBuildingId: string,
): UsePowerLossResult {
    const { data: ptData, loading: l1, error: e1 } = useWattage(transformerId);
    const { data: pnData, loading: l2, error: e2 } = useWattage(newBuildingId);
    const { data: poData, loading: l3, error: e3 } = useWattage(oldBuildingId);

    const loading = l1 || l2 || l3;
    const error = e1 || e2 || e3;

    const latest = useMemo<PowerLossData | null>(() => {
        if (loading || !ptData || !pnData || !poData) return null;

        const pt = ptData.total;
        const pn = pnData.total;
        const po = poData.total;
        const deviation = pt - (pn + po);

        return {
            timestamp: Math.max(ptData.timestamp ?? 0, pnData.timestamp ?? 0, poData.timestamp ?? 0),
            time: new Date().toISOString(),
            pt,
            pn,
            po,
            deviation,
            remarks: computeRemarks(deviation),
        };
    }, [ptData, pnData, poData, loading]);

    return { latest, loading, error };
}