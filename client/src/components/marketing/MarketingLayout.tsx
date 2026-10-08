import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

export const NAV_LINKS = [
  { to: '/features', label: 'Product' },
  { to: '/how-it-works', label: 'How it Works' },
  { to: '/security', label: 'Security' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/faq', label: 'FAQ' },
];

/** Opens the seeded demo workspace from any marketing surface. */
export function useDemoEntry() {
  const { startDemo, loading } = useSession();
  const toast = useToast();

  const start = async (): Promise<boolean> => {
    try {
      await startDemo();
      return true;
    } catch (error) {
      toast.error(
        'Demo workspace unavailable',
        error instanceof Error ? error.message : 'Please try again in a moment.',
      );
      return false;
    }
  };

  return { start, loading };
}

export function DemoButton({
  size = 'md',
  variant = 'primary',
  label = 'Try the Demo',
  className,
  fullWidth,
}: {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
  label?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const { start, loading } = useDemoEntry();
  const navigate = useNavigate();

  return (
    <Button
      size={size}
      variant={variant}
      loading={loading}
      fullWidth={fullWidth}
      className={className}
      iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
      onClick={async () => {
        if (await start()) navigate('/app/dashboard');
      }}
    >
      {label}
    </Button>
  );
}

export function Logo({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)} aria-label="ComplyLens AI home">
      <span
        className={cn(
          'flex size-7 items-center justify-center rounded-lg',
          tone === 'dark' ? 'bg-ink-900' : 'bg-white',
        )}
      >
        <svg viewBox="0 0 32 32" className="size-4" aria-hidden="true">
          <circle cx="16" cy="16" r="11" fill="none" stroke={tone === 'dark' ? '#2dd4bf' : '#0f766e'} strokeWidth="3" />
          <circle cx="16" cy="16" r="4" fill={tone === 'dark' ? '#2dd4bf' : '#0f766e'} />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn('text-[15px] font-semibold tracking-tight', tone === 'dark' ? 'text-ink-900' : 'text-white')}>
          ComplyLens
        </span>
        <span className={cn('text-[10px] tracking-[0.14em] uppercase', tone === 'dark' ? 'text-ink-400' : 'text-white/60')}>
          Readiness AI
        </span>
      </span>
    </Link>
  );
}

export function MarketingLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-colors duration-200',
          scrolled ? 'border-ink-200 bg-white shadow-subtle' : 'border-transparent bg-white',
        )}
      >
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                    isActive ? 'text-ink-900' : 'text-ink-600 hover:text-ink-900',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <ButtonLink to="/login" variant="ghost" size="sm">
              Log in
            </ButtonLink>
            <DemoButton size="sm" label="Try Demo" />
          </div>
          <button
            type="button"
            className="ml-auto flex size-9 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>

        {mobileOpen ? (
          <div id="mobile-nav" className="border-t border-ink-200 bg-white px-4 pt-3 pb-5 md:hidden">
            <nav className="flex flex-col" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg px-3 py-2.5 text-[15px] font-medium',
                      isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-700 hover:bg-ink-50',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <NavLink to="/documentation" className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink-700 hover:bg-ink-50">
                Documentation
              </NavLink>
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <DemoButton fullWidth label="Try the Demo" />
              <ButtonLink to="/login" variant="secondary" fullWidth>
                Log in
              </ButtonLink>
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <MarketingFooter />
    </div>
  );
}

export function MarketingFooter() {
  const columns: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
    {
      title: 'Product',
      links: [
        { label: 'Features', to: '/features' },
        { label: 'How it Works', to: '/how-it-works' },
        { label: 'Pricing', to: '/pricing' },
        { label: 'Security', to: '/security' },
        { label: 'FAQ', to: '/faq' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', to: '/documentation' },
        { label: 'Product overview', to: '/overview' },
        { label: 'Demo workspace', to: '/login' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', to: '/privacy' },
        { label: 'Terms', to: '/terms' },
      ],
    },
  ];

  return (
    <footer className="border-t border-ink-200 bg-ink-50/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-500">
              AI-assisted compliance readiness for SOC 2 and ISO 27001. Map evidence to controls, find the gaps and plan
              remediation before an audit window opens.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[12px] font-semibold tracking-wide text-ink-900 uppercase">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link to={link.to} className="text-[13px] text-ink-500 transition-colors hover:text-ink-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-ink-200 pt-6">
          <p className="max-w-3xl text-[12px] leading-relaxed text-ink-500">
            ComplyLens AI provides preliminary compliance readiness analysis and does not provide certification, audit
            opinions, or legal advice.
          </p>
          <p className="mt-2 text-[12px] text-ink-400">
            © {new Date().getFullYear()} ComplyLens AI. Demo build — Sample workspace data is fictional.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('px-4 py-16 sm:px-6 sm:py-20', className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11.5px] font-semibold tracking-[0.12em] text-brand-700 uppercase">{children}</p>
  );
}
