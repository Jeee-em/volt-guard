'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataSnapshot, getDatabase, off, onValue, ref, remove, set, update } from 'firebase/database';
import { app } from '@/lib/firebase';
import type {
    AlertRule,
    RuleCondition,
    RuleFormDraft,
    RuleMetric,
    RuleSeverity,
} from '@/components/dashboard/alert-rules-manager';

interface UseAlertRulesResult {
    rules: AlertRule[];
    loading: boolean;
    saving: boolean;
    error: Error | null;
    addRule: (draft: RuleFormDraft) => Promise<void>;
    editRule: (id: string, draft: RuleFormDraft) => Promise<void>;
    deleteRule: (id: string) => Promise<void>;
    duplicateRule: (id: string) => Promise<void>;
    toggleRule: (id: string, enabled: boolean) => Promise<void>;
}

const RULE_METRICS: RuleMetric[] = ['voltage', 'current', 'power', 'power_loss', 'power_factor'];
const RULE_CONDITIONS: RuleCondition[] = ['above', 'below', 'equals'];
const RULE_SEVERITIES: RuleSeverity[] = ['critical', 'warning', 'info'];

function isRuleMetric(value: unknown): value is RuleMetric {
    return typeof value === 'string' && RULE_METRICS.includes(value as RuleMetric);
}

function isRuleCondition(value: unknown): value is RuleCondition {
    return typeof value === 'string' && RULE_CONDITIONS.includes(value as RuleCondition);
}

function isRuleSeverity(value: unknown): value is RuleSeverity {
    return typeof value === 'string' && RULE_SEVERITIES.includes(value as RuleSeverity);
}

function coerceNumber(value: unknown, fallback: number): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function createFallbackRule(id: string): AlertRule {
    const now = new Date().toISOString();
    return {
        id,
        name: 'Untitled rule',
        metric: 'voltage',
        condition: 'above',
        threshold: 0,
        severity: 'warning',
        enabled: true,
        createdAt: now,
        updatedAt: now,
    };
}

function normalizeRule(id: string, raw: unknown, fallback?: AlertRule): AlertRule {
    const base = fallback ?? createFallbackRule(id);
    const value = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};

    const metric = isRuleMetric(value.metric) ? value.metric : base.metric;
    const condition = isRuleCondition(value.condition) ? value.condition : base.condition;
    const severity = isRuleSeverity(value.severity) ? value.severity : base.severity;
    const threshold = coerceNumber(value.threshold, base.threshold);
    const enabled = typeof value.enabled === 'boolean' ? value.enabled : base.enabled;
    const name = typeof value.name === 'string' ? value.name : base.name;
    const createdAt = typeof value.createdAt === 'string' ? value.createdAt : base.createdAt;
    const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : base.updatedAt;

    return {
        id,
        name,
        metric,
        condition,
        threshold,
        severity,
        enabled,
        createdAt,
        updatedAt,
    };
}

function mergeRules(data: unknown, fallbackRules: AlertRule[]): AlertRule[] {
    if (!data) return fallbackRules;

    const fallbackMap = new Map(fallbackRules.map((rule) => [rule.id, rule]));
    const rules: AlertRule[] = [];

    if (Array.isArray(data)) {
        data.forEach((raw, index) => {
            const id = typeof raw?.id === 'string' ? raw.id : `rule-${index + 1}`;
            rules.push(normalizeRule(id, raw, fallbackMap.get(id)));
        });
    } else if (typeof data === 'object') {
        Object.entries(data as Record<string, unknown>).forEach(([id, raw]) => {
            rules.push(normalizeRule(id, raw, fallbackMap.get(id)));
        });
    }

    return rules.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export function useAlertRules(
    userId?: string | null,
    initialRules: AlertRule[] = []
): UseAlertRulesResult {
    const [rules, setRules] = useState<AlertRule[]>(initialRules);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const db = useMemo(() => getDatabase(app), []);

    useEffect(() => {
        if (!userId) {
            setRules(initialRules);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const rulesRef = ref(db, `user_alert_rules/${userId}`);

        const handleValue = (snapshot: DataSnapshot) => {
            setRules(mergeRules(snapshot.val(), initialRules));
            setLoading(false);
        };

        const unsubscribe = onValue(rulesRef, handleValue, (err) => {
            setError(err as Error);
            setLoading(false);
        });

        return () => {
            off(rulesRef, 'value', handleValue);
            unsubscribe();
        };
    }, [db, userId, initialRules]);

    const addRule = useCallback(
        async (draft: RuleFormDraft) => {
            if (!userId) return;
            setSaving(true);
            setError(null);
            try {
                const id = crypto.randomUUID();
                const now = new Date().toISOString();
                await set(ref(db, `user_alert_rules/${userId}/${id}`), {
                    ...draft,
                    createdAt: now,
                    updatedAt: now,
                });
            } catch (err) {
                setError(err as Error);
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [db, userId]
    );

    const editRule = useCallback(
        async (id: string, draft: RuleFormDraft) => {
            if (!userId) return;
            setSaving(true);
            setError(null);
            try {
                await update(ref(db, `user_alert_rules/${userId}/${id}`), {
                    ...draft,
                    updatedAt: new Date().toISOString(),
                });
            } catch (err) {
                setError(err as Error);
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [db, userId]
    );

    const deleteRule = useCallback(
        async (id: string) => {
            if (!userId) return;
            setSaving(true);
            setError(null);
            try {
                await remove(ref(db, `user_alert_rules/${userId}/${id}`));
            } catch (err) {
                setError(err as Error);
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [db, userId]
    );

    const duplicateRule = useCallback(
        async (id: string) => {
            if (!userId) return;
            const source = rules.find((rule) => rule.id === id);
            if (!source) return;

            setSaving(true);
            setError(null);
            try {
                const nextId = crypto.randomUUID();
                const now = new Date().toISOString();
                await set(ref(db, `user_alert_rules/${userId}/${nextId}`), {
                    name: `${source.name} (copy)`,
                    metric: source.metric,
                    condition: source.condition,
                    threshold: source.threshold,
                    severity: source.severity,
                    enabled: source.enabled,
                    createdAt: now,
                    updatedAt: now,
                });
            } catch (err) {
                setError(err as Error);
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [db, userId, rules]
    );

    const toggleRule = useCallback(
        async (id: string, enabled: boolean) => {
            if (!userId) return;
            setSaving(true);
            setError(null);
            try {
                await update(ref(db, `user_alert_rules/${userId}/${id}`), {
                    enabled,
                    updatedAt: new Date().toISOString(),
                });
            } catch (err) {
                setError(err as Error);
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [db, userId]
    );

    return {
        rules,
        loading,
        saving,
        error,
        addRule,
        editRule,
        deleteRule,
        duplicateRule,
        toggleRule,
    };
}
