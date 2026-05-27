import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getErrorMessage, requireSuperAdmin } from '@/lib/admin-auth';

const READINGS_PATH = 'admin_managed_readings';
const ALLOWED_METRICS = ['voltage', 'current', 'power', 'power_loss', 'power_factor'] as const;
type AllowedMetric = (typeof ALLOWED_METRICS)[number];

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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ readingId: string }> },
) {
    try {
        const decoded = await requireSuperAdmin();
        const { readingId } = await params;
        if (!readingId) {
            return NextResponse.json({ error: 'Missing reading id.' }, { status: 400 });
        }

        const body = await request.json().catch(() => null);
        const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

        const metric = payload.metric;
        const value = Number(payload.value);
        const unit = typeof payload.unit === 'string' ? payload.unit : undefined;
        const recordedAtRaw = typeof payload.recordedAt === 'string' ? payload.recordedAt : '';
        const parsedAt = Date.parse(recordedAtRaw);

        if (!isAllowedMetric(metric)) {
            return NextResponse.json({ error: 'Invalid metric.' }, { status: 400 });
        }
        if (!Number.isFinite(value)) {
            return NextResponse.json({ error: 'Value must be a number.' }, { status: 400 });
        }
        if (!Number.isFinite(parsedAt)) {
            return NextResponse.json({ error: 'recordedAt must be a valid ISO date string.' }, { status: 400 });
        }

        const rowRef = getAdminDb().ref(`${READINGS_PATH}/${readingId}`);
        const exists = await rowRef.get();
        if (!exists.exists()) {
            return NextResponse.json({ error: 'Reading not found.' }, { status: 404 });
        }

        await rowRef.update({
            metric,
            value,
            unit: normalizeUnit(metric, unit),
            recordedAt: new Date(parsedAt).toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: decoded.uid,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ readingId: string }> },
) {
    try {
        await requireSuperAdmin();
        const { readingId } = await params;
        if (!readingId) {
            return NextResponse.json({ error: 'Missing reading id.' }, { status: 400 });
        }

        const rowRef = getAdminDb().ref(`${READINGS_PATH}/${readingId}`);
        const exists = await rowRef.get();
        if (!exists.exists()) {
            return NextResponse.json({ error: 'Reading not found.' }, { status: 404 });
        }

        await rowRef.remove();
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
