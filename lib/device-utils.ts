import type { Device } from '@/hooks/use-devices';

export interface PowerLossDeviceIds {
  device1Id: string;
  device2Id: string;
  device3Id: string;
}

const STATUS_RANK: Record<Device['status'], number> = {
  active: 0,
  maintenance: 1,
  inactive: 2,
};

export function selectPowerLossDeviceIds(
  devices: Device[],
  selectedDeviceId: string | null | undefined,
  fallback: PowerLossDeviceIds
): PowerLossDeviceIds {
  const candidates = devices.filter(
    (device) => !device.type || device.type === 'power_monitor'
  );

  const sorted = [...candidates].sort((a, b) => {
    const rankA = STATUS_RANK[a.status] ?? 3;
    const rankB = STATUS_RANK[b.status] ?? 3;
    if (rankA !== rankB) return rankA - rankB;
    const nameA = (a.name ?? '').toLowerCase();
    const nameB = (b.name ?? '').toLowerCase();
    if (nameA && nameB && nameA !== nameB) return nameA.localeCompare(nameB);
    return a.deviceId.localeCompare(b.deviceId);
  });

  const selected = selectedDeviceId
    ? sorted.find((device) => device.deviceId === selectedDeviceId)
    : undefined;

  const ordered = selected
    ? [selected, ...sorted.filter((device) => device.deviceId !== selected.deviceId)]
    : sorted;

  const ids = ordered.map((device) => device.deviceId);

  return {
    device1Id: ids[0] ?? fallback.device1Id,
    device2Id: ids[1] ?? fallback.device2Id,
    device3Id: ids[2] ?? fallback.device3Id,
  };
}
