import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
    ADMIN_INVITES_PATH,
    ADMIN_USERS_PATH,
    buildAvatarColor,
    isSuperAdminEmail,
    isValidEmail,
    normalizeRole,
    normalizeStatus,
    type AdminInviteRecord,
    type AdminUserProfile,
    type UserRole,
    type UserStatus,
} from '@/lib/admin-users';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

async function requireAdminToken() {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
        throw new Error('Unauthorized');
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const isSuperAdmin =
        decoded.superAdmin === true ||
        decoded.role === 'super_admin' ||
        isSuperAdminEmail(decoded.email);
    const role = isSuperAdmin ? 'super_admin' : normalizeRole(decoded.role);
    if (!decoded.uid || (role !== 'super_admin' && role !== 'admin')) {
        throw new Error('Forbidden');
    }

    return {
        decoded,
        role,
        isSuperAdmin: role === 'super_admin',
    };
}

async function getAuthUserById(userId: string) {
    try {
        return await getAdminAuth().getUser(userId);
    } catch (error) {
        return null;
    }
}

async function loadProfile(userId: string) {
    const snapshot = await getAdminDb().ref(`${ADMIN_USERS_PATH}/${userId}`).get();
    return snapshot.val() as AdminUserProfile & { email?: string; source?: string } | null;
}

async function loadInvite(userId: string) {
    const snapshot = await getAdminDb().ref(`${ADMIN_INVITES_PATH}/${userId}`).get();
    return snapshot.val() as AdminInviteRecord | null;
}

function countSuperAdmins(users: Array<{ role: UserRole; status: UserStatus }>): number {
    return users.filter((user) => user.role === 'super_admin' && user.status !== 'suspended').length;
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ userId: string }> },
) {
    try {
        const { decoded, isSuperAdmin } = await requireAdminToken();
        const { userId } = await params;
        const body = await request.json().catch(() => null);
        const nextRole = body?.role ? normalizeRole(body.role) : null;
        const nextStatus = body?.status ? normalizeStatus(body.status) : null;

        if (!userId) {
            return NextResponse.json({ error: 'Missing user id.' }, { status: 400 });
        }

        if (userId === decoded.uid) {
            return NextResponse.json({ error: 'You cannot modify your own account from this screen.' }, { status: 400 });
        }

        if (nextRole && !isSuperAdmin) {
            return NextResponse.json({ error: 'Only super admins can assign roles.' }, { status: 403 });
        }

        const authUser = await getAuthUserById(userId);
        const profile = await loadProfile(userId);
        const invite = await loadInvite(userId);

        if (!authUser && !invite && !profile) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        if (authUser) {
            const currentRole = normalizeRole(profile?.role || authUser.customClaims?.role);
            const currentStatus: UserStatus = authUser.disabled ? 'suspended' : normalizeStatus(profile?.status || 'active');

            if (nextRole === 'super_admin' && !isSuperAdminEmail(authUser.email) && decoded.uid !== authUser.uid) {
                return NextResponse.json({ error: 'Only bootstrap superadmin accounts can be elevated to super_admin.' }, { status: 403 });
            }

            if (currentRole === 'super_admin' && nextRole && nextRole !== 'super_admin') {
                const existingUsers = await Promise.all([
                    getAdminAuth().listUsers(1000),
                    getAdminDb().ref(ADMIN_USERS_PATH).get(),
                ]);
                const dbProfiles = (existingUsers[1].val() || {}) as Record<string, AdminUserProfile & { email?: string }>; 
                const authUsers = existingUsers[0].users.map((user) => ({
                    role: normalizeRole(dbProfiles[user.uid]?.role || user.customClaims?.role),
                    status: user.disabled ? 'suspended' : normalizeStatus(dbProfiles[user.uid]?.status || 'active'),
                }));
                if (countSuperAdmins(authUsers) <= 1) {
                    return NextResponse.json({ error: 'At least one superadmin must remain.' }, { status: 400 });
                }
            }

            if (nextRole) {
                await getAdminAuth().setCustomUserClaims(userId, {
                    ...(authUser.customClaims || {}),
                    role: nextRole,
                    superAdmin: nextRole === 'super_admin',
                });
            }

            if (nextStatus) {
                await getAdminAuth().updateUser(userId, { disabled: nextStatus === 'suspended' });
            }

            const updatedProfile = {
                name: profile?.name || authUser.displayName || authUser.email?.split('@')[0] || 'User',
                email: authUser.email || profile?.email || '',
                role: nextRole || currentRole,
                status: nextStatus || currentStatus,
                avatarColor: profile?.avatarColor || buildAvatarColor(authUser.uid),
                joinedAt: profile?.joinedAt || authUser.metadata.creationTime || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'auth',
            };

            await getAdminDb().ref(`${ADMIN_USERS_PATH}/${userId}`).set(updatedProfile);
            return NextResponse.json({ ok: true, user: { id: userId, ...updatedProfile, lastLoginAt: authUser.metadata.lastSignInTime || null } });
        }

        if (invite) {
            const nextInvite = {
                ...invite,
                role: nextRole || invite.role,
                status: nextStatus || invite.status,
                updatedAt: new Date().toISOString(),
            };
            await getAdminDb().ref(`${ADMIN_INVITES_PATH}/${userId}`).set(nextInvite);
            return NextResponse.json({
                ok: true,
                user: nextInvite,
            });
        }

        return NextResponse.json({ error: 'User record is not editable.' }, { status: 400 });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ userId: string }> },
) {
    try {
        const { decoded, isSuperAdmin } = await requireAdminToken();
        const { userId } = await params;

        if (!isSuperAdmin) {
            return NextResponse.json({ error: 'Only super admins can remove users.' }, { status: 403 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'Missing user id.' }, { status: 400 });
        }

        if (userId === decoded.uid) {
            return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
        }

        const authUser = await getAuthUserById(userId);
        const profile = await loadProfile(userId);
        const invite = await loadInvite(userId);

        if (!authUser && !invite && !profile) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        if (authUser) {
            const existing = await getAdminAuth().listUsers(1000);
            const dbSnapshot = await getAdminDb().ref(ADMIN_USERS_PATH).get();
            const profiles = (dbSnapshot.val() || {}) as Record<string, AdminUserProfile & { email?: string }>;
            const resolvedUsers = existing.users.map((user) => ({
                role: normalizeRole(profiles[user.uid]?.role || user.customClaims?.role),
                status: user.disabled ? 'suspended' : normalizeStatus(profiles[user.uid]?.status || 'active'),
            }));
            if (authUser.customClaims?.role === 'super_admin' || profile?.role === 'super_admin') {
                if (countSuperAdmins(resolvedUsers) <= 1) {
                    return NextResponse.json({ error: 'At least one superadmin must remain.' }, { status: 400 });
                }
            }

            await Promise.all([
                getAdminAuth().deleteUser(userId),
                getAdminDb().ref(`${ADMIN_USERS_PATH}/${userId}`).remove(),
            ]);
            return NextResponse.json({ ok: true });
        }

        if (invite) {
            await getAdminDb().ref(`${ADMIN_INVITES_PATH}/${userId}`).remove();
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: 'User record is not editable.' }, { status: 400 });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
