import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
    ADMIN_INVITES_PATH,
    ADMIN_USERS_PATH,
    buildInviteRecord,
    buildUserFromAuth,
    getDefaultRole,
    isSuperAdminEmail,
    isValidEmail,
    normalizeRole,
    normalizeStatus,
    type AdminInviteRecord,
    type AdminUserProfile,
    type SystemUser,
    type UserRole,
    type UserStatus,
} from '@/lib/admin-users';

type AuthToken = Awaited<ReturnType<ReturnType<typeof getAdminAuth>['verifyIdToken']>>;

type UserRecordSnapshot = Record<string, AdminUserProfile & { email?: string; status?: UserStatus; role?: UserRole }>;

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

async function requireAdminToken(): Promise<AuthToken> {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
        throw new Error('Unauthorized');
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const isSuperByEmail = isSuperAdminEmail(decoded.email);
    const role = isSuperByEmail
        ? 'super_admin'
        : (decoded.superAdmin === true ? 'super_admin' : normalizeRole(decoded.role));

    if (!decoded.uid || (role !== 'super_admin' && role !== 'admin')) {
        throw new Error('Forbidden');
    }

    return decoded;
}

async function listAllAuthUsers() {
    const users = [] as Awaited<ReturnType<typeof getAdminAuth>['listUsers']> extends Promise<infer T> ? T['users'] : never;
    let pageToken: string | undefined = undefined;

    do {
        const result = await getAdminAuth().listUsers(1000, pageToken);
        users.push(...result.users);
        pageToken = result.pageToken || undefined;
    } while (pageToken);

    return users;
}

async function syncBootstrapSuperAdmins(authUsers: Awaited<ReturnType<typeof listAllAuthUsers>>) {
    const updates: Promise<unknown>[] = [];

    for (const user of authUsers) {
        if (!isSuperAdminEmail(user.email)) continue;
        const now = user.metadata.creationTime || new Date().toISOString();
        updates.push(
            getAdminDb().ref(`${ADMIN_USERS_PATH}/${user.uid}`).update({
                name: user.displayName || user.email?.split('@')[0] || 'Super Admin',
                email: user.email,
                role: 'super_admin',
                status: user.disabled ? 'suspended' : 'active',
                lastLoginAt: user.metadata.lastSignInTime || null,
                joinedAt: now,
                avatarColor: '#7C3AED',
                source: 'auth',
                updatedAt: new Date().toISOString(),
            }),
        );
        updates.push(getAdminAuth().setCustomUserClaims(user.uid, { role: 'super_admin', superAdmin: true }));
    }

    await Promise.all(updates);
}

async function loadProfiles() {
    const snapshot = await getAdminDb().ref(ADMIN_USERS_PATH).get();
    return (snapshot.val() || {}) as UserRecordSnapshot;
}

async function loadInvites() {
    const snapshot = await getAdminDb().ref(ADMIN_INVITES_PATH).get();
    return (snapshot.val() || {}) as Record<string, AdminInviteRecord>;
}

async function buildUsers(): Promise<SystemUser[]> {
    const [authUsers, profiles, invites] = await Promise.all([
        listAllAuthUsers(),
        loadProfiles(),
        loadInvites(),
    ]);

    await syncBootstrapSuperAdmins(authUsers);

    const usersByEmail = new Map<string, SystemUser>();
    const usersByUid = new Map<string, SystemUser>();

    for (const user of authUsers) {
        const profile = profiles[user.uid];
        const systemUser = buildUserFromAuth(user, profile);
        usersByEmail.set(systemUser.email.toLowerCase(), systemUser);
        usersByUid.set(systemUser.id, systemUser);
    }

    for (const invite of Object.values(invites)) {
        if (usersByEmail.has(invite.email.toLowerCase())) continue;
        usersByEmail.set(invite.email.toLowerCase(), {
            id: invite.id,
            name: invite.name,
            email: invite.email,
            role: normalizeRole(invite.role || getDefaultRole()),
            status: normalizeStatus(invite.status),
            lastLoginAt: null,
            joinedAt: invite.joinedAt,
            avatarColor: invite.avatarColor,
        });
    }

    return Array.from(usersByEmail.values()).sort((a, b) => {
        const roleOrder = (role: UserRole) => ({ super_admin: 0, admin: 1, engineer: 2 }[role]);
        const roleDelta = roleOrder(a.role) - roleOrder(b.role);
        if (roleDelta !== 0) return roleDelta;
        return a.name.localeCompare(b.name);
    });
}

export async function GET() {
    try {
        await requireAdminToken();
        const users = await buildUsers();
        return NextResponse.json({ ok: true, users });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await requireAdminToken();
        const body = await request.json().catch(() => null);
        const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
        const role = normalizeRole(body?.role);

        if (!email || !isValidEmail(email)) {
            return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
        }

        try {
            const existing = await getAdminAuth().getUserByEmail(email);
            if (existing) {
                return NextResponse.json({ error: 'User already exists.' }, { status: 409 });
            }
        } catch (error) {
            const message = getErrorMessage(error);
            if (!message.includes('no user record found')) {
                throw error;
            }
        }

        const invite = buildInviteRecord(email, role, decoded.uid);
        await getAdminDb().ref(`${ADMIN_INVITES_PATH}/${invite.id}`).set({
            ...invite,
            source: 'invite',
        });

        return NextResponse.json({ ok: true, user: invite }, { status: 201 });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
