'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAlertRules } from '@/hooks/use-alert-rules';
import { useNotifications } from '@/hooks/use-notifications';
import { useSensorData, type PowerReading } from '@/hooks/use-sensor-data';
import { useThresholds } from '@/hooks/use-thresholds';
import { useToast } from '@/hooks/use-toast';
import { MuteDuration, MuteState, NotificationCenterHeader } from '@/components/dashboard/notification-center-header';
import {
  AlertRule,
  AlertRulesManager,
  RuleFormDraft,
  RuleCondition,
  RuleMetric,
} from '@/components/dashboard/alert-rules-manager';
import { NotificationFeed, NotificationItem } from '@/components/dashboard/notification-feed';
import { NotificationPreferences, NotificationPreferencesPanel } from '@/components/dashboard/notification-preference-panel';
import { NotificationStatsItem, NotificationStatsStrip } from '@/components/dashboard/notification-stats-strip';
import { getThresholdForSeverity } from '@/lib/thresholds';

function buildDefaultPrefs(email: string): NotificationPreferences {
  return {
    matrix: {
      critical: { in_app: true, email: true, sms: false },
      warning: { in_app: true, email: true, sms: false },
      info: { in_app: true, email: false, sms: false },
    },
    quietHours: {
      enabled: true,
      from: '22:00',
      to: '07:00',
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    contact: {
      email,
      phone: '',
    },
  };
}

const RULE_METRIC_META: Record<RuleMetric, { label: string; unit: string }> = {
  voltage: { label: 'Voltage', unit: 'V' },
  current: { label: 'Current', unit: 'A' },
  power: { label: 'Power', unit: 'W' },
  power_loss: { label: 'Power Loss', unit: 'W' },
  power_factor: { label: 'Power Factor', unit: 'pf' },
};

const CONDITION_LABELS: Record<RuleCondition, string> = {
  above: 'above',
  below: 'below',
  equals: 'equal to',
};

function getReadingTimestamp(reading: PowerReading): number {
  const numeric = Number(reading.timestamp);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(reading.timestamp);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function getMetricValue(metric: RuleMetric, reading: PowerReading): number | null {
  const avg = (a: number, b: number, c: number) => {
    const values = [a, b, c].filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    const nonZero = values.filter((value) => Math.abs(value) > 1e-9);
    const source = nonZero.length ? nonZero : values;
    return source.reduce((sum, value) => sum + value, 0) / source.length;
  };

  if (metric === 'voltage') return avg(reading.p1_voltage, reading.p2_voltage, reading.p3_voltage);
  if (metric === 'current') return avg(reading.p1_current, reading.p2_current, reading.p3_current);
  if (metric === 'power') {
    if (Number.isFinite(reading.total_power)) return reading.total_power;
    return avg(reading.p1_power, reading.p2_power, reading.p3_power);
  }
  return null;
}

function isConditionMet(value: number, condition: RuleCondition, threshold: number): boolean {
  if (condition === 'above') return value > threshold;
  if (condition === 'below') return value < threshold;
  return Math.abs(value - threshold) <= 0.01;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Please try again.';
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: sensorData } = useSensorData();
  const { thresholds } = useThresholds(user?.uid);

  const currentThreshold = getThresholdForSeverity('current', 'critical', thresholds);

  const defaultRules = useMemo<AlertRule[]>(() => [
    {
      id: 'rule-current-critical',
      name: 'High current alert',
      metric: 'current',
      condition: 'above',
      threshold: currentThreshold,
      severity: 'critical',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ], [currentThreshold]);

  const {
    rules,
    loading: rulesLoading,
    saving: rulesSaving,
    error: rulesError,
    addRule,
    editRule,
    deleteRule,
    duplicateRule,
    toggleRule,
  } = useAlertRules(user?.uid, defaultRules);
  const latestReading = useMemo(() => {
    if (!sensorData.length) return null;
    return sensorData[sensorData.length - 1];
  }, [sensorData]);
  const lastTriggeredRef = useRef<Record<string, boolean>>({});
  const [muteState, setMuteState] = useState<MuteState>({
    muted: false,
    until: null,
  });
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  const {
    notifications,
    loading: notificationsLoading,
    loadingMore,
    hasMore,
    loadMore,
    addNotification,
    markRead,
    markAllRead,
    dismissNotification,
  } = useNotifications(user?.uid);

  const [isSaving, setIsSaving] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (!user?.uid) {
        setPreferences(buildDefaultPrefs(user?.email ?? ''));
        setPreferencesLoading(false);
        return;
      }

      setPreferencesLoading(true);

      try {
        const response = await fetch('/api/preferences', {
          method: 'GET',
          credentials: 'same-origin',
        });

        const raw = await response.text();
        let payload: { ok?: boolean; prefs?: NotificationPreferences; error?: string } | null = null;

        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch {
          payload = null;
        }

        if (!response.ok) {
          throw new Error(payload?.error || raw || 'Failed to load preferences.');
        }

        if (!cancelled) {
          setPreferences(payload?.prefs ?? buildDefaultPrefs(user?.email ?? ''));
        }
      } catch {
        if (!cancelled) {
          setPreferences(buildDefaultPrefs(user?.email ?? ''));
        }
      } finally {
        if (!cancelled) {
          setPreferencesLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email]);

  const handleSave = useCallback(async (prefs: NotificationPreferences) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(prefs),
      });

      const raw = await response.text();
      let payload: { ok?: boolean; error?: string } | null = null;

      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || raw || 'Failed to save preferences.');
      }

      setPreferences(prefs);
      toast({
        title: 'Preferences saved',
        description: 'Notification settings were updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Failed to save preferences',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const handleSendEmail = useCallback(async (id: string) => {
    if (!user?.email) {
      toast({
        title: 'Email not available',
        description: 'Sign in with Google to send notification emails.',
        variant: 'destructive',
      });
      return;
    }

    setSendingEmailId(id);
    try {
      console.log('[send-email] starting request', { id, uid: user.uid, email: user.email });
      const response = await fetch(`/api/notifications/${id}/send-email`, {
        method: 'POST',
        credentials: 'same-origin',
      });

      const raw = await response.text();
      let payload: { ok?: boolean; error?: string; email?: string; sentAt?: string } | null = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch (parseError) {
        console.error('[send-email] non-json response', { status: response.status, raw });
      }

      console.log('[send-email] response', {
        status: response.status,
        ok: response.ok,
        payload,
      });

      if (!response.ok) {
        throw new Error(payload?.error || raw || 'Failed to send email.');
      }

      toast({
        title: 'Email sent',
        description: `Sent to ${payload?.email || user.email}.`,
      });
    } catch (err) {
      console.error('[send-email] request failed', err);
      toast({
        title: 'Failed to send email',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setSendingEmailId(null);
    }
  }, [toast, user?.email]);

  const handleAddRule = useCallback(async (draft: RuleFormDraft) => {
    try {
      await addRule(draft);
      toast({
        title: 'Rule added',
        description: draft.name ? `"${draft.name}" is now active.` : 'Rule created successfully.',
      });
    } catch (err) {
      toast({
        title: 'Failed to add rule',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  }, [addRule, toast]);

  const handleEditRule = useCallback(async (id: string, draft: RuleFormDraft) => {
    const name = draft.name || rules.find((rule) => rule.id === id)?.name || 'Rule';
    try {
      await editRule(id, draft);
      toast({
        title: 'Rule updated',
        description: `"${name}" saved successfully.`,
      });
    } catch (err) {
      toast({
        title: 'Failed to update rule',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  }, [editRule, rules, toast]);

  const handleDeleteRule = useCallback(async (id: string) => {
    const name = rules.find((rule) => rule.id === id)?.name || 'Rule';
    try {
      await deleteRule(id);
      toast({
        title: 'Rule deleted',
        description: `"${name}" removed.`,
      });
    } catch (err) {
      toast({
        title: 'Failed to delete rule',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  }, [deleteRule, rules, toast]);

  const handleDuplicateRule = useCallback(async (id: string) => {
    const name = rules.find((rule) => rule.id === id)?.name || 'Rule';
    try {
      await duplicateRule(id);
      toast({
        title: 'Rule duplicated',
        description: `"${name}" copied.`,
      });
    } catch (err) {
      toast({
        title: 'Failed to duplicate rule',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  }, [duplicateRule, rules, toast]);

  const handleToggleRule = useCallback(async (id: string, enabled: boolean) => {
    const name = rules.find((rule) => rule.id === id)?.name || 'Rule';
    try {
      await toggleRule(id, enabled);
      toast({
        title: enabled ? 'Rule enabled' : 'Rule disabled',
        description: `"${name}" is now ${enabled ? 'active' : 'inactive'}.`,
      });
    } catch (err) {
      toast({
        title: 'Failed to update rule',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  }, [toggleRule, rules, toast]);

  const handleMute = useCallback((duration: MuteDuration) => {
    setMuteState({
      muted: true,
      until: duration === -1
        ? null
        : new Date(Date.now() + duration * 60_000),
    });
  }, []);

  const handleUnmute = useCallback(() => {
    setMuteState({ muted: false, until: null });
  }, []);

  const lastNotifiedByRule = useMemo(() => {
    const map = new Map<string, number>();
    notifications.forEach((item) => {
      const key = item.ruleId ?? item.ruleName;
      if (!key) return;
      const ts = Date.parse(item.receivedAt);
      if (!Number.isFinite(ts)) return;
      const existing = map.get(key) ?? 0;
      if (ts > existing) map.set(key, ts);
    });
    return map;
  }, [notifications]);

  const handleDismissNotification = useCallback(async (id: string) => {
    try {
      await dismissNotification(id);
      toast({
        title: 'Notification deleted',
        description: 'The notification was removed.',
      });
    } catch (err) {
      toast({
        title: 'Failed to delete notification',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  }, [dismissNotification, toast]);

  useEffect(() => {
    if (!latestReading) return;

    const readingTs = getReadingTimestamp(latestReading);
    const triggeredState: Record<string, boolean> = { ...lastTriggeredRef.current };
    const newNotifications: Array<Omit<NotificationItem, 'id'> & { receivedAtMs?: number }> = [];

    rules.forEach((rule) => {
      if (!rule.enabled) {
        triggeredState[rule.id] = false;
        return;
      }

      const value = getMetricValue(rule.metric, latestReading);
      if (value === null) {
        triggeredState[rule.id] = false;
        return;
      }

      const isTriggered = isConditionMet(value, rule.condition, rule.threshold);
      const wasTriggered = lastTriggeredRef.current[rule.id] ?? false;
      triggeredState[rule.id] = isTriggered;

      if (!isTriggered || wasTriggered) return;

      const lastNotified = lastNotifiedByRule.get(rule.id) ?? lastNotifiedByRule.get(rule.name) ?? 0;
      if (lastNotified >= readingTs) return;

      const metricMeta = RULE_METRIC_META[rule.metric];
      const label = metricMeta.label;
      const unit = metricMeta.unit;
      const conditionLabel = CONDITION_LABELS[rule.condition];

      newNotifications.push({
        severity: rule.severity,
        status: 'unread',
        metric: rule.metric,
        title: `${label} alert triggered`,
        description: `${label} is ${conditionLabel} ${rule.threshold} ${unit}. Current reading: ${value.toFixed(2)} ${unit}.`,
        value,
        unit,
        threshold: rule.threshold,
        ruleName: rule.name,
        ruleId: rule.id,
        receivedAt: new Date(readingTs).toISOString(),
        analyticsHref: `/dashboard/analytics?t=${encodeURIComponent(new Date(readingTs).toISOString())}`,
        receivedAtMs: readingTs,
      });
    });

    lastTriggeredRef.current = triggeredState;
    if (newNotifications.length > 0) {
      newNotifications.forEach((item) => {
        void addNotification(item).catch((err) => {
          toast({
            title: 'Failed to save notification',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        });
      });
    }
  }, [addNotification, lastNotifiedByRule, latestReading, rules, toast]);

  const statsItems: NotificationStatsItem[] = notifications.map((n) => ({
    id: n.id,
    severity: n.severity,
    status: n.status,
    receivedAt: n.receivedAt,
    // resolvedAt: n.resolvedAt,   // optional
  }));

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === 'unread').length,
    [notifications]
  );

  const severityCounts = useMemo(() => {
    return notifications.reduce(
      (acc, item) => {
        if (item.status === 'unread') {
          acc[item.severity] += 1;
        }
        return acc;
      },
      { critical: 0, warning: 0, info: 0 }
    );
  }, [notifications]);

  const lastReceivedAt = notifications[0]?.receivedAt ?? null;
  const latestNotification = notifications[0] ?? null;

  return (
    <div className='container mx-auto p-6 space-y-8'>
      {/* <NotificationCenterHeader
        unreadCount={unreadCount}
        severityCounts={severityCounts}
        muteState={muteState}
        lastReceivedAt={lastReceivedAt}
        onMarkAllRead={markAllRead}
        onMute={handleMute}
        onUnmute={handleUnmute}
        onOpenSettings={() => console.log('open settings')}
      /> */}

      <AlertRulesManager
        rules={rules}
        loading={rulesLoading}
        saving={rulesSaving}
        error={rulesError?.message ?? null}
        onAdd={handleAddRule}
        onEdit={handleEditRule}
        onDelete={handleDeleteRule}
        onDuplicate={handleDuplicateRule}
        onToggle={handleToggleRule}
      />

      <NotificationFeed
        notifications={notifications}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onDismiss={handleDismissNotification}
        loading={notificationsLoading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />

      {preferencesLoading || !preferences ? (
        <div className="rounded-xl border border-border bg-background px-4 py-6 text-sm text-muted-foreground">
          Loading notification preferences...
        </div>
      ) : (
        <NotificationPreferencesPanel
          initial={preferences}
          recipientEmail={user?.email ?? ''}
          latestNotificationId={latestNotification?.id}
          latestNotificationTitle={latestNotification?.title}
          canSendLatest={Boolean(latestNotification)}
          onSendLatestEmail={latestNotification ? () => handleSendEmail(latestNotification.id) : undefined}
          isSendingEmail={sendingEmailId === latestNotification?.id}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {/* <NotificationStatsStrip notifications={statsItems} windowDays={7} /> */}
    </div>
  );
}
