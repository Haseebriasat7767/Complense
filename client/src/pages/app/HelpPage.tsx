import { Link } from 'react-router-dom';
import { BookOpen, Command, FileQuestion, LifeBuoy, Sparkles } from 'lucide-react';
import { Badge, DemoDataBadge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/app/PageHeader';
import { useSession } from '@/lib/session';

const WALKTHROUGH = [
  {
    title: '1 · Upload or use demo evidence',
    body: 'Open Evidence to see the eight sample documents, or drag in your own PDF, DOCX, TXT or CSV file (up to 8 MB).',
    to: '/app/evidence',
    label: 'Go to Evidence',
  },
  {
    title: '2 · Review the analysis',
    body: 'Each document is classified into a category, matched against required evidence and mapped to the controls it supports.',
    to: '/app/mappings',
    label: 'Go to Evidence mapping',
  },
  {
    title: '3 · Inspect controls',
    body: 'The control library shows status passed / needs attention / missing / needs review, with the analysis behind each status.',
    to: '/app/controls',
    label: 'Go to Controls',
  },
  {
    title: '4 · Work the gap list',
    body: 'Findings are ranked by risk with a recommended fix, owner and timeline. Start with the critical and high items.',
    to: '/app/gaps',
    label: 'Go to Gap analysis',
  },
  {
    title: '5 · Generate the readiness report',
    body: 'Produce a PDF readiness assessment for the current evidence snapshot and download it straight from the browser.',
    to: '/app/reports',
    label: 'Go to Reports',
  },
];

const SHORTCUTS = [
  { keys: '⌘ K / Ctrl K', action: 'Open the command palette and jump to any control, document or finding' },
  { keys: 'Esc', action: 'Close the command palette, modal or mobile navigation drawer' },
  { keys: 'Tab', action: 'Move through interactive elements — every control has a visible focus ring' },
  { keys: '↑ ↓ then Enter', action: 'Move through command palette results and open the highlighted item' },
];

export function HelpPage() {
  const { context } = useSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & demo guide"
        subtitle="Everything this build does, in the order that shows it best. Nothing here requires an API key or an external account."
        meta={<DemoDataBadge />}
      />

      <InlineAlert tone="info" title="What this product is">
        ComplyLens AI produces a readiness assessment from the evidence you provide. It is not a certification, an audit
        opinion, or a substitute for professional compliance advice.
      </InlineAlert>

      <Card>
        <CardHeader
          title="Five-minute demo walkthrough"
          description="Follow the steps in order for the full evidence-to-report journey"
          icon={<BookOpen className="size-4" aria-hidden="true" />}
        />
        <ol className="divide-y divide-ink-100">
          {WALKTHROUGH.map((step) => (
            <li key={step.title} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink-900">{step.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{step.body}</p>
              </div>
              <ButtonLink to={step.to} variant="secondary" size="sm" className="shrink-0">
                {step.label}
              </ButtonLink>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Keyboard and accessibility"
            description="The workspace is fully keyboard navigable"
            icon={<Command className="size-4" aria-hidden="true" />}
          />
          <CardContent>
            <ul className="space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.keys} className="flex items-start gap-3">
                  <kbd className="mt-0.5 shrink-0 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 font-mono text-[11px] text-ink-700">
                    {shortcut.keys}
                  </kbd>
                  <span className="text-[12.5px] leading-relaxed text-ink-600">{shortcut.action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Analysis modes"
            description="The engine never fails because a key is missing"
            icon={<Sparkles className="size-4" aria-hidden="true" />}
          />
          <CardContent className="space-y-3 text-[12.5px] leading-relaxed text-ink-600">
            <div className="rounded-lg border border-ink-200 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <Badge tone="info" size="sm">Demo Analysis Mode</Badge>
                <span className="text-[12px] text-ink-500">Current mode</span>
              </div>
              <p className="mt-2">
                Deterministic local analysis: keyword, category and required-evidence rules run inside the server. The same
                demo workspace always produces the same scores — SOC 2 92% and ISO 27001 78%.
              </p>
            </div>
            <div className="rounded-lg border border-ink-200 px-3.5 py-3">
              <Badge tone="neutral" size="sm">AI-assisted (optional)</Badge>
              <p className="mt-2">
                If a server-side provider and key are configured, narrative wording can be generated by that provider. The
                analysis, scoring and control mapping stay deterministic either way, and the mode is always disclosed on the
                dashboard and in reports.
              </p>
            </div>
            <p className="text-[12px] text-ink-500">
              Current mode:{' '}
              <span className="font-medium text-ink-700">
                {context?.analysisMode.label ?? 'Demo Analysis Mode (deterministic local analysis)'}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Frequently asked questions"
          description="Short answers about the demo, data and limits"
          icon={<FileQuestion className="size-4" aria-hidden="true" />}
        />
        <CardContent className="divide-y divide-ink-100">
          {[
            {
              q: 'Is the demo data real?',
              a: 'No. AcmeCloud, its evidence documents, findings and scores are synthetic sample data generated by the app and labelled “Demo Data” throughout.',
            },
            {
              q: 'Do I need an account?',
              a: 'No. “Try the Demo” issues a demo session immediately. You can also sign up to create your own organisation and workspace.',
            },
            {
              q: 'Do I need an API key?',
              a: 'No. The whole journey — upload, analysis, mapping, gaps, remediation and the PDF report — runs with zero external services.',
            },
            {
              q: 'Does the report certify anything?',
              a: 'No. It is a preliminary readiness assessment generated from the evidence in this workspace. It is not a certification, an audit opinion or professional advice.',
            },
            {
              q: 'Where is my data stored?',
              a: 'In the demo deployment records live in the server process memory and reset when it restarts. Set MONGODB_URI to persist workspace data in MongoDB.',
            },
            {
              q: 'Which frameworks are supported?',
              a: 'The demo control library covers SOC 2 Trust Services Criteria (28 controls) and ISO/IEC 27001 Annex A (22 controls) across 14 categories. Roadmap items such as HIPAA, PCI DSS and automated evidence collection are documented, not implemented.',
            },
          ].map((entry) => (
            <details key={entry.q} className="group px-1 py-3.5">
              <summary className="cursor-pointer text-[13px] font-medium text-ink-800 marker:text-ink-400">
                {entry.q}
              </summary>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-600">{entry.a}</p>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="More resources"
          description="Documentation, product overview and policies"
          icon={<LifeBuoy className="size-4" aria-hidden="true" />}
        />
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/documentation" className="rounded-lg border border-ink-200 px-3.5 py-3 hover:border-ink-300 hover:bg-ink-50">
            <p className="text-[13px] font-medium text-ink-900">Documentation</p>
            <p className="mt-0.5 text-[12px] text-ink-500">Architecture, API, data model, deployment</p>
          </Link>
          <Link to="/overview" className="rounded-lg border border-ink-200 px-3.5 py-3 hover:border-ink-300 hover:bg-ink-50">
            <p className="text-[13px] font-medium text-ink-900">Product overview</p>
            <p className="mt-0.5 text-[12px] text-ink-500">Problem, features, technology, status</p>
          </Link>
          <Link to="/security" className="rounded-lg border border-ink-200 px-3.5 py-3 hover:border-ink-300 hover:bg-ink-50">
            <p className="text-[13px] font-medium text-ink-900">Security</p>
            <p className="mt-0.5 text-[12px] text-ink-500">How evidence and accounts are handled</p>
          </Link>
          <Link to="/privacy" className="rounded-lg border border-ink-200 px-3.5 py-3 hover:border-ink-300 hover:bg-ink-50">
            <p className="text-[13px] font-medium text-ink-900">Privacy</p>
            <p className="mt-0.5 text-[12px] text-ink-500">What the demo stores and for how long</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
