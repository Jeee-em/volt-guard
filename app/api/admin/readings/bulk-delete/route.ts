import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getErrorMessage, requireSuperAdmin } from '@/lib/admin-auth';

const READINGS_PATH = 'admin_managed_readings';

export async function POST(request: Request) {
    try {
        await requireSuperAdmin();
        const body = await request.json().catch(() => null);
        const ids = Array.isArray(body?.ids)
            ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            : [];

        if (ids.length === 0) {
            return NextResponse.json({ error: 'No reading ids provided.' }, { status: 400 });
        }

        const updates: Record<string, null> = {};
        ids.forEach((id) => {
            updates[`${READINGS_PATH}/${id}`] = null;
        });

        await getAdminDb().ref().update(updates);
        return NextResponse.json({ ok: true, deleted: ids.length });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
