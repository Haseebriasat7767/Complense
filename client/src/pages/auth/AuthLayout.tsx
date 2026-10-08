import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, GitCompareArrows, Sparkles, TriangleAlert } from 'lucide-react';
import { Logo, useDemoEntry } from '@/components/marketing/MarketingLayout';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/session';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-8 lg:py-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ButtonLink to="/" variant="ghost" size="sm">
            Back to site
          </ButtonLink>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-center text-[13px] text-ink-500">{footer}</div> : null}
        </div>

        <p className="text-center text-[11.5px] text-ink-400 lg:text-left">
          ComplyLens AI provides preliminary compliance readiness analysis and does not provide certification, audit
          opinions, or legal advice.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-ink-200 bg-ink-900 lg:block">
        <div className="absolute inset-0 app-grid opacity-[0.08]" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-center px-12 py-16">
          <h2 className="max-w-md text-2xl leading-snug font-semibold tracking-tight text-white">
            Know what’s missing before the auditor does.
          </h2>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-ink-300">
            The demo workspace is pre-populated with a fictional company, sample evidence, mapped controls and open
            findings — so you can follow the whole journey in a couple of minutes.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              { icon: GitCompareArrows, text: 'Evidence mapped to 50 SOC 2 and ISO 27001 controls' },
              { icon: TriangleAlert, text: 'Findings ranked by risk with remediation guidance' },
              { icon: Sparkles, text: 'Readiness report generated as a PDF in one click' },
              { icon: BadgeCheck, text: 'Works with no API keys and no paid services' },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-[13.5px] text-ink-200">
                <span className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <item.icon className="size-3.5 text-brand-300" aria-hidden="true" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>

          <div className="mt-10 max-w-md rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[12px] font-medium tracking-wide text-ink-300 uppercase">Demo credentials</p>
            <p className="mt-2 font-mono text-[12.5px] text-white">demo@complylens.ai</p>
            <p className="font-mono text-[12.5px] text-white">DemoPass123!</p>
            <p className="mt-2 text-[11.5px] text-ink-400">
              Or use “Continue with Demo” — no credentials are required.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Shared demo-entry button used across the auth screens. */
export function DemoEntryPanel({ compact = false }: { compact?: boolean }) {
  const { start, loading } = useDemoEntry();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const { refresh } = useSession();

  const open = async () => {
    const ok = await start();
    if (!ok) return;
    await refresh();
    const redirect = params.get('redirect');
    toast.success('Demo workspace opened', 'Exploring fictional sample data for the AcmeCloud demo organisation.');
    navigate(redirect && redirect.startsWith('/app') ? redirect : '/app/dashboard', { replace: true });
  };

  return (
    <div className={compact ? '' : 'rounded-xl border border-ink-200 bg-ink-50/70 px-4 py-4'}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-900">Demo mode</p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Skip authentication and open the seeded demo workspace immediately.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        fullWidth
        className="mt-3"
        loading={loading}
        onClick={() => void open()}
        iconLeft={<Sparkles className="size-4" aria-hidden="true" />}
      >
        Continue with Demo
      </Button>
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
        Demo data only — fictional organisation, fictional users and synthetic documents.
      </p>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-ink-200" />
      <span className="text-[11.5px] tracking-wide text-ink-400 uppercase">or</span>
      <span className="h-px flex-1 bg-ink-200" />
    </div>
  );
}

export function AuthFootnoteLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-ink-900 underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
