import type { ChartDataPoint } from '@/components/dashboard/sensor-chart-shared';
import type { PowerLossReading } from '@/hooks/use-power-loss';
import type { PowerReading } from '@/hooks/use-sensor-data';

function toBucket(ts: number, bucketMs: number) {
  return Math.floor(ts / bucketMs) * bucketMs;
}

function average(values: Array<number | undefined>) {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return 0;
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
  losses: PowerLossReading[],
  bucketMs: number
): ChartDataPoint[] {
  if (readings.length === 0) return [];

  const lossMap = new Map<number, number>();
  losses.forEach((loss) => {
    lossMap.set(loss.bucketTs, loss.total_loss);
  });

  const sorted = [...readings].sort(
    (a, b) => Number(a.timestamp) - Number(b.timestamp)
  );

  return sorted.flatMap((reading) => {
    const ts = Number(reading.timestamp);
    if (!Number.isFinite(ts)) return [];

    const avgVoltage = average([reading.p1_voltage, reading.p2_voltage, reading.p3_voltage]);
    const avgCurrent = average([reading.p1_current, reading.p2_current, reading.p3_current]);
    const totalPower = Number.isFinite(reading.total_power)
      ? reading.total_power
      : reading.p1_power + reading.p2_power + reading.p3_power;

    const bucket = toBucket(ts, bucketMs);
    const powerLoss = lossMap.get(bucket);

    return [
      {
        timestamp: ts,
        time: formatTimeLabel(ts),
        voltage: round(avgVoltage, 2),
        current: round(avgCurrent, 2),
        power: Math.round(totalPower),
        power_loss: typeof powerLoss === 'number' ? round(powerLoss, 1) : undefined,
      },
    ];
  });
}
