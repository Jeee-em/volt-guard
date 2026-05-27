import { randomUUID } from 'crypto';
import type admin from 'firebase-admin';

export type UserRole = 'super_admin' | 'admin' | 'engineer';
export type UserStatus = 'active' | 'suspended' | 'invited';

export interface SystemUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    lastLoginAt: string | null;
    joinedAt: string;
    avatarColor: string;
}

export interface InviteDraft {
    email: string;
    role: UserRole;
}

export interface AdminUserProfile {
    name?: string;
    role?: UserRole;
    status?: UserStatus;
    avatarColor?: string;
    joinedAt?: string;
}

export interface AdminInviteRecord extends InviteDraft {
    id: string;
    name: string;
    status: 'invited';
    lastLoginAt: null;
    joinedAt: string;
    avatarColor: string;
    invitedAt: string;
    invitedBy?: string;
}

const DEFAULT_AVATAR_COLORS = ['#1D9E75', '#378ADD', '#BA7517', '#9B4EEB', '#D85A30'];
const DEFAULT_ROLE: UserRole = 'engineer';
const ADMIN_SUPERADMIN_EMAILS = parseEmailList(
    process.env.ADMIN_SUPERADMIN_EMAILS || process.env.SUPERADMIN_EMAIL || '',
);

export function parseEmailList(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}

export function isSuperAdminEmail(email?: string | null): boolean {
    return Boolean(email && ADMIN_SUPERADMIN_EMAILS.includes(email.toLowerCase()));
}

export function normalizeRole(role: unknown): UserRole {
    if (role === 'super_admin' || role === 'admin' || role === 'engineer') {
        return role;
    }
    if (role === 'viewer') {
        return 'engineer';
    }
    return DEFAULT_ROLE;
}

export function normalizeStatus(status: unknown): UserStatus {
    if (status === 'active' || status === 'suspended' || status === 'invited') {
        return status;
    }
    return 'active';
}

export function getDefaultRole(): UserRole {
    return DEFAULT_ROLE;
}

export function buildAvatarColor(seed: string): string {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
    }
    return DEFAULT_AVATAR_COLORS[Math.abs(hash) % DEFAULT_AVATAR_COLORS.length];
}

export function getDisplayName(email: string, fallback?: string | null): string {
    if (fallback && fallback.trim()) return fallback.trim();
    return email.split('@')[0] || 'User';
}

export function buildUserFromAuth(
    user: admin.auth.UserRecord,
    profile?: AdminUserProfile,
): SystemUser {
    const email = user.email || `${user.uid}@unknown.local`;
    const invitedOverride = normalizeStatus(profile?.status);
    const role = isSuperAdminEmail(email)
        ? 'super_admin'
        : normalizeRole(profile?.role ?? user.customClaims?.role);

    return {
        id: user.uid,
        name: getDisplayName(email, profile?.name || user.displayName),
        email,
        role,
        status: user.disabled ? 'suspended' : invitedOverride === 'invited' ? 'active' : normalizeStatus(profile?.status || 'active'),
        lastLoginAt: profile?.joinedAt ? user.metadata.lastSignInTime ?? null : user.metadata.lastSignInTime ?? null,
        joinedAt: profile?.joinedAt || user.metadata.creationTime || new Date().toISOString(),
        avatarColor: profile?.avatarColor || buildAvatarColor(user.uid || email),
    };
}

export function buildInviteRecord(
    email: string,
    role: UserRole = DEFAULT_ROLE,
    invitedBy?: string,
): AdminInviteRecord {
    const now = new Date().toISOString();
    return {
        id: `invite_${randomUUID()}`,
        email,
        name: getDisplayName(email),
        role: normalizeRole(role),
        status: 'invited',
        lastLoginAt: null,
        joinedAt: now,
        avatarColor: buildAvatarColor(email),
        invitedAt: now,
        invitedBy,
    };
}

export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const ADMIN_USERS_PATH = 'admin_user_profiles';
export const ADMIN_INVITES_PATH = 'admin_user_invites';
