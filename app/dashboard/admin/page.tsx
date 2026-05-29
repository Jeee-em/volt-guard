'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDevice } from '@/context/DeviceContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
    InviteDraft,
    SystemUser,
    UserManagementTable,
    UserRole,
    UserStatus,
} from '@/components/dashboard/user-management-table';
import { ReadingsManagementTable } from '@/components/dashboard/readings-management-table';
import { useThresholds } from '@/hooks/use-thresholds';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Please try again.';
}

export default function AdminPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { selectedDeviceId } = useDevice();
    const { toast } = useToast();
    const { thresholds } = useThresholds(user?.uid);

    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const currentUserId = user?.uid ?? '';
    const currentUserRole = users.find((entry) => entry.id === currentUserId)?.role;
    const isSuperAdmin = currentUserRole === 'super_admin';

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/users', {
                method: 'GET',
                credentials: 'same-origin',
            });
            const raw = await response.text();
            let payload: { ok?: boolean; users?: SystemUser[]; error?: string } | null = null;

            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }

            if (!response.ok) {
                throw new Error(payload?.error || raw || 'Failed to load users.');
            }

            setUsers(payload?.users ?? []);
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        if (authLoading) return;
        if (!user) {
            setUserRole(null);
            setRoleLoading(false);
            return;
        }

        const loadRole = async () => {
            setRoleLoading(true);
            try {
                const response = await fetch('/api/me/role', {
                    method: 'GET',
                    credentials: 'same-origin',
                });
                if (!response.ok) {
                    throw new Error('Forbidden');
                }

                const payload = (await response.json()) as { role?: UserRole };
                if (!mounted) return;

                const resolvedRole = payload.role ?? 'engineer';
                setUserRole(resolvedRole);
                if (resolvedRole === 'engineer') {
                    router.replace('/dashboard');
                    return;
                }
                await loadUsers();
            } catch {
                if (mounted) {
                    setUserRole('engineer');
                    router.replace('/dashboard');
                }
            } finally {
                if (mounted) {
                    setRoleLoading(false);
                }
            }
        };

        void loadRole();

        return () => {
            mounted = false;
        };
    }, [authLoading, user, router, loadUsers]);

    const apiAction = useCallback(async (url: string, init: RequestInit, successTitle: string, successDescription: string) => {
        setBusyId(url);
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                ...init,
            });
            const raw = await response.text();
            let payload: { ok?: boolean; error?: string } | null = null;

            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }

            if (!response.ok) {
                throw new Error(payload?.error || raw || 'Request failed.');
            }

            toast({
                title: successTitle,
                description: successDescription,
            });
            await loadUsers();
        } catch (err) {
            toast({
                title: 'Action failed',
                description: getErrorMessage(err),
                variant: 'destructive',
            });
        } finally {
            setBusyId((current) => (current === url ? null : current));
        }
    }, [loadUsers, toast]);

    const handleInvite = useCallback(async (draft: InviteDraft) => {
        await apiAction(
            '/api/admin/users',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: draft.email,
                    role: draft.role,
                }),
            },
            'Invite created',
            `Invited ${draft.email} as ${draft.role}.`,
        );
    }, [apiAction]);

    const handleRoleChange = useCallback(async (id: string, role: UserRole) => {
        await apiAction(
            `/api/admin/users/${id}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            },
            'Role updated',
            `User role changed to ${role.replace('_', ' ')}.`,
        );
    }, [apiAction]);

    const handleSuspend = useCallback(async (id: string) => {
        await apiAction(
            `/api/admin/users/${id}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'suspended' satisfies UserStatus }),
            },
            'User suspended',
            'The account has been suspended.',
        );
    }, [apiAction]);

    const handleUnsuspend = useCallback(async (id: string) => {
        await apiAction(
            `/api/admin/users/${id}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' satisfies UserStatus }),
            },
            'User unsuspended',
            'The account is active again.',
        );
    }, [apiAction]);

    const handleRemove = useCallback(async (id: string) => {
        await apiAction(
            `/api/admin/users/${id}`,
            {
                method: 'DELETE',
            },
            'User removed',
            'The user record was removed.',
        );
    }, [apiAction]);

    const isReady = useMemo(() => !authLoading && !loading && !roleLoading, [authLoading, loading, roleLoading]);

    return (
        <div className='container mx-auto p-6 space-y-8'>
            {error ? (
                <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : !isReady ? (
                <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    Loading users...
                </div>
            ) : userRole === 'engineer' ? (
                <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    Redirecting...
                </div>
            ) : (
                <>
                    <UserManagementTable
                        users={users}
                        currentUserId={currentUserId}
                        onInvite={handleInvite}
                        onRoleChange={handleRoleChange}
                        onSuspend={handleSuspend}
                        onUnsuspend={handleUnsuspend}
                        onRemove={handleRemove}
                        isInviting={Boolean(busyId === '/api/admin/users')}
                    />
                    {isSuperAdmin && (
                        <ReadingsManagementTable
                            thresholds={thresholds}
                            isSuperAdmin={isSuperAdmin}
                            deviceId={selectedDeviceId}
                        />
                    )}
                </>
            )}
        </div>
    );
}