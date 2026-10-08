import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  CircleHelp,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, MenuItem, MenuLabel, MenuSeparator, Tooltip } from '@/components/ui/Dropdown';
import { useApi } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn, initials } from '@/lib/utils';
import { CommandPalette } from './CommandPalette';
import type { DashboardData } from '@/lib/types';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: 'gaps' | 'evidence';
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Workspace',
    items: [
      { to: '/app/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/app/evidence', label: 'Evidence', icon: FileText },
      { to: '/app/controls', label: 'Controls', icon: ShieldCheck },
      { to: '/app/mappings', label: 'Evidence mapping', icon: GitCompareArrows },
    ],
  },
  {
    label: 'Assessment',
    items: [
      { to: '/app/gaps', label: 'Gap analysis', icon: TriangleAlert, badgeKey: 'gaps' },
      { to: '/app/reports', label: 'Reports', icon: TrendingUp },
      { to: '/app/frameworks', label: 'Frameworks', icon: Sparkles },
    ],
  },
];

export function AppShell() {
  const { context, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const dashboard = useApi<DashboardData>('/api/dashboard');
  const badges = useMemo(
    () => ({
      gaps: dashboard.data?.findings.total ?? 0,
      evidence: dashboard.data?.coverage.total ?? 0,
    }),
    [dashboard.data],
  );

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const displayName = context?.user?.name ?? 'Demo user';
  const displayEmail = context?.user?.email ?? 'demo@complylens.ai';

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto scroll-area px-3 py-4" aria-label="Application">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p
            className={cn(
              'px-2 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-400 uppercase',
              collapsed && 'sr-only',
            )}
          >
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-ink-100 text-ink-900'
                        : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900',
                      collapsed && 'justify-center px-0',
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>
                  {item.badgeKey && !collapsed && badges[item.badgeKey] > 0 ? (
                    <span
                      className={cn(
                        'tnum rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold',
                        item.badgeKey === 'gaps' ? 'bg-danger-50 text-danger-700' : 'bg-ink-200 text-ink-700',
                      )}
                    >
                      {badges[item.badgeKey]}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-auto space-y-0.5 pt-2">
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900',
              collapsed && 'justify-center px-0',
            )
          }
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="size-4 shrink-0" aria-hidden="true" />
          <span className={cn('truncate', collapsed && 'sr-only')}>Settings</span>
        </NavLink>
        <NavLink
          to="/app/help"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900',
              collapsed && 'justify-center px-0',
            )
          }
          title={collapsed ? 'Help' : undefined}
        >
          <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
          <span className={cn('truncate', collapsed && 'sr-only')}>Help</span>
        </NavLink>
      </div>
    </nav>
  );

  const workspaceSwitcher = (
    <div className="border-b border-ink-200 px-3 py-3">
      <NavLink to="/app/dashboard" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink-900">
          <svg viewBox="0 0 32 32" className="size-4" aria-hidden="true">
            <circle cx="16" cy="16" r="11" fill="none" stroke="#2dd4bf" strokeWidth="3" />
            <circle cx="16" cy="16" r="4" fill="#2dd4bf" />
          </svg>
        </span>
        <span className={cn('min-w-0', collapsed && 'sr-only')}>
          <span className="block truncate text-[13px] font-semibold text-ink-900">ComplyLens</span>
          <span className="block truncate text-[11px] text-ink-500">Compliance readiness</span>
        </span>
      </NavLink>

      {!collapsed ? (
        <Dropdown
          ariaLabel="Switch workspace"
          className="mt-2"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink-200 bg-ink-50/70 px-2.5 py-2 text-left transition-colors hover:bg-ink-100"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium text-ink-900">
                  {context?.organization.name ?? 'AcmeCloud'}
                </span>
                <span className="block truncate text-[11px] text-ink-500">
                  {context?.workspace.name ?? 'AcmeCloud Demo Workspace'}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
            </button>
          )}
        >
          {() => (
            <>
              <MenuLabel>Workspaces</MenuLabel>
              {(context?.workspaces ?? []).map((workspace) => (
                <MenuItem key={workspace.id} icon={<Sparkles className="size-3.5" />}>
                  {workspace.name}
                </MenuItem>
              ))}
              <MenuSeparator />
              <div className="px-2.5 py-2">
                <Badge tone="info" size="sm">
                  {context?.workspace.isDemo ? 'Demo Workspace' : 'Live workspace'}
                </Badge>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
                  Sample organisations, users and documents are fictional and labelled as demo data throughout.
                </p>
              </div>
            </>
          )}
        </Dropdown>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-full bg-ink-50/60">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-200 bg-white lg:flex',
          collapsed ? 'w-[68px]' : 'w-[248px]',
        )}
      >
        {workspaceSwitcher}
        {nav}
        <div className="border-t border-ink-200 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
            <span className={cn(collapsed && 'sr-only')}>Collapse</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full w-[280px] max-w-[86vw] flex-col border-r border-ink-200 bg-white">
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            {workspaceSwitcher}
            {nav}
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="flex size-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden"
            >
              <Menu className="size-4.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-200 bg-ink-50/70 px-3 text-left text-[13px] text-ink-400 transition-colors hover:bg-white hover:border-ink-300 sm:max-w-sm"
            >
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Search controls, evidence, findings…</span>
              <kbd className="ml-auto hidden rounded border border-ink-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-500 sm:block">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-1.5">
              <Badge tone={context?.analysisMode.key === 'external-ai' ? 'brand' : 'outline'} size="sm" className="hidden md:inline-flex">
                <Sparkles className="size-3" aria-hidden="true" />
                {context?.analysisMode.key === 'external-ai' ? 'AI-assisted' : 'Demo Analysis Mode'}
              </Badge>

              <NotificationsMenu />

              <Dropdown
                ariaLabel="Account menu"
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-1.5 py-1.5 transition-colors hover:bg-ink-50"
                  >
                    <span className="flex size-6 items-center justify-center rounded-md bg-ink-900 text-[11px] font-semibold text-white">
                      {initials(displayName)}
                    </span>
                    <span className="hidden max-w-[140px] truncate text-[12.5px] font-medium text-ink-800 sm:block">
                      {displayName}
                    </span>
                    <ChevronDown className="size-3.5 text-ink-400" aria-hidden="true" />
                  </button>
                )}
              >
                {({ close }) => (
                  <>
                    <div className="px-2.5 py-2">
                      <p className="truncate text-[13px] font-medium text-ink-900">{displayName}</p>
                      <p className="truncate text-[11.5px] text-ink-500">{displayEmail}</p>
                      <p className="mt-1">
                        <Badge tone={context?.user?.isDemoUser ? 'info' : 'neutral'} size="sm">
                          {context?.user?.isDemoUser ? 'Demo account' : context?.user?.role ?? 'member'}
                        </Badge>
                      </p>
                    </div>
                    <MenuSeparator />
                    <MenuItem
                      icon={<UserIcon className="size-3.5" />}
                      onClick={() => {
                        navigate('/app/settings');
                        close();
                      }}
                    >
                      Profile & settings
                    </MenuItem>
                    <MenuItem
                      icon={<CircleHelp className="size-3.5" />}
                      onClick={() => {
                        navigate('/app/help');
                        close();
                      }}
                    >
                      Help & documentation
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      icon={<LogOut className="size-3.5" />}
                      tone="danger"
                      onClick={() => {
                        close();
                        void handleSignOut();
                      }}
                    >
                      Sign out
                    </MenuItem>
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-7 lg:py-8">
          <div className="mx-auto w-full max-w-[1320px]">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-ink-200 bg-white px-4 py-4 sm:px-6">
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            ComplyLens AI provides preliminary compliance readiness analysis and does not provide certification, audit
            opinions, or legal advice. {context?.workspace.isDemo
              ? 'All organisations, users and documents shown here are fictional demo data.'
              : ''}
          </p>
        </footer>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function NotificationsMenu() {
  const navigate = useNavigate();
  const dashboard = useApi<DashboardData>('/api/dashboard');
  const findings = dashboard.data?.findings ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  const items = dashboard.data?.priorityFindings.slice(0, 4) ?? [];

  return (
    <Dropdown
      ariaLabel="Notifications"
      trigger={({ toggle, open }) => (
        <Tooltip label="Priority findings">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="relative flex size-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 transition-colors hover:bg-ink-50"
          >
            <Bell className="size-4" aria-hidden="true" />
            {findings.total > 0 ? (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-danger-600 text-[10px] font-semibold text-white">
                {findings.total}
              </span>
            ) : null}
            <span className="sr-only">
              {findings.total} open findings
            </span>
          </button>
        </Tooltip>
      )}
    >
      {({ close }) => (
        <>
          <MenuLabel>Open findings</MenuLabel>
          {items.length === 0 ? (
            <p className="px-2.5 py-3 text-[12.5px] text-ink-500">
              No open findings. Upload evidence to run an assessment.
            </p>
          ) : (
            items.map((finding) => (
              <MenuItem
                key={finding.id}
                description={`${finding.controlCode} · ${finding.priority}`}
                onClick={() => {
                  navigate(`/app/gaps/${finding.id}`);
                  close();
                }}
              >
                {finding.title}
              </MenuItem>
            ))
          )}
          <MenuSeparator />
          <div className="px-2.5 py-2 text-[11.5px] text-ink-500">
            {findings.critical} critical · {findings.high} high · {findings.medium} medium · {findings.low} low
          </div>
        </>
      )}
    </Dropdown>
  );
}

export function AppLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <div className="flex flex-col items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-ink-900">
          <svg viewBox="0 0 32 32" className="size-5 animate-spin [animation-duration:2.4s]" aria-hidden="true">
            <circle cx="16" cy="16" r="11" fill="none" stroke="#2dd4bf" strokeWidth="3" strokeDasharray="40 30" />
          </svg>
        </span>
        <p className="text-[13px] text-ink-500">Loading workspace…</p>
      </div>
    </div>
  );
}
