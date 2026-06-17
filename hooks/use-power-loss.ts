'use client';

import { useMemo } from 'react';
import { useWattage } from '@/hooks/use-wattage';
import { useThresholds } from '@/hooks/use-thresholds';
import { getPowerDistributionRemarks, type PowerDistributionRemarks } from '@/lib/thresholds';

export type Remarks = PowerDistributionRemarks;

export interface PowerLossData {
    timestamp: number;
    time: string;
    pt: number;         // Transformer total (Wab + Wbc)
    pn: number;         // New Building total
    po: number;         // Old Building total
    deviation: number;  // PT_measured − (PN + PO)
    remarks: Remarks;
}

interface UsePowerLossResult {
    latest: PowerLossData | null;
    loading: boolean;
    error: Error | null;
}

export function usePowerLoss(
    transformerId: string,
    newBuildingId: string,
    oldBuildingId: string,
    userId?: string,
): UsePowerLossResult {
    const { data: ptData, loading: l1, error: e1 } = useWattage(transformerId);
    const { data: pnData, loading: l2, error: e2 } = useWattage(newBuildingId);
    const { data: poData, loading: l3, error: e3 } = useWattage(oldBuildingId);

    // Uses the same Firebase path as the rest of the app: user_thresholds/{userId}
    const { thresholds } = useThresholds(userId);

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
            remarks: getPowerDistributionRemarks(deviation, thresholds),
        };
    }, [ptData, pnData, poData, loading, thresholds]);

    return { latest, loading, error };
}