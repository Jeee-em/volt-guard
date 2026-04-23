// app/admin/page.tsx
'use client';

import { InviteDraft, SystemUser, UserManagementTable } from '@/components/dashboard/user-management-table';
import { useState, useCallback } from 'react';


const AVATAR_COLORS = ['#1D9E75', '#378ADD', '#BA7517', '#9B4EEB', '#D85A30'];

export default function AdminPage() {
    const [users, setUsers] = useState<SystemUser[]>([
        {
            id: '1', name: 'Maria Santos', email: 'maria@example.com',
            role: 'super_admin', status: 'active',
            lastLoginAt: new Date().toISOString(),
            joinedAt: '2024-01-10T00:00:00Z',
            avatarColor: '#1D9E75',
        },
    ]);

    const handleInvite = useCallback((draft: InviteDraft) => {
        setUsers((prev) => [...prev, {
            id: crypto.randomUUID(),
            name: draft.email.split('@')[0],
            email: draft.email,
            role: draft.role,
            status: 'invited',
            lastLoginAt: null,
            joinedAt: new Date().toISOString(),
            avatarColor: AVATAR_COLORS[prev.length % AVATAR_COLORS.length],
        }]);
    }, []);

    return (
        <div className='container mx-auto p-6 space-y-8'>
            <UserManagementTable
                users={users}
                currentUserId="1"
                onInvite={handleInvite}
                onRoleChange={(id, role) =>
                    setUsers((prev) => prev.map((u) =>
                        u.id === id ? { ...u, role } : u
                    ))
                }
                onSuspend={(id) =>
                    setUsers((prev) => prev.map((u) =>
                        u.id === id ? { ...u, status: 'suspended' } : u
                    ))
                }
                onUnsuspend={(id) =>
                    setUsers((prev) => prev.map((u) =>
                        u.id === id ? { ...u, status: 'active' } : u
                    ))
                }
                onRemove={(id) =>
                    setUsers((prev) => prev.filter((u) => u.id !== id))
                }
            />
        </div>
    );
}