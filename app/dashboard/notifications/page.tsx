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

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  timestamp: number;
  sensor: string;
  read: boolean;
}

export default function NotificationsPage() {
  const [rules, setRules] = useState<AlertRule[]>([
        {
            id: '1',
            name: 'High current alert',
            metric: 'current',
            condition: 'above',
            threshold: 18,
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
    </div>
  );
}
