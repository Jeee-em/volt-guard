'use client';

import { useMemo } from 'react';
import { useSensorData, PowerReading } from './use-sensor-data';

export interface PowerLossReading {
    bucketTs: number;       // Bucketed timestamp (nearest minute)
    skewMs: number;         // Max timestamp skew across the 3 devices for this bucket
    p1_loss: number;        // Phase 1 loss in W
    p2_loss: number;        // Phase 2 loss in W
    p3_loss: number;        // Phase 3 loss in W
    total_loss: number;     // Sum of all phase losses
}

interface UsePowerLossOptions {
    /** Bucket size in milliseconds. Default: 60_000 (1 minute) */
    bucketMs?: number;
    /** How many readings to fetch per device */
    limit?: number;
}

interface UsePowerLossResult {
    losses: PowerLossReading[];
    latest: PowerLossReading | null;
    loading: boolean;
    error: Error | null;
}

/** Round a timestamp down to the nearest bucket boundary */
function toBucket(ts: number, bucketMs: number): number {
    return Math.floor(ts / bucketMs) * bucketMs;
}

function buildBucketMap(readings: PowerReading[], bucketMs: number): Map<number, PowerReading> {
    const map = new Map<number, PowerReading>();
    readings.forEach(r => {
        const bucket = toBucket(Number(r.timestamp), bucketMs);
        // Keep the reading closest to the bucket boundary
        const existing = map.get(bucket);
        if (!existing) {
            map.set(bucket, r);
        } else {
            const existingDist = Math.abs(Number(existing.timestamp) - bucket);
            const newDist = Math.abs(Number(r.timestamp) - bucket);
            if (newDist < existingDist) map.set(bucket, r);
        }
    });
    return map;
}

/**
 * Computes per-phase power loss across 3 power monitor devices.
 *
 * Formula:
 *   P1 loss = device1.p1_power − (device2.p1_power + device3.p1_power)
 *   P2 loss = device1.p2_power − (device2.p2_power + device3.p2_power)
 *   P3 loss = device1.p3_power − (device2.p3_power + device3.p3_power)
 *
 * Readings are matched by bucketing timestamps to the nearest `bucketMs` window.
 */
export function usePowerLoss(
    device1Id: string,
    device2Id: string,
    device3Id: string,
    { bucketMs = 60_000, limit = 200 }: UsePowerLossOptions = {}
): UsePowerLossResult {
    const { data: d1, loading: l1, error: e1 } = useSensorData(device1Id, limit);
    const { data: d2, loading: l2, error: e2 } = useSensorData(device2Id, limit);
    const { data: d3, loading: l3, error: e3 } = useSensorData(device3Id, limit);

    const loading = l1 || l2 || l3;
    const error = e1 || e2 || e3;

    const losses = useMemo<PowerLossReading[]>(() => {
        if (loading || !d1.length || !d2.length || !d3.length) return [];

        const map1 = buildBucketMap(d1, bucketMs);
        const map2 = buildBucketMap(d2, bucketMs);
        const map3 = buildBucketMap(d3, bucketMs);

        const result: PowerLossReading[] = [];

        // Only compute loss for buckets where all 3 devices have data
        map1.forEach((r1, bucket) => {
            const r2 = map2.get(bucket);
            const r3 = map3.get(bucket);
            if (!r2 || !r3) return;

            const skewMs = Math.max(
                Math.abs(Number(r1.timestamp) - bucket),
                Math.abs(Number(r2.timestamp) - bucket),
                Math.abs(Number(r3.timestamp) - bucket),
            );

            result.push({
                bucketTs: bucket,
                skewMs,
                p1_loss: r1.p1_power - (r2.p1_power + r3.p1_power),
                p2_loss: r1.p2_power - (r2.p2_power + r3.p2_power),
                p3_loss: r1.p3_power - (r2.p3_power + r3.p3_power),
                total_loss:
                    (r1.p1_power - (r2.p1_power + r3.p1_power)) +
                    (r1.p2_power - (r2.p2_power + r3.p2_power)) +
                    (r1.p3_power - (r2.p3_power + r3.p3_power)),
            });
        });

        // Sort oldest → newest
        result.sort((a, b) => a.bucketTs - b.bucketTs);
        return result;
    }, [d1, d2, d3, loading, bucketMs]);

    return {
        losses,
        latest: losses.length ? losses[losses.length - 1] : null,
        loading,
        error,
    };
}