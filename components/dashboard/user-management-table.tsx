'use client';

import { useState, useMemo, useCallback, useId } from 'react';
import {
    Search,
    X,
    UserPlus,
    ChevronDown,
    MoreHorizontal,
    ShieldCheck,
    Shield,
    Eye,
    UserX,
    UserCheck,
    Trash2,
    Mail,
    Clock,
    Filter,
    Check,
    Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole   = 'super_admin' | 'admin' | 'engineer' | 'viewer';
export type UserStatus = 'active' | 'suspended' | 'invited';

export interface SystemUser {
    id:          string;
    name:        string;
    email:       string;
    role:        UserRole;
    status:      UserStatus;
    lastLoginAt: string | null;  // ISO — null if never logged in
    joinedAt:    string;         // ISO
    avatarColor: string;         // hex, pre-assigned on creation
}

export interface InviteDraft {
    email: string;
    role:  UserRole;
}

export interface UserManagementTableProps {
    users:          SystemUser[];
    currentUserId:  string;
    onInvite:       (draft: InviteDraft)              => void;
    onRoleChange:   (id: string, role: UserRole)      => void;
    onSuspend:      (id: string)                      => void;
    onUnsuspend:    (id: string)                      => void;
    onRemove:       (id: string)                      => void;
    isInviting?:    boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CFG = {
    super_admin: {
        label:     'Super Admin',
        icon:      ShieldCheck,
        iconClass: 'text-purple-500',
        pill:      'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
        rank:      0,
    },
    admin: {
        label:     'Admin',
        icon:      Shield,
        iconClass: 'text-blue-500',
        pill:      'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        rank:      1,
    },
    engineer: {
        label:     'Engineer',
        icon:      ShieldCheck,
        iconClass: 'text-teal-500',
        pill:      'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
        rank:      2,
    },
    viewer: {
        label:     'Viewer',
        icon:      Eye,
        iconClass: 'text-muted-foreground',
        pill:      'bg-muted text-muted-foreground',
        rank:      3,
    },
} as const satisfies Record<UserRole, {
    label:     string;
    icon:      React.ElementType;
    iconClass: string;
    pill:      string;
    rank:      number;
}>;

const STATUS_CFG = {
    active: {
        label:     'Active',
        dot:       'bg-green-500',
        textClass: 'text-green-700 dark:text-green-400',
        pill:      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800',
    },
    suspended: {
        label:     'Suspended',
        dot:       'bg-red-500',
        textClass: 'text-red-600 dark:text-red-400',
        pill:      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
    },
    invited: {
        label:     'Invited',
        dot:       'bg-amber-400',
        textClass: 'text-amber-600 dark:text-amber-400',
        pill:      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    },
} as const satisfies Record<UserStatus, {
    label:     string;
    dot:       string;
    textClass: string;
    pill:      string;
}>;

const ROLES: UserRole[] = ['super_admin', 'admin', 'engineer', 'viewer'];

type FilterRole   = UserRole   | 'all';
type FilterStatus = UserStatus | 'all';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('');
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day:   'numeric',
        year:  'numeric',
    });
}

function formatLastLogin(iso: string | null): string {
    if (!iso) return 'Never';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)     return 'Just now';
    if (diff < 3_600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86_400) return `${Math.floor(diff / 3_600)}h ago`;
    if (diff < 604_800)return `${Math.floor(diff / 86_400)}d ago`;
    return formatDate(iso);
}

function validateInvite(draft: InviteDraft): Partial<Record<keyof InviteDraft, string>> {
    const errors: Partial<Record<keyof InviteDraft, string>> = {};
    if (!draft.email.trim()) {
        errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
        errors.email = 'Enter a valid email address.';
    }
    return errors;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
    name:  string;
    color: string;
    size?: 'sm' | 'md';
}

function Avatar({ name, color, size = 'md' }: AvatarProps) {
    const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[12px]';
    return (
        <div
            className={`${dim} shrink-0 rounded-full flex items-center justify-center font-semibold text-white`}
            style={{ backgroundColor: color }}
        >
            {initials(name)}
        </div>
    );
}

// ─── Role selector dropdown ───────────────────────────────────────────────────

interface RoleSelectorProps {
    value:     UserRole;
    disabled?: boolean;
    onChange:  (role: UserRole) => void;
}

function RoleSelector({ value, disabled = false, onChange }: RoleSelectorProps) {
    const cfg     = ROLE_CFG[value];
    const RoleIcon = cfg.icon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    disabled={disabled}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${cfg.pill} ${
                        disabled ? 'cursor-not-allowed opacity-60' : 'hover:opacity-80'
                    }`}
                >
                    <RoleIcon className={`h-3 w-3 ${cfg.iconClass}`} />
                    {cfg.label}
                    {!disabled && <ChevronDown className="h-2.5 w-2.5 opacity-60" />}
                </button>
            </DropdownMenuTrigger>
            {!disabled && (
                <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Change role
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ROLES.map((role) => {
                        const rcfg  = ROLE_CFG[role];
                        const RIcon = rcfg.icon;
                        return (
                            <DropdownMenuItem
                                key={role}
                                onClick={() => onChange(role)}
                                className="flex items-center gap-2 text-[13px]"
                            >
                                <RIcon className={`h-3.5 w-3.5 ${rcfg.iconClass}`} />
                                {rcfg.label}
                                {role === value && <Check className="ml-auto h-3 w-3" />}
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            )}
        </DropdownMenu>
    );
}

// ─── Invite form ──────────────────────────────────────────────────────────────

interface InviteFormProps {
    onSend:    (draft: InviteDraft) => void;
    onCancel:  () => void;
    isSending: boolean;
}

function InviteForm({ onSend, onCancel, isSending }: InviteFormProps) {
    const uid = useId();
    const [draft, setDraft]   = useState<InviteDraft>({ email: '', role: 'engineer' });
    const [errors, setErrors] = useState<Partial<Record<keyof InviteDraft, string>>>({});

    const handleSend = () => {
        const errs = validateInvite(draft);
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        onSend(draft);
    };

    const set = <K extends keyof InviteDraft>(key: K, value: InviteDraft[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    return (
        <div className="border-b border-border bg-muted/20 px-4 py-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                Invite new user
            </p>
            <div className="flex flex-wrap items-start gap-3">
                {/* Email */}
                <div className="min-w-[220px] flex-1 space-y-1">
                    <label
                        htmlFor={`${uid}-email`}
                        className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                    >
                        Email address
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id={`${uid}-email`}
                            type="email"
                            value={draft.email}
                            onChange={(e) => set('email', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="engineer@example.com"
                            className="h-9 pl-8 text-[13px]"
                            autoFocus
                        />
                    </div>
                    {errors.email && (
                        <p className="text-[11px] text-destructive">{errors.email}</p>
                    )}
                </div>

                {/* Role */}
                <div className="space-y-1">
                    <label
                        htmlFor={`${uid}-role`}
                        className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                    >
                        Role
                    </label>
                    <div className="relative">
                        <select
                            id={`${uid}-role`}
                            value={draft.role}
                            onChange={(e) => set('role', e.target.value as UserRole)}
                            className="h-9 appearance-none rounded-md border border-border bg-background pl-3 pr-8 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {ROLES.map((r) => (
                                <option key={r} value={r}>{ROLE_CFG[r].label}</option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-end gap-2 pb-0.5 pt-5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        disabled={isSending}
                        className="gap-1.5 text-[12px]"
                    >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSend}
                        disabled={isSending}
                        className="gap-1.5 text-[12px]"
                    >
                        <Send className="h-3.5 w-3.5" />
                        {isSending ? 'Sending…' : 'Send invite'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── User row ─────────────────────────────────────────────────────────────────

interface UserRowProps {
    user:          SystemUser;
    isSelf:        boolean;
    isSuperAdmin:  boolean;
    onRoleChange:  (role: UserRole) => void;
    onSuspend:     () => void;
    onUnsuspend:   () => void;
    onRemove:      () => void;
}

function UserRow({
    user,
    isSelf,
    isSuperAdmin,
    onRoleChange,
    onSuspend,
    onUnsuspend,
    onRemove,
}: UserRowProps) {
    const statusCfg = STATUS_CFG[user.status];
    const canEdit   = !isSelf && isSuperAdmin;

    return (
        <tr className={`transition-colors hover:bg-muted/20 ${user.status === 'suspended' ? 'opacity-60' : ''}`}>
            {/* User */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar name={user.name} color={user.avatarColor} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-medium text-foreground">
                                {user.name}
                            </p>
                            {isSelf && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    you
                                </span>
                            )}
                        </div>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </div>
            </td>

            {/* Role */}
            <td className="px-4 py-3">
                <RoleSelector
                    value={user.role}
                    disabled={!canEdit}
                    onChange={onRoleChange}
                />
            </td>

            {/* Status */}
            <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusCfg.pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                </span>
            </td>

            {/* Last login */}
            <td className="hidden px-4 py-3 lg:table-cell">
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {formatLastLogin(user.lastLoginAt)}
                </div>
            </td>

            {/* Joined */}
            <td className="hidden px-4 py-3 text-[12px] text-muted-foreground xl:table-cell">
                {formatDate(user.joinedAt)}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-right">
                {!isSelf && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            {isSuperAdmin && (
                                <>
                                    {user.status === 'active' || user.status === 'invited' ? (
                                        <DropdownMenuItem
                                            onClick={onSuspend}
                                            className="gap-2 text-[13px]"
                                        >
                                            <UserX className="h-3.5 w-3.5 text-amber-500" />
                                            Suspend
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            onClick={onUnsuspend}
                                            className="gap-2 text-[13px]"
                                        >
                                            <UserCheck className="h-3.5 w-3.5 text-green-500" />
                                            Unsuspend
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={onRemove}
                                        className="gap-2 text-[13px] text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remove user
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </td>
        </tr>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserManagementTable({
    users,
    currentUserId,
    onInvite,
    onRoleChange,
    onSuspend,
    onUnsuspend,
    onRemove,
    isInviting = false,
}: UserManagementTableProps) {
    const [showInvite,    setShowInvite]    = useState<boolean>(false);
    const [search,        setSearch]        = useState<string>('');
    const [filterRole,    setFilterRole]    = useState<FilterRole>('all');
    const [filterStatus,  setFilterStatus]  = useState<FilterStatus>('all');

    const currentUser = users.find((u) => u.id === currentUserId);
    const isSuperAdmin = currentUser?.role === 'super_admin';

    const hasFilters = filterRole !== 'all' || filterStatus !== 'all' || search !== '';

    const clearFilters = useCallback(() => {
        setFilterRole('all');
        setFilterStatus('all');
        setSearch('');
    }, []);

    const handleInvite = useCallback((draft: InviteDraft) => {
        onInvite(draft);
        setShowInvite(false);
    }, [onInvite]);

    const filtered = useMemo<SystemUser[]>(() => {
        return users
            .filter((u) => {
                if (filterRole   !== 'all' && u.role   !== filterRole)   return false;
                if (filterStatus !== 'all' && u.status !== filterStatus) return false;
                if (search) {
                    const q = search.toLowerCase();
                    if (
                        !u.name.toLowerCase().includes(q) &&
                        !u.email.toLowerCase().includes(q)
                    ) return false;
                }
                return true;
            })
            .sort((a, b) => ROLE_CFG[a.role].rank - ROLE_CFG[b.role].rank);
    }, [users, filterRole, filterStatus, search]);

    // Summary counts
    const activeCount    = users.filter((u) => u.status === 'active').length;
    const suspendedCount = users.filter((u) => u.status === 'suspended').length;
    const invitedCount   = users.filter((u) => u.status === 'invited').length;

    return (
        <section className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Users
                </h2>
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{activeCount} active</span>
                    {invitedCount  > 0 && <span>· {invitedCount} invited</span>}
                    {suspendedCount > 0 && <span>· {suspendedCount} suspended</span>}
                    <span>· {users.length} total</span>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                    {/* Search */}
                    <div className="relative min-w-[180px] flex-1">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or email…"
                            className="h-8 border-border pl-8 text-[12px] shadow-none"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-1.5">
                        <Filter className="h-3 w-3 text-muted-foreground" />

                        {/* Role filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {filterRole === 'all' ? 'Role' : ROLE_CFG[filterRole].label}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Role</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setFilterRole('all')} className="text-[13px]">
                                    All
                                </DropdownMenuItem>
                                {ROLES.map((r) => (
                                    <DropdownMenuItem
                                        key={r}
                                        onClick={() => setFilterRole(r)}
                                        className="flex items-center gap-2 text-[13px]"
                                    >
                                        {ROLE_CFG[r].label}
                                        {filterRole === r && <Check className="ml-auto h-3 w-3" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Status filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                                    {filterStatus === 'all' ? 'Status' : STATUS_CFG[filterStatus].label}
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel className="text-[11px]">Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(['all', 'active', 'suspended', 'invited'] as const).map((s) => (
                                    <DropdownMenuItem
                                        key={s}
                                        onClick={() => setFilterStatus(s)}
                                        className="flex items-center gap-2 text-[13px] capitalize"
                                    >
                                        {s === 'all' ? 'All' : STATUS_CFG[s].label}
                                        {filterStatus === s && <Check className="ml-auto h-3 w-3" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="flex-1" />

                    {/* Invite button */}
                    {isSuperAdmin && (
                        <Button
                            size="sm"
                            onClick={() => setShowInvite((v) => !v)}
                            disabled={showInvite}
                            className="gap-1.5 text-[12px]"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            Invite user
                        </Button>
                    )}
                </div>

                {/* ── Invite form ── */}
                {showInvite && (
                    <InviteForm
                        onSend={handleInvite}
                        onCancel={() => setShowInvite(false)}
                        isSending={isInviting}
                    />
                )}

                {/* ── Table ── */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {(['User', 'Role', 'Status', 'Last login', 'Joined', ''] as const).map((h, i) => (
                                    <th
                                        key={i}
                                        className={`px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground ${
                                            h === 'Last login' ? 'hidden lg:table-cell' :
                                            h === 'Joined'     ? 'hidden xl:table-cell' :
                                            h === ''           ? 'text-right'           : ''
                                        }`}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="py-12 text-center text-[13px] text-muted-foreground"
                                    >
                                        {hasFilters
                                            ? 'No users match the current filters.'
                                            : 'No users yet.'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((user) => (
                                    <UserRow
                                        key={user.id}
                                        user={user}
                                        isSelf={user.id === currentUserId}
                                        isSuperAdmin={isSuperAdmin}
                                        onRoleChange={(role) => onRoleChange(user.id, role)}
                                        onSuspend={() => onSuspend(user.id)}
                                        onUnsuspend={() => onUnsuspend(user.id)}
                                        onRemove={() => onRemove(user.id)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Footer ── */}
                {filtered.length > 0 && (
                    <div className="border-t border-border px-4 py-2.5 text-center text-[11px] text-muted-foreground">
                        Showing {filtered.length} of {users.length} users
                    </div>
                )}
            </div>
        </section>
    );
}