'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DataSnapshot,
    endAt,
    get,
    getDatabase,
    limitToLast,
    off,
    onValue,
    orderByChild,
    query,
    ref,
    remove,
    set,
    update,
} from 'firebase/database';
import { app } from '@/lib/firebase';
import type {
    NotificationItem,
    NotificationMetric,
    NotificationSeverity,
    NotificationStatus,
} from '@/components/dashboard/notification-feed';

interface StoredNotification extends NotificationItem {
    receivedAtMs: number;
}

interface UseNotificationsResult {
    notifications: NotificationItem[];
    loading: boolean;
    loadingMore: boolean;
    error: Error | null;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    addNotification: (item: Omit<NotificationItem, 'id'> & { receivedAtMs?: number }) => Promise<void>;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    dismissNotification: (id: string) => Promise<void>;
}

const SEVERITIES: NotificationSeverity[] = ['critical', 'warning', 'info'];
const STATUSES: NotificationStatus[] = ['unread', 'read'];
const METRICS: NotificationMetric[] = ['voltage', 'current', 'power', 'power_loss', 'power_factor'];

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_RETENTION_DAYS = 30;

function isSeverity(value: unknown): value is NotificationSeverity {
    return typeof value === 'string' && SEVERITIES.includes(value as NotificationSeverity);
}

function isStatus(value: unknown): value is NotificationStatus {
    return typeof value === 'string' && STATUSES.includes(value as NotificationStatus);
}

function isMetric(value: unknown): value is NotificationMetric {
    return typeof value === 'string' && METRICS.includes(value as NotificationMetric);
}

function coerceNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeNotification(id: string, raw: unknown): StoredNotification {
    const fallbackTime = new Date().toISOString();
    const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

    const receivedAt = typeof value.receivedAt === 'string' ? value.receivedAt : fallbackTime;
    const parsedMs = Date.parse(receivedAt);
    const receivedAtMs = coerceNumber(value.receivedAtMs, Number.isFinite(parsedMs) ? parsedMs : Date.now());

    return {
        id,
        severity: isSeverity(value.severity) ? value.severity : 'info',
        status: isStatus(value.status) ? value.status : 'unread',
        metric: isMetric(value.metric) ? value.metric : 'power',
        title: typeof value.title === 'string' ? value.title : 'Notification',
        description: typeof value.description === 'string' ? value.description : '',
        value: coerceNumber(value.value, 0),
        unit: typeof value.unit === 'string' ? value.unit : '',
        threshold: coerceNumber(value.threshold, 0),
        ruleName: typeof value.ruleName === 'string' ? value.ruleName : 'Rule',
        ruleId: typeof value.ruleId === 'string' ? value.ruleId : undefined,
        receivedAt,
        analyticsHref: typeof value.analyticsHref === 'string' ? value.analyticsHref : '/dashboard/analytics',
        receivedAtMs,
    };
}

function mergeNotifications(data: unknown): StoredNotification[] {
    if (!data) return [];

    const results: StoredNotification[] = [];

    if (Array.isArray(data)) {
        data.forEach((raw, index) => {
            const id = typeof raw?.id === 'string' ? raw.id : `notification-${index + 1}`;
            results.push(normalizeNotification(id, raw));
        });
    } else if (typeof data === 'object') {
        Object.entries(data as Record<string, unknown>).forEach(([id, raw]) => {
            results.push(normalizeNotification(id, raw));
        });
    }

    return results.sort((a, b) => b.receivedAtMs - a.receivedAtMs);
}

function mergeUniqueNotifications(latest: StoredNotification[], existing: NotificationItem[]): StoredNotification[] {
    const map = new Map<string, StoredNotification>();
    latest.forEach((item) => map.set(item.id, item));
    existing.forEach((item) => {
        if (!map.has(item.id)) {
            const stored = item as StoredNotification;
            const parsed = Date.parse(item.receivedAt);
            const receivedAtMs = Number.isFinite(stored.receivedAtMs)
                ? stored.receivedAtMs
                : Number.isFinite(parsed)
                ? parsed
                : Date.now();
            map.set(item.id, {
                ...item,
                receivedAtMs: Number.isFinite(receivedAtMs) ? receivedAtMs : Date.now(),
            });
        }
    });
    return Array.from(map.values()).sort((a, b) => b.receivedAtMs - a.receivedAtMs);
}

export function useNotifications(
    userId?: string | null,
    options: { pageSize?: number; retentionDays?: number } = {}
): UseNotificationsResult {
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [cursor, setCursor] = useState<number | null>(null);

    const db = useMemo(() => getDatabase(app), []);
    const cleanupDoneRef = useRef(false);

    useEffect(() => {
        cleanupDoneRef.current = false;
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            setLoading(false);
            setHasMore(false);
            setCursor(null);
            return;
        }

        setLoading(true);
        setError(null);

        const notificationsRef = ref(db, `user_notifications/${userId}`);
        const latestQuery = query(
            notificationsRef,
            orderByChild('receivedAtMs'),
            limitToLast(pageSize)
        );

        const handleValue = (snapshot: DataSnapshot) => {
            const latest = mergeNotifications(snapshot.val());
            setNotifications((prev) => {
                const merged = mergeUniqueNotifications(latest, prev);
                const oldest = merged[merged.length - 1];
                setCursor(oldest ? oldest.receivedAtMs : null);
                setHasMore(latest.length >= pageSize);
                return merged;
            });
            setLoading(false);
        };

        const unsubscribe = onValue(latestQuery, handleValue, (err) => {
            setError(err as Error);
            setLoading(false);
        });

        return () => {
            off(latestQuery, 'value', handleValue);
            unsubscribe();
        };
    }, [db, pageSize, userId]);

    useEffect(() => {
        if (!userId || cleanupDoneRef.current) return;
        cleanupDoneRef.current = true;

        const cleanupOld = async () => {
            const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
            const notificationsRef = ref(db, `user_notifications/${userId}`);
            const oldQuery = query(
                notificationsRef,
                orderByChild('receivedAtMs'),
                endAt(cutoff)
            );
            const snapshot = await get(oldQuery);
            const deletions: Promise<void>[] = [];
            snapshot.forEach((child) => {
                deletions.push(remove(child.ref));
            });
            if (deletions.length > 0) {
                await Promise.all(deletions);
            }
        };

        cleanupOld().catch((err) => {
            setError(err as Error);
        });
    }, [db, retentionDays, userId]);

    const loadMore = useCallback(async () => {
        if (!userId || loadingMore || !hasMore || cursor === null) return;
        setLoadingMore(true);
        setError(null);
        try {
            const notificationsRef = ref(db, `user_notifications/${userId}`);
            const olderQuery = query(
                notificationsRef,
                orderByChild('receivedAtMs'),
                endAt(cursor - 1),
                limitToLast(pageSize)
            );
            const snapshot = await get(olderQuery);
            const older = mergeNotifications(snapshot.val());
            setNotifications((prev) => {
                const merged = mergeUniqueNotifications(older, prev);
                const oldest = merged[merged.length - 1];
                setCursor(oldest ? oldest.receivedAtMs : null);
                return merged;
            });
            setHasMore(older.length >= pageSize);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, db, hasMore, loadingMore, pageSize, userId]);

    const addNotification = useCallback(
        async (item: Omit<NotificationItem, 'id'> & { receivedAtMs?: number }) => {
            if (!userId) return;
            setError(null);

            const id = crypto.randomUUID();
            const parsed = Date.parse(item.receivedAt);
            const receivedAtMs = Number.isFinite(item.receivedAtMs)
                ? item.receivedAtMs
                : Number.isFinite(parsed)
                ? parsed
                : Date.now();
            const receivedAt = item.receivedAt ?? new Date(receivedAtMs).toISOString();

            await set(ref(db, `user_notifications/${userId}/${id}`), {
                ...item,
                receivedAt,
                receivedAtMs,
            });
        },
        [db, userId]
    );

    const markRead = useCallback(
        async (id: string) => {
            if (!userId) return;
            setError(null);
            await update(ref(db, `user_notifications/${userId}/${id}`), {
                status: 'read',
            });
        },
        [db, userId]
    );

    const markAllRead = useCallback(async () => {
        if (!userId) return;
        const updates: Record<string, unknown> = {};
        notifications.forEach((item) => {
            if (item.status === 'unread') {
                updates[`user_notifications/${userId}/${item.id}/status`] = 'read';
            }
        });
        if (Object.keys(updates).length === 0) return;
        setError(null);
        await update(ref(db), updates);
    }, [db, notifications, userId]);

    const dismissNotification = useCallback(
        async (id: string) => {
            if (!userId) return;
            setError(null);
            await remove(ref(db, `user_notifications/${userId}/${id}`));
        },
        [db, userId]
    );

    return {
        notifications,
        loading,
        loadingMore,
        error,
        hasMore,
        loadMore,
        addNotification,
        markRead,
        markAllRead,
        dismissNotification,
    };
}
