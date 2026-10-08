import {
  Bell,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Static, hand-built preview of the product UI for marketing pages.
 * Figures match the seeded demo workspace, which is labelled as demo data.
 */
export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-overlay',
        className,
      )}
      aria-hidden="true"
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-50/80 px-3 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-ink-300" />
          <span className="size-2.5 rounded-full bg-ink-300" />
          <span className="size-2.5 rounded-full bg-ink-300" />
        </span>
        <span className="mx-auto rounded-md border border-ink-200 bg-white px-3 py-1 font-mono text-[10.5px] text-ink-400">
          app.complylens.ai/app/dashboard
        </span>
        <span className="rounded-full border border-info-100 bg-info-50 px-2 py-0.5 text-[10px] font-medium text-info-700">
          Demo data
        </span>
      </div>

      <div className="flex min-h-[420px] bg-ink-50/50">
        {/* sidebar */}
        <div className="hidden w-[186px] shrink-0 flex-col border-r border-ink-200 bg-white py-3 sm:flex">
          <div className="flex items-center gap-2 px-3 pb-3">
            <span className="flex size-6 items-center justify-center rounded-md bg-ink-900">
              <svg viewBox="0 0 32 32" className="size-3.5">
                <circle cx="16" cy="16" r="11" fill="none" stroke="#2dd4bf" strokeWidth="3.5" />
                <circle cx="16" cy="16" r="4" fill="#2dd4bf" />
              </svg>
            </span>
            <span className="text-[12px] font-semibold text-ink-900">ComplyLens</span>
          </div>
          <div className="mx-3 mb-3 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5">
            <p className="text-[11px] font-medium text-ink-800">AcmeCloud</p>
            <p className="text-[10px] text-ink-500">Demo Workspace</p>
          </div>
          <ul className="space-y-0.5 px-2">
            {[
              { icon: LayoutDashboard, label: 'Overview', active: true },
              { icon: FileText, label: 'Evidence' },
              { icon: ShieldCheck, label: 'Controls' },
              { icon: GitCompareArrows, label: 'Evidence mapping' },
              { icon: TriangleAlert, label: 'Gap analysis', count: 10 },
              { icon: TrendingUp, label: 'Reports' },
              { icon: Sparkles, label: 'Frameworks' },
            ].map((item) => (
              <li
                key={item.label}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px]',
                  item.active ? 'bg-ink-100 font-medium text-ink-900' : 'text-ink-600',
                )}
              >
                <item.icon className="size-3.5" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.count ? (
                  <span className="rounded-full bg-danger-50 px-1.5 text-[10px] font-semibold text-danger-700">
                    {item.count}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-auto space-y-0.5 px-2 pt-3">
            {[
              { icon: Settings, label: 'Settings' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] text-ink-500">
                <item.icon className="size-3.5" />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* main */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 border-b border-ink-200 bg-white px-3 py-2.5">
            <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-ink-200 bg-ink-50 px-2.5 text-[11px] text-ink-400">
              <Search className="size-3.5" />
              Search controls, evidence, findings…
            </div>
            <span className="hidden items-center gap-1.5 rounded-md border border-ink-200 px-2 py-1 text-[10px] text-ink-500 md:flex">
              <Sparkles className="size-3" />
              Demo Analysis Mode
            </span>
            <span className="relative flex size-7 items-center justify-center rounded-md border border-ink-200 text-ink-500">
              <Bell className="size-3.5" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-md bg-ink-900 text-[10px] font-semibold text-white">
              DW
            </span>
          </div>

          <div className="space-y-3 p-3.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold tracking-tight text-ink-900">Good morning, AcmeCloud</p>
                <p className="text-[11.5px] text-ink-500">Here’s your compliance readiness overview.</p>
              </div>
              <span className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[10.5px] text-ink-500">
                SOC 2 · 08 Oct 2026
              </span>
            </div>

            {/* metric row */}
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
              <div className="col-span-2 rounded-xl border border-ink-200 bg-white p-3 lg:col-span-1">
                <p className="text-[10px] font-medium tracking-wide text-ink-500 uppercase">Readiness</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="metric-value text-2xl text-pass-700">92%</span>
                  <span className="rounded-full bg-pass-50 px-1.5 py-0.5 text-[9.5px] font-medium text-pass-700">
                    Strong
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full w-[92%] rounded-full bg-pass-600" />
                </div>
              </div>
              <MiniMetric label="Controls reviewed" value="24" />
              <MiniMetric label="Passed" value="18" tone="text-pass-700" />
              <MiniMetric label="Needs attention" value="4" tone="text-warn-700" />
              <MiniMetric label="Critical" value="2" tone="text-danger-700" />
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              {/* priority findings */}
              <div className="rounded-xl border border-ink-200 bg-white">
                <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
                  <p className="text-[11.5px] font-semibold text-ink-900">Priority findings</p>
                  <span className="text-[10.5px] text-ink-500">10 open</span>
                </div>
                <ul className="divide-y divide-ink-200">
                  {[
                    { code: 'SOC2-CC7.2', title: 'Security monitoring — no evidence submitted', risk: 'Critical', tone: 'danger' },
                    { code: 'SOC2-CC6.1', title: 'Periodic access reviews evidence missing', risk: 'High', tone: 'warn' },
                    { code: 'SOC2-CC9.2', title: 'Annual vendor reviews evidence missing', risk: 'High', tone: 'warn' },
                    { code: 'SOC2-CC7.3', title: 'Incident response test results missing', risk: 'Medium', tone: 'info' },
                  ].map((finding) => (
                    <li key={finding.code} className="flex items-center gap-2.5 px-3 py-2">
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          finding.tone === 'danger' ? 'bg-danger-600' : finding.tone === 'warn' ? 'bg-warn-600' : 'bg-info-600',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] text-ink-800">{finding.title}</span>
                        <span className="block font-mono text-[10px] text-ink-400">{finding.code}</span>
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide uppercase',
                          finding.tone === 'danger'
                            ? 'bg-danger-50 text-danger-700'
                            : finding.tone === 'warn'
                              ? 'bg-warn-50 text-warn-700'
                              : 'bg-info-50 text-info-700',
                        )}
                      >
                        {finding.risk}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* readiness by framework + evidence */}
              <div className="space-y-3">
                <div className="rounded-xl border border-ink-200 bg-white px-3 py-2.5">
                  <p className="text-[11.5px] font-semibold text-ink-900">Readiness overview</p>
                  <div className="mt-2.5 space-y-2.5">
                    <FrameworkRow label="SOC 2" value={92} tone="pass" />
                    <FrameworkRow label="ISO 27001" value={78} tone="brand" />
                  </div>
                </div>
                <div className="rounded-xl border border-ink-200 bg-white">
                  <div className="border-b border-ink-200 px-3 py-2">
                    <p className="text-[11.5px] font-semibold text-ink-900">Recent evidence</p>
                  </div>
                  <ul className="divide-y divide-ink-200">
                    {['Data_Protection_Policy.pdf', 'Vendor_Risk_Assessment.pdf', 'Backup_and_Recovery_Policy.pdf'].map(
                      (file) => (
                        <li key={file} className="flex items-center gap-2 px-3 py-2">
                          <FileText className="size-3.5 shrink-0 text-ink-400" />
                          <span className="min-w-0 flex-1 truncate text-[11px] text-ink-700">{file}</span>
                          <span className="rounded-full bg-pass-50 px-1.5 py-0.5 text-[9.5px] font-medium text-pass-700">
                            Analyzed
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3">
      <p className="text-[10px] font-medium tracking-wide text-ink-500 uppercase">{label}</p>
      <p className={cn('metric-value mt-1.5 text-xl', tone)}>{value}</p>
    </div>
  );
}

function FrameworkRow({ label, value, tone }: { label: string; value: number; tone: 'pass' | 'brand' }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] text-ink-700">{label}</span>
        <span className={cn('tnum text-[12px] font-semibold', tone === 'pass' ? 'text-pass-700' : 'text-brand-700')}>
          {value}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full', tone === 'pass' ? 'bg-pass-600' : 'bg-brand-600')}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
