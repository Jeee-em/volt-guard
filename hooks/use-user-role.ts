'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export type UserRole = 'super_admin' | 'admin' | 'engineer';

export function useUserRole(): {
  role: UserRole | null;
  loading: boolean;
  isSuperAdmin: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadRole = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/me/role', {
          method: 'GET',
          credentials: 'same-origin',
        });
        if (!response.ok) {
          throw new Error('Failed to load role');
        }
        const payload = (await response.json()) as { role?: UserRole };
        if (mounted) {
          setRole(payload.role ?? 'engineer');
        }
      } catch {
        if (mounted) setRole('engineer');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadRole();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  return {
    role,
    loading: authLoading || loading,
    isSuperAdmin: role === 'super_admin',
  };
}
