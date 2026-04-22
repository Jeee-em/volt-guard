'use client';

import { useState, useCallback, useId } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Copy,
    ChevronDown,
    AlertCircle,
    AlertTriangle,
    Info,
    Check,
    X,
    ToggleLeft,
    ToggleRight,
    GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuleSeverity  = 'critical' | 'warning' | 'info';
export type RuleCondition = 'above' | 'below' | 'equals';
export type RuleMetric    = 'voltage' | 'current' | 'power' | 'power_factor';

export interface AlertRule {
    id: string;
    name: string;
    metric: RuleMetric;
    condition: RuleCondition;
    threshold: number;
    severity: RuleSeverity;
    enabled: boolean;
    createdAt: string;  // ISO
    updatedAt: string;  // ISO
}

export type RuleFormDraft = Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>;

export interface AlertRulesManagerProps {
    rules: AlertRule[];
    onAdd:    (draft: RuleFormDraft) => void;
    onEdit:   (id: string, draft: RuleFormDraft) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const METRIC_OPTIONS: { value: RuleMetric; label: string; unit: string }[] = [
    { value: 'voltage',      label: 'Voltage',      unit: 'V'  },
    { value: 'current',      label: 'Current',      unit: 'A'  },
    { value: 'power',        label: 'Power',        unit: 'W'  },
    { value: 'power_factor', label: 'Power Factor', unit: 'pf' },
];

const CONDITION_OPTIONS: { value: RuleCondition; label: string; symbol: string }[] = [
    { value: 'above',  label: 'Above',  symbol: '>' },
    { value: 'below',  label: 'Below',  symbol: '<' },
    { value: 'equals', label: 'Equals', symbol: '=' },
];

const SEVERITY_OPTIONS: { value: RuleSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'warning',  label: 'Warning'  },
    { value: 'info',     label: 'Info'     },
];

const SEVERITY_CFG: Record<RuleSeverity, {
    icon: React.ElementType;
    pill: string;
    iconClass: string;
}> = {
    critical: {
        icon: AlertCircle,
        pill: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        iconClass: 'text-red-500',
    },
    warning: {
        icon: AlertTriangle,
        pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        iconClass: 'text-amber-500',
    },
    info: {
        icon: Info,
        pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        iconClass: 'text-blue-500',
    },
};

const EMPTY_DRAFT: RuleFormDraft = {
    name:      '',
    metric:    'voltage',
    condition: 'above',
    threshold: 0,
    severity:  'warning',
    enabled:   true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUnit(metric: RuleMetric): string {
    return METRIC_OPTIONS.find((m) => m.value === metric)?.unit ?? '';
}

function getConditionSymbol(condition: RuleCondition): string {
    return CONDITION_OPTIONS.find((c) => c.value === condition)?.symbol ?? '';
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day:   'numeric',
        year:  'numeric',
    });
}

function validateDraft(draft: RuleFormDraft): Partial<Record<keyof RuleFormDraft, string>> {
    const errors: Partial<Record<keyof RuleFormDraft, string>> = {};
    if (!draft.name.trim())        errors.name      = 'Name is required.';
    if (isNaN(draft.threshold))    errors.threshold = 'Must be a valid number.';
    return errors;
}

// ─── Select wrapper ───────────────────────────────────────────────────────────

interface SelectFieldProps<T extends string> {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    id: string;
}

function SelectField<T extends string>({
    label, value, options, onChange, id,
}: SelectFieldProps<T>) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                {label}
            </label>
            <div className="relative">
                <select
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value as T)}
                    className="h-9 w-full appearance-none rounded-md border border-border bg-background px-3 pr-8 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
        </div>
    );
}

// ─── Rule form (add / edit) ───────────────────────────────────────────────────

interface RuleFormProps {
    initial: RuleFormDraft;
    onSave:   (draft: RuleFormDraft) => void;
    onCancel: () => void;
    mode: 'add' | 'edit';
}

function RuleForm({ initial, onSave, onCancel, mode }: RuleFormProps) {
    const [draft, setDraft] = useState<RuleFormDraft>(initial);
    const [errors, setErrors] = useState<Partial<Record<keyof RuleFormDraft, string>>>({});
    const uid = useId();

    const set = useCallback(<K extends keyof RuleFormDraft>(key: K, value: RuleFormDraft[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: undefined }));
    }, []);

    const handleSave = () => {
        const errs = validateDraft(draft);
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        onSave(draft);
    };

    const unit = getUnit(draft.metric);

    return (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                {mode === 'add' ? 'New rule' : 'Edit rule'}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Name */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <label htmlFor={`${uid}-name`} className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Rule name
                    </label>
                    <Input
                        id={`${uid}-name`}
                        value={draft.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="e.g. High current alert"
                        className="h-9 text-[13px]"
                    />
                    {errors.name && (
                        <p className="text-[11px] text-destructive">{errors.name}</p>
                    )}
                </div>

                {/* Metric */}
                <SelectField<RuleMetric>
                    id={`${uid}-metric`}
                    label="Metric"
                    value={draft.metric}
                    options={METRIC_OPTIONS}
                    onChange={(v) => set('metric', v)}
                />

                {/* Condition */}
                <SelectField<RuleCondition>
                    id={`${uid}-condition`}
                    label="Condition"
                    value={draft.condition}
                    options={CONDITION_OPTIONS}
                    onChange={(v) => set('condition', v)}
                />

                {/* Threshold */}
                <div className="space-y-1.5">
                    <label htmlFor={`${uid}-threshold`} className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Threshold
                    </label>
                    <div className="relative">
                        <Input
                            id={`${uid}-threshold`}
                            type="number"
                            value={draft.threshold}
                            onChange={(e) => set('threshold', parseFloat(e.target.value) || 0)}
                            step="0.1"
                            className="h-9 pr-10 text-right font-mono text-[13px]"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                            {unit}
                        </span>
                    </div>
                    {errors.threshold && (
                        <p className="text-[11px] text-destructive">{errors.threshold}</p>
                    )}
                </div>

                {/* Severity */}
                <SelectField<RuleSeverity>
                    id={`${uid}-severity`}
                    label="Severity"
                    value={draft.severity}
                    options={SEVERITY_OPTIONS}
                    onChange={(v) => set('severity', v)}
                />

                {/* Enabled */}
                <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Enabled
                    </p>
                    <button
                        type="button"
                        onClick={() => set('enabled', !draft.enabled)}
                        className="flex h-9 items-center gap-2 text-[13px]"
                    >
                        {draft.enabled ? (
                            <ToggleRight className="h-6 w-6 text-green-500" />
                        ) : (
                            <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                        )}
                        <span className={draft.enabled ? 'text-foreground' : 'text-muted-foreground'}>
                            {draft.enabled ? 'Active' : 'Inactive'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Preview */}
            <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                    Preview:{' '}
                    <span className="font-mono text-foreground">
                        Trigger <span className={`font-semibold ${SEVERITY_CFG[draft.severity].iconClass}`}>{draft.severity}</span> alert
                        {' '}when{' '}
                        <span className="font-medium">{METRIC_OPTIONS.find((m) => m.value === draft.metric)?.label}</span>
                        {' '}<span className="font-medium">{getConditionSymbol(draft.condition)}</span>{' '}
                        <span className="font-medium">{draft.threshold} {unit}</span>
                    </span>
                </p>
            </div>

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5 text-[12px]">
                    <X className="h-3.5 w-3.5" />
                    Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="gap-1.5 text-[12px]">
                    <Check className="h-3.5 w-3.5" />
                    {mode === 'add' ? 'Add rule' : 'Save changes'}
                </Button>
            </div>
        </div>
    );
}

// ─── Rule row ─────────────────────────────────────────────────────────────────

interface RuleRowProps {
    rule: AlertRule;
    isEditing: boolean;
    onEdit:      () => void;
    onSave:      (draft: RuleFormDraft) => void;
    onCancelEdit: () => void;
    onDelete:    () => void;
    onDuplicate: () => void;
    onToggle:    (enabled: boolean) => void;
}

function RuleRow({
    rule,
    isEditing,
    onEdit,
    onSave,
    onCancelEdit,
    onDelete,
    onDuplicate,
    onToggle,
}: RuleRowProps) {
    const cfg         = SEVERITY_CFG[rule.severity];
    const SevIcon     = cfg.icon;
    const unit        = getUnit(rule.metric);
    const metricLabel = METRIC_OPTIONS.find((m) => m.value === rule.metric)?.label ?? rule.metric;
    const condSymbol  = getConditionSymbol(rule.condition);

    if (isEditing) {
        return (
            <li className="px-4 py-3">
                <RuleForm
                    initial={{
                        name:      rule.name,
                        metric:    rule.metric,
                        condition: rule.condition,
                        threshold: rule.threshold,
                        severity:  rule.severity,
                        enabled:   rule.enabled,
                    }}
                    onSave={onSave}
                    onCancel={onCancelEdit}
                    mode="edit"
                />
            </li>
        );
    }

    return (
        <li className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20 ${!rule.enabled ? 'opacity-50' : ''}`}>
            {/* Drag handle (visual only) */}
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40" />

            {/* Severity icon */}
            <SevIcon className={`h-4 w-4 shrink-0 ${cfg.iconClass}`} />

            {/* Name */}
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{rule.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {metricLabel} {condSymbol} {rule.threshold} {unit}
                </p>
            </div>

            {/* Severity pill */}
            <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-block ${cfg.pill}`}>
                {rule.severity}
            </span>

            {/* Updated */}
            <span className="hidden text-[11px] text-muted-foreground lg:block">
                {formatDate(rule.updatedAt)}
            </span>

            {/* Toggle */}
            <button
                onClick={() => onToggle(!rule.enabled)}
                className="shrink-0"
                aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
            >
                {rule.enabled ? (
                    <ToggleRight className="h-5 w-5 text-green-500" />
                ) : (
                    <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
            </button>

            {/* Actions menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={onEdit} className="gap-2 text-[13px]">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDuplicate} className="gap-2 text-[13px]">
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={onDelete}
                        className="gap-2 text-[13px] text-destructive focus:text-destructive"
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlertRulesManager({
    rules,
    onAdd,
    onEdit,
    onDelete,
    onDuplicate,
    onToggle,
}: AlertRulesManagerProps) {
    const [showAddForm, setShowAddForm]   = useState<boolean>(false);
    const [editingId, setEditingId]       = useState<string | null>(null);
    const [filterSeverity, setFilterSeverity] = useState<RuleSeverity | 'all'>('all');
    const [filterEnabled, setFilterEnabled]   = useState<'all' | 'enabled' | 'disabled'>('all');

    const handleAdd = useCallback((draft: RuleFormDraft) => {
        onAdd(draft);
        setShowAddForm(false);
    }, [onAdd]);

    const handleEdit = useCallback((id: string, draft: RuleFormDraft) => {
        onEdit(id, draft);
        setEditingId(null);
    }, [onEdit]);

    const filtered = rules.filter((r) => {
        if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
        if (filterEnabled  === 'enabled'  && !r.enabled)  return false;
        if (filterEnabled  === 'disabled' &&  r.enabled)  return false;
        return true;
    });

    const enabledCount  = rules.filter((r) =>  r.enabled).length;
    const disabledCount = rules.filter((r) => !r.enabled).length;

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Alert Rules
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{enabledCount} active</span>
                    {disabledCount > 0 && <span>· {disabledCount} disabled</span>}
                    <span>· {rules.length} total</span>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    {/* Severity filter */}
                    <div className="flex items-center gap-1">
                        {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterSeverity(s)}
                                className={`rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                                    filterSeverity === s
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="h-4 w-px bg-border" />

                    {/* Enabled filter */}
                    <div className="flex items-center gap-1">
                        {(['all', 'enabled', 'disabled'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterEnabled(s)}
                                className={`rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                                    filterEnabled === s
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1" />

                    {/* Add rule button */}
                    <Button
                        size="sm"
                        onClick={() => { setShowAddForm(true); setEditingId(null); }}
                        className="gap-1.5 text-[12px]"
                        disabled={showAddForm}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add rule
                    </Button>
                </div>

                {/* Add form */}
                {showAddForm && (
                    <div className="border-b border-border px-4 py-3">
                        <RuleForm
                            initial={EMPTY_DRAFT}
                            onSave={handleAdd}
                            onCancel={() => setShowAddForm(false)}
                            mode="add"
                        />
                    </div>
                )}

                {/* Table header */}
                <div className="grid grid-cols-[16px_16px_1fr_auto_auto_auto_auto] items-center gap-3 border-b border-border bg-muted/20 px-4 py-2">
                    <span />
                    <span />
                    <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Rule
                    </span>
                    <span className="hidden font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:block">
                        Severity
                    </span>
                    <span className="hidden font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground lg:block">
                        Updated
                    </span>
                    <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        On
                    </span>
                    <span />
                </div>

                {/* Rules list */}
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                        <p className="text-[13px] text-muted-foreground">
                            {rules.length === 0
                                ? 'No alert rules yet. Add one to get started.'
                                : 'No rules match the current filter.'}
                        </p>
                        {rules.length === 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowAddForm(true)}
                                className="mt-1 gap-1.5 text-[12px]"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add your first rule
                            </Button>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {filtered.map((rule) => (
                            <RuleRow
                                key={rule.id}
                                rule={rule}
                                isEditing={editingId === rule.id}
                                onEdit={() => { setEditingId(rule.id); setShowAddForm(false); }}
                                onSave={(draft) => handleEdit(rule.id, draft)}
                                onCancelEdit={() => setEditingId(null)}
                                onDelete={() => onDelete(rule.id)}
                                onDuplicate={() => onDuplicate(rule.id)}
                                onToggle={(enabled) => onToggle(rule.id, enabled)}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}