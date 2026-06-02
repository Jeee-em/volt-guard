import type { ChartDataPoint } from '@/components/dashboard/sensor-chart-shared';
import type { PowerLossReading } from '@/hooks/use-power-loss';
import type { PowerReading } from '@/hooks/use-sensor-data';

function toBucket(ts: number, bucketMs: number) {
  return Math.floor(ts / bucketMs) * bucketMs;
}

function average(values: Array<number | undefined>, options?: { ignoreZero?: boolean }) {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return 0;

  if (options?.ignoreZero) {
    const nonZero = valid.filter((v) => Math.abs(v) > 1e-9);
    if (nonZero.length > 0) {
      return nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length;
    }
  }

  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatTimeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function buildSensorChartData(
  readings: PowerReading[],
  losses: PowerLossReading[] = [], // Default to an empty array
  bucketMs: number
): ChartDataPoint[] {
  if (readings.length === 0) return [];

  const lossMap = new Map<number, number>();
  
  // Safely fallback to an empty array in case undefined is passed
  (losses || []).forEach((loss) => {
    // Handle the transition from bucketTs to timestamp
    // We bucket the timestamp here so it maps correctly to the readings below
    const ts = (loss as any).bucketTs ?? loss.timestamp;
    lossMap.set(toBucket(ts, bucketMs), loss.total_loss);
  });

  const sorted = [...readings].sort(
    (a, b) => Number(a.timestamp) - Number(b.timestamp)
  );

  return sorted.flatMap((reading) => {
    const ts = Number(reading.timestamp);
    if (!Number.isFinite(ts)) return [];

    const avgVoltage = average([reading.p1_voltage, reading.p2_voltage, reading.p3_voltage], { ignoreZero: true });
    const avgCurrent = average([reading.p1_current, reading.p2_current, reading.p3_current], { ignoreZero: true });
    const totalPower = Number.isFinite(reading.total_power)
      ? reading.total_power
      : reading.p1_power + reading.p2_power + reading.p3_power;

    const bucket = toBucket(ts, bucketMs);
    const powerLoss = lossMap.get(bucket);

    return [
      {
        timestamp: ts,
        time: formatTimeLabel(ts),
        p1_voltage: reading.p1_voltage,
        p1_current: reading.p1_current,
        p1_power: reading.p1_power,
        p2_voltage: reading.p2_voltage,
        p2_current: reading.p2_current,
        p2_power: reading.p2_power,
        p3_voltage: reading.p3_voltage,
        p3_current: reading.p3_current,
        p3_power: reading.p3_power,
        total_power: totalPower,
        voltage: round(avgVoltage, 2),
        current: round(avgCurrent, 2),
        power: Math.round(totalPower),
        power_loss: typeof powerLoss === 'number' ? round(powerLoss, 1) : undefined,
      },
    ];
  });
}
