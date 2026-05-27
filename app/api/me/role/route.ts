import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { ADMIN_USERS_PATH, isSuperAdminEmail, normalizeRole, type UserRole } from '@/lib/admin-users';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET() {
    try {
        const token = (await cookies()).get('token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = await getAdminAuth().verifyIdToken(token);
        if (!decoded.uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isSuperAdmin =
            decoded.superAdmin === true ||
            decoded.role === 'super_admin' ||
            isSuperAdminEmail(decoded.email);

        let role: UserRole = isSuperAdmin ? 'super_admin' : normalizeRole(decoded.role);

        if (!isSuperAdmin) {
            const profileSnapshot = await getAdminDb().ref(`${ADMIN_USERS_PATH}/${decoded.uid}/role`).get();
            const profileRole = profileSnapshot.val();
            role = normalizeRole(profileRole || decoded.role);
        }

        return NextResponse.json({ ok: true, role });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
