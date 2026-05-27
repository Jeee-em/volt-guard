'use client';

import { useState, useCallback, useId } from 'react';
import {
    Bell,
    Mail,
    MessageSquare,
    Moon,
    Check,
    ChevronDown,
    AlertCircle,
    AlertTriangle,
    Info,
    Clock,
    ToggleLeft,
    ToggleRight,
    Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationSeverity = 'critical' | 'warning' | 'info';
export type NotificationChannel  = 'in_app' | 'email' | 'sms';

export type SeverityChannelMatrix = Record<
    NotificationSeverity,
    Record<NotificationChannel, boolean>
>;

export interface QuietHours {
    enabled: boolean;
    from:    string;  // HH:MM, 24h
    to:      string;  // HH:MM, 24h
    /** Days of week: 0 = Sunday … 6 = Saturday */
    days:    number[];
}

export interface ContactDetails {
    email: string;
    phone: string; // E.164 format recommended, e.g. +1 555 000 0000
}

export interface NotificationPreferences {
    matrix:      SeverityChannelMatrix;
    quietHours:  QuietHours;
    contact:     ContactDetails;
}

export interface NotificationPreferencesPanelProps {
    initial:  NotificationPreferences;
    onSave:   (prefs: NotificationPreferences) => void;
    isSaving?: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG = {
    critical: {
        label:     'Critical',
        sublabel:  'Threshold breaches, immediate action needed',
        icon:      AlertCircle,
        iconClass: 'text-red-500',
        pill:      'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    },
    warning: {
        label:     'Warning',
        sublabel:  'Values approaching unsafe limits',
        icon:      AlertTriangle,
        iconClass: 'text-amber-500',
        pill:      'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    },
    info: {
        label:     'Info',
        sublabel:  'Status updates and non-urgent events',
        icon:      Info,
        iconClass: 'text-blue-500',
        pill:      'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    },
} as const satisfies Record<NotificationSeverity, {
    label:     string;
    sublabel:  string;
    icon:      React.ElementType;
    iconClass: string;
    pill:      string;
}>;

const CHANNEL_CFG = {
    in_app: {
        label:       'In-app',
        sublabel:    'Notification feed & banner',
        icon:        Bell,
        alwaysOn:    true,  // in-app cannot be disabled
    },
    email: {
        label:       'Email',
        sublabel:    'Sent to your registered address',
        icon:        Mail,
        alwaysOn:    false,
    },
    sms: {
        label:       'SMS',
        sublabel:    'Text message to your phone',
        icon:        MessageSquare,
        alwaysOn:    false,
    },
} as const satisfies Record<NotificationChannel, {
    label:    string;
    sublabel: string;
    icon:     React.ElementType;
    alwaysOn: boolean;
}>;

const SMS_ENABLED = false;
const SEVERITIES:  NotificationSeverity[] = ['critical', 'warning', 'info'];
const CHANNELS:    NotificationChannel[]  = SMS_ENABLED ? ['in_app', 'email', 'sms'] : ['in_app', 'email'];

const DAYS_OF_WEEK = [
    { value: 0, short: 'Su' },
    { value: 1, short: 'Mo' },
    { value: 2, short: 'Tu' },
    { value: 3, short: 'We' },
    { value: 4, short: 'Th' },
    { value: 5, short: 'Fr' },
    { value: 6, short: 'Sa' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaultMatrix(): SeverityChannelMatrix {
    const channels: Record<NotificationChannel, boolean> = {
        in_app: true,
        email:  true,
        sms:    false,
    };
    return {
        critical: { ...channels },
        warning:  { ...channels },
        info:     { in_app: true, email: false, sms: false },
    };
}

function validateContact(contact: ContactDetails): Partial<Record<keyof ContactDetails, string>> {
    const errors: Partial<Record<keyof ContactDetails, string>> = {};
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        errors.email = 'Enter a valid email address.';
    }
    if (contact.phone && !/^\+?[\d\s\-()]{7,20}$/.test(contact.phone)) {
        errors.phone = 'Enter a valid phone number.';
    }
    return errors;
}

function deepClonePrefs(prefs: NotificationPreferences): NotificationPreferences {
    return {
        matrix: {
            critical: { ...prefs.matrix.critical },
            warning:  { ...prefs.matrix.warning  },
            info:     { ...prefs.matrix.info      },
        },
        quietHours: { ...prefs.quietHours, days: [...prefs.quietHours.days] },
        contact:    { ...prefs.contact },
    };
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
    enabled:   boolean;
    disabled?: boolean;
    onChange:  (v: boolean) => void;
    label:     string;
}

function ToggleSwitch({ enabled, disabled = false, onChange, label }: ToggleSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={label}
            disabled={disabled}
            onClick={() => !disabled && onChange(!enabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                disabled
                    ? 'cursor-not-allowed opacity-40'
                    : 'cursor-pointer'
            } ${
                enabled
                    ? 'bg-green-500'
                    : 'bg-muted-foreground/30'
            }`}
        >
            <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
            />
        </button>
    );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
    icon:     React.ElementType;
    title:    string;
    children: React.ReactNode;
}

function Section({ icon: Icon, title, children }: SectionProps) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {title}
                </h3>
            </div>
            <div className="px-4 py-4">{children}</div>
        </div>
    );
}

// ─── Severity × Channel matrix ────────────────────────────────────────────────

interface MatrixSectionProps {
    matrix:   SeverityChannelMatrix;
    onChange: (severity: NotificationSeverity, channel: NotificationChannel, value: boolean) => void;
}

function MatrixSection({ matrix, onChange }: MatrixSectionProps) {
    return (
        <Section icon={Bell} title="Channel preferences">
            <div className="overflow-x-auto">
                <table className="w-full min-w-105">
                    <thead>
                        <tr>
                            <th className="w-1/3 pb-3 text-left" />
                            {CHANNELS.map((ch) => {
                                const cfg   = CHANNEL_CFG[ch];
                                const ChIcon = cfg.icon;
                                return (
                                    <th key={ch} className="pb-3 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <ChIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                                {cfg.label}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/70">
                                                {cfg.sublabel}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {SEVERITIES.map((sev) => {
                            const cfg    = SEVERITY_CFG[sev];
                            const SevIcon = cfg.icon;
                            return (
                                <tr key={sev}>
                                    <td className="py-3 pr-4">
                                        <div className="flex items-start gap-2">
                                            <SevIcon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconClass}`} />
                                            <div>
                                                <p className="text-[13px] font-medium text-foreground">
                                                    {cfg.label}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {cfg.sublabel}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    {CHANNELS.map((ch) => {
                                        const alwaysOn = CHANNEL_CFG[ch].alwaysOn;
                                        return (
                                            <td key={ch} className="py-3 text-center">
                                                <div className="flex justify-center">
                                                    <ToggleSwitch
                                                        enabled={matrix[sev][ch]}
                                                        disabled={alwaysOn}
                                                        onChange={(v) => onChange(sev, ch, v)}
                                                        label={`${cfg.label} via ${CHANNEL_CFG[ch].label}`}
                                                    />
                                                </div>
                                                {alwaysOn && (
                                                    <p className="mt-1 text-[9px] text-muted-foreground/60">
                                                        always on
                                                    </p>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Section>
    );
}

// ─── Contact details ──────────────────────────────────────────────────────────

interface ContactSectionProps {
    contact:  ContactDetails;
    errors:   Partial<Record<keyof ContactDetails, string>>;
    onChange: (field: keyof ContactDetails, value: string) => void;
}

function ContactSection({ contact, errors, onChange }: ContactSectionProps) {
    const uid = useId();

    return (
        <Section icon={Mail} title="Contact details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Email */}
                <div className="space-y-1.5">
                    <label
                        htmlFor={`${uid}-email`}
                        className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                    >
                        Email address
                    </label>
                    <Input
                        id={`${uid}-email`}
                        type="email"
                        value={contact.email}
                        onChange={(e) => onChange('email', e.target.value)}
                        placeholder="you@example.com"
                        className="h-9 text-[13px]"
                    />
                    {errors.email && (
                        <p className="text-[11px] text-destructive">{errors.email}</p>
                    )}
                </div>

                {/* Phone (SMS disabled) */}
                {SMS_ENABLED ? (
                    <div className="space-y-1.5">
                        <label
                            htmlFor={`${uid}-phone`}
                            className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                        >
                            Phone number (SMS)
                        </label>
                        <div className="relative">
                            <MessageSquare className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id={`${uid}-phone`}
                                type="tel"
                                value={contact.phone}
                                onChange={(e) => onChange('phone', e.target.value)}
                                placeholder="+1 555 000 0000"
                                className="h-9 pl-8 font-mono text-[13px]"
                            />
                        </div>
                        {errors.phone ? (
                            <p className="text-[11px] text-destructive">{errors.phone}</p>
                        ) : (
                            <p className="text-[10px] text-muted-foreground">
                                Include country code, e.g. +63 for Philippines
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">
                                SMS notifications are temporarily disabled.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Section>
    );
}

// ─── Quiet hours ──────────────────────────────────────────────────────────────

interface QuietHoursSectionProps {
    quietHours: QuietHours;
    onChange:   (qh: QuietHours) => void;
}

function QuietHoursSection({ quietHours, onChange }: QuietHoursSectionProps) {
    const uid = useId();

    const set = useCallback(<K extends keyof QuietHours>(key: K, value: QuietHours[K]) => {
        onChange({ ...quietHours, [key]: value });
    }, [quietHours, onChange]);

    const toggleDay = useCallback((day: number) => {
        const days = quietHours.days.includes(day)
            ? quietHours.days.filter((d) => d !== day)
            : [...quietHours.days, day].sort((a, b) => a - b);
        onChange({ ...quietHours, days });
    }, [quietHours, onChange]);

    return (
        <Section icon={Moon} title="Quiet hours">
            <div className="space-y-4">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[13px] font-medium text-foreground">
                            Suppress non-critical alerts
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            During quiet hours, only critical alerts will send email.
                        </p>
                    </div>
                    <ToggleSwitch
                        enabled={quietHours.enabled}
                        onChange={(v) => set('enabled', v)}
                        label="Enable quiet hours"
                    />
                </div>

                {/* Time range */}
                <div
                    className={`space-y-4 transition-opacity ${
                        quietHours.enabled ? 'opacity-100' : 'pointer-events-none opacity-30'
                    }`}
                >
                    <div className="grid grid-cols-2 gap-4">
                        {/* From */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor={`${uid}-from`}
                                className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                            >
                                From
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    id={`${uid}-from`}
                                    type="time"
                                    value={quietHours.from}
                                    onChange={(e) => set('from', e.target.value)}
                                    className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                        </div>

                        {/* To */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor={`${uid}-to`}
                                className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                            >
                                To
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    id={`${uid}-to`}
                                    type="time"
                                    value={quietHours.to}
                                    onChange={(e) => set('to', e.target.value)}
                                    className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Days of week */}
                    <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                            Active on
                        </p>
                        <div className="flex gap-1.5">
                            {DAYS_OF_WEEK.map(({ value, short }) => {
                                const active = quietHours.days.includes(value);
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => toggleDay(value)}
                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                                            active
                                                ? 'bg-foreground text-background'
                                                : 'border border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {short}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            {quietHours.days.length === 0
                                ? 'No days selected — quiet hours will never activate.'
                                : quietHours.days.length === 7
                                ? 'Every day'
                                : `${quietHours.days.length} day${quietHours.days.length > 1 ? 's' : ''} selected`}
                        </p>
                    </div>

                    {/* Summary */}
                    {quietHours.days.length > 0 && (
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">
                                <Moon className="mr-1 inline h-3 w-3" />
                                Quiet hours active{' '}
                                <span className="font-mono font-medium text-foreground">
                                    {quietHours.from} – {quietHours.to}
                                </span>{' '}
                                on{' '}
                                <span className="font-medium text-foreground">
                                    {quietHours.days
                                        .map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.short)
                                        .filter(
                                            (s): s is (typeof DAYS_OF_WEEK)[number]['short'] =>
                                                s !== undefined,
                                        )
                                        .join(', ')}
                                </span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Section>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationPreferencesPanel({
    initial,
    onSave,
    isSaving = false,
}: NotificationPreferencesPanelProps) {
    const [prefs, setPrefs] = useState<NotificationPreferences>(() => deepClonePrefs(initial));
    const [contactErrors, setContactErrors] = useState<Partial<Record<keyof ContactDetails, string>>>({});
    const [saved, setSaved] = useState<boolean>(false);

    const isDirty = JSON.stringify(prefs) !== JSON.stringify(initial);

    const handleMatrixChange = useCallback((
        severity: NotificationSeverity,
        channel:  NotificationChannel,
        value:    boolean,
    ) => {
        setPrefs((prev) => ({
            ...prev,
            matrix: {
                ...prev.matrix,
                [severity]: {
                    ...prev.matrix[severity],
                    [channel]: value,
                },
            },
        }));
        setSaved(false);
    }, []);

    const handleContactChange = useCallback((field: keyof ContactDetails, value: string) => {
        setPrefs((prev) => ({ ...prev, contact: { ...prev.contact, [field]: value } }));
        setContactErrors((prev) => ({ ...prev, [field]: undefined }));
        setSaved(false);
    }, []);

    const handleQuietHoursChange = useCallback((qh: QuietHours) => {
        setPrefs((prev) => ({ ...prev, quietHours: qh }));
        setSaved(false);
    }, []);

    const handleSave = useCallback(() => {
        const errors = validateContact(prefs.contact);
        if (Object.keys(errors).length > 0) {
            setContactErrors(errors);
            return;
        }
        onSave(deepClonePrefs(prefs));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    }, [prefs, onSave]);

    const handleReset = useCallback(() => {
        setPrefs(deepClonePrefs(initial));
        setContactErrors({});
        setSaved(false);
    }, [initial]);

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Notification Preferences
                </h2>
                <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
                <MatrixSection
                    matrix={prefs.matrix}
                    onChange={handleMatrixChange}
                />

                <ContactSection
                    contact={prefs.contact}
                    errors={contactErrors}
                    onChange={handleContactChange}
                />

                <QuietHoursSection
                    quietHours={prefs.quietHours}
                    onChange={handleQuietHoursChange}
                />

                {/* Save bar */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-[12px] text-muted-foreground">
                        {saved
                            ? 'Preferences saved.'
                            : isDirty
                            ? 'You have unsaved changes.'
                            : 'All changes saved.'}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            disabled={!isDirty || isSaving}
                            className="text-[12px]"
                        >
                            Reset
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className="gap-1.5 text-[12px]"
                        >
                            {saved ? (
                                <>
                                    <Check className="h-3.5 w-3.5" />
                                    Saved
                                </>
                            ) : (
                                <>
                                    <Save className="h-3.5 w-3.5" />
                                    {isSaving ? 'Saving…' : 'Save preferences'}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}