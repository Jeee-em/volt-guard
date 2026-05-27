import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';
import { isSuperAdminEmail, normalizeRole, type UserRole } from '@/lib/admin-users';

export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

export async function requireSuperAdmin() {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
        throw new Error('Unauthorized');
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const hasSuperAdminClaim = decoded.superAdmin === true || decoded.role === 'super_admin';
    if (!decoded.uid || (!hasSuperAdminClaim && !isSuperAdminEmail(decoded.email))) {
        throw new Error('Forbidden');
    }

    return decoded;
}

export async function requireAdminRole() {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
        throw new Error('Unauthorized');
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const isSuperByEmail = isSuperAdminEmail(decoded.email);
    const claimRole = decoded.superAdmin === true ? 'super_admin' : normalizeRole(decoded.role);
    const role: UserRole = isSuperByEmail ? 'super_admin' : claimRole;

    if (!decoded.uid || (role !== 'super_admin' && role !== 'admin')) {
        throw new Error('Forbidden');
    }

    return {
        decoded,
        role,
        isSuperAdmin: role === 'super_admin',
    };
}
