import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getErrorMessage, requireSuperAdmin } from '@/lib/admin-auth';

const READINGS_PATH = 'admin_managed_readings';
const ALLOWED_METRICS = ['voltage', 'current', 'power', 'power_loss', 'power_factor'] as const;
type AllowedMetric = (typeof ALLOWED_METRICS)[number];

interface ManagedReadingRecord {
    id: string;
    deviceId?: string;
    metric: AllowedMetric;
    value: number;
    unit?: string;
    recordedAt: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
}

interface ManagedReadingResponseRow {
    id: string;
    deviceId?: string;
    metric: AllowedMetric;
    value: number;
    unit?: string;
    recordedAt: string;
}

interface RawReadingRecord {
    timestamp?: string | number;
    total_power?: number;
    p1_voltage?: number;
    p2_voltage?: number;
    p3_voltage?: number;
    p1_current?: number;
    p2_current?: number;
    p3_current?: number;
    p1_power?: number;
    p2_power?: number;
    p3_power?: number;
    power_loss?: number;
    power_factor?: number;
}

function isAllowedMetric(metric: unknown): metric is AllowedMetric {
    return typeof metric === 'string' && (ALLOWED_METRICS as readonly string[]).includes(metric);
}

function normalizeUnit(metric: AllowedMetric, unit?: string): string {
    if (typeof unit === 'string' && unit.trim()) return unit.trim();
    if (metric === 'voltage') return 'V';
    if (metric === 'current') return 'A';
    if (metric === 'power' || metric === 'power_loss') return 'W';
    if (metric === 'power_factor') return 'pf';
    return '';
}

function toFinite(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function average(values: Array<number | null>): number | null {
    const valid = values.filter((value): value is number => value !== null);
    if (valid.length === 0) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeTimestamp(raw: unknown): string {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return new Date(raw).toISOString();
    }
    if (typeof raw === 'string') {
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) {
            return new Date(numeric).toISOString();
        }
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) {
            return new Date(parsed).toISOString();
        }
    }
    return new Date().toISOString();
}

function expandRawReading(raw: RawReadingRecord): Array<Omit<ManagedReadingRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>> {
    const recordedAt = normalizeTimestamp(raw.timestamp);

    const voltage = average([
        toFinite(raw.p1_voltage),
        toFinite(raw.p2_voltage),
        toFinite(raw.p3_voltage),
    ]);
    const current = average([
        toFinite(raw.p1_current),
        toFinite(raw.p2_current),
        toFinite(raw.p3_current),
    ]);
    const power = toFinite(raw.total_power) ?? average([
        toFinite(raw.p1_power),
        toFinite(raw.p2_power),
        toFinite(raw.p3_power),
    ]);
    const powerLoss = toFinite(raw.power_loss);
    const powerFactor = toFinite(raw.power_factor);

    const entries: Array<{ metric: AllowedMetric; value: number | null }> = [
        { metric: 'voltage', value: voltage },
        { metric: 'current', value: current },
        { metric: 'power', value: power },
        { metric: 'power_loss', value: powerLoss },
        { metric: 'power_factor', value: powerFactor },
    ];

    return entries
        .filter((entry): entry is { metric: AllowedMetric; value: number } => entry.value !== null)
        .map((entry) => ({
            deviceId: undefined,
            metric: entry.metric,
            value: entry.value,
            unit: normalizeUnit(entry.metric),
            recordedAt,
        }));
}

async function bootstrapManagedReadings(): Promise<ManagedReadingResponseRow[]> {
    const snapshot = await getAdminDb().ref('readings').get();
    const readingsByDevice = (snapshot.val() || {}) as Record<string, Record<string, RawReadingRecord>>;
    const expanded: Array<Omit<ManagedReadingRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>> = [];

    Object.entries(readingsByDevice).forEach(([deviceId, rowsByKey]) => {
        Object.values(rowsByKey || {}).forEach((raw) => {
            expanded.push(
                ...expandRawReading(raw).map((row) => ({
                    ...row,
                    deviceId,
                }))
            );
        });
    });

    const latest = expanded
        .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
        .slice(0, 1000);

    if (latest.length === 0) {
        return [];
    }

    const now = new Date().toISOString();
    const updates: Record<string, ManagedReadingRecord> = {};
    const responseRows: ManagedReadingResponseRow[] = [];

    latest.forEach((row) => {
        const id = randomUUID();
        const record: ManagedReadingRecord = {
            id,
            deviceId: row.deviceId,
            metric: row.metric,
            value: row.value,
            unit: row.unit,
            recordedAt: row.recordedAt,
            createdAt: now,
            updatedAt: now,
            createdBy: 'system-bootstrap',
            updatedBy: 'system-bootstrap',
        };
        updates[`${READINGS_PATH}/${id}`] = record;
        responseRows.push({
            id,
            deviceId: record.deviceId,
            metric: record.metric,
            value: record.value,
            unit: record.unit,
            recordedAt: record.recordedAt,
        });
    });

    await getAdminDb().ref().update(updates);
    return responseRows;
}

function validatePayload(input: unknown): { ok: true; deviceId?: string; metric: AllowedMetric; value: number; unit?: string; recordedAt: string } | { ok: false; error: string } {
    const payload = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId : undefined;
    const metric = payload.metric;
    const value = Number(payload.value);
    const unit = typeof payload.unit === 'string' ? payload.unit : undefined;
    const recordedAt = typeof payload.recordedAt === 'string' ? payload.recordedAt : '';

    if (!isAllowedMetric(metric)) {
        return { ok: false, error: 'Invalid metric.' };
    }
    if (!Number.isFinite(value)) {
        return { ok: false, error: 'Value must be a number.' };
    }
    const ts = Date.parse(recordedAt);
    if (!Number.isFinite(ts)) {
        return { ok: false, error: 'recordedAt must be a valid ISO date string.' };
    }

    return {
        ok: true,
        deviceId,
        metric,
        value,
        unit,
        recordedAt: new Date(ts).toISOString(),
    };
}

export async function GET(request: Request) {
    try {
        await requireSuperAdmin();
        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId')?.trim() || '';
        const snapshot = await getAdminDb().ref(READINGS_PATH).get();
        const data = (snapshot.val() || {}) as Record<string, ManagedReadingRecord>;

        let rows: ManagedReadingResponseRow[] = Object.entries(data)
            .map(([id, value]) => ({
                id,
                deviceId: value.deviceId,
                metric: value.metric,
                value: Number(value.value),
                unit: value.unit,
                recordedAt: value.recordedAt,
            }))
            .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));

        if (deviceId) {
            rows = rows.filter((row) => row.deviceId === deviceId);
        }

        if (rows.length === 0) {
            rows = await bootstrapManagedReadings();
            if (deviceId) {
                rows = rows.filter((row) => row.deviceId === deviceId);
            }
        }

        return NextResponse.json({ ok: true, records: rows });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await requireSuperAdmin();
        const body = await request.json().catch(() => null);
        const validated = validatePayload(body);
        if (!validated.ok) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const id = randomUUID();
        const now = new Date().toISOString();

        const record: ManagedReadingRecord = {
            id,
            deviceId: validated.deviceId,
            metric: validated.metric,
            value: validated.value,
            unit: normalizeUnit(validated.metric, validated.unit),
            recordedAt: validated.recordedAt,
            createdAt: now,
            updatedAt: now,
            createdBy: decoded.uid,
            updatedBy: decoded.uid,
        };

        await getAdminDb().ref(`${READINGS_PATH}/${id}`).set(record);
        return NextResponse.json({ ok: true, record: { id, deviceId: record.deviceId, metric: record.metric, value: record.value, unit: record.unit, recordedAt: record.recordedAt } }, { status: 201 });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
