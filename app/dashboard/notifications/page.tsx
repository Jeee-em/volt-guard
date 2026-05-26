'use client';

import { useState, useMemo } from 'react';
import { useSensorData } from '@/hooks/useSensorData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Bell,
} from 'lucide-react';
import { useCallback } from 'react';
import { MuteDuration, MuteState, NotificationCenterHeader } from '@/components/dashboard/notification-center-header';
import { AlertRule, AlertRulesManager, RuleFormDraft } from '@/components/dashboard/alert-rules-manager';
import { NotificationFeed, NotificationItem } from '@/components/dashboard/notification-feed';
import { NotificationPreferences, NotificationPreferencesPanel } from '@/components/dashboard/notification-preference-panel';
import { NotificationStatsItem, NotificationStatsStrip } from '@/components/dashboard/notification-stats-strip';
import { getMetricLabel, getMetricUnit, getThresholdForSeverity } from '@/lib/thresholds';

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  timestamp: number;
  sensor: string;
  read: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  matrix: {
    critical: { in_app: true, email: true, sms: true },
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
    email: 'engineer@example.com',
    phone: '+63 912 345 6789',
  },
};

export default function NotificationsPage() {
  const currentThreshold = getThresholdForSeverity('current', 'critical');
  const currentUnit = getMetricUnit('current');
  const currentLabel = getMetricLabel('current');

  const [rules, setRules] = useState<AlertRule[]>(() => [
    {
      id: '1',
      name: 'High current alert',
      metric: 'current',
      condition: 'above',
      threshold: currentThreshold,
      severity: 'critical',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [muteState, setMuteState] = useState<MuteState>({
    muted: false,
    until: null,
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => [
    {
      id: '1',
      severity: 'critical',
      status: 'unread',
      metric: 'current',
      title: 'Current spike detected',
      description: `${currentLabel} exceeded critical threshold of ${currentThreshold} ${currentUnit}. Immediate inspection recommended.`,
      value: Number((currentThreshold + 1.4).toFixed(1)),
      unit: currentUnit,
      threshold: currentThreshold,
      ruleName: 'High current alert',
      receivedAt: new Date().toISOString(),
      analyticsHref: '/analytics?t=2025-04-22T14:03:11Z',
    },
  ]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async (prefs: NotificationPreferences) => {
    setIsSaving(true);
    await fetch('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
    setIsSaving(false);
  }, []);

  const handleAdd = useCallback((draft: RuleFormDraft) => {
    setRules((prev) => [...prev, {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]);
  }, []);

  const handleEdit = useCallback((id: string, draft: RuleFormDraft) => {
    setRules((prev) => prev.map((r) =>
      r.id === id ? { ...r, ...draft, updatedAt: new Date().toISOString() } : r
    ));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleDuplicate = useCallback((id: string) => {
    const source = rules.find((r) => r.id === id);
    if (!source) return;
    setRules((prev) => [...prev, {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]);
  }, [rules]);

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) =>
      r.id === id ? { ...r, enabled, updatedAt: new Date().toISOString() } : r
    ));
  }, []);

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

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, status: 'read' as const } : n)
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: 'read' as const }))
    );
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const statsItems: NotificationStatsItem[] = notifications.map((n) => ({
    id: n.id,
    severity: n.severity,
    status: n.status,
    receivedAt: n.receivedAt,
    // resolvedAt: n.resolvedAt,   // optional
  }));

  return (
    <div className='container mx-auto p-6 space-y-8'>
      <NotificationCenterHeader
        unreadCount={7}
        severityCounts={{ critical: 2, warning: 4, info: 1 }}
        muteState={muteState}
        lastReceivedAt={new Date().toISOString()}
        onMarkAllRead={() => console.log('mark all read')}
        onMute={handleMute}
        onUnmute={handleUnmute}
        onOpenSettings={() => console.log('open settings')}
      />

      <AlertRulesManager
        rules={rules}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onToggle={handleToggle}
      />

      <NotificationFeed
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onDismiss={handleDismiss}
      />

      <NotificationPreferencesPanel
        initial={DEFAULT_PREFS}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <NotificationStatsStrip notifications={statsItems} windowDays={7} />
    </div>
  );
}
