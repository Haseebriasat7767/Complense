import { Eyebrow, Section } from '@/components/marketing/MarketingLayout';

type LegalSection = { heading: string; body: string[] };

const PRIVACY: LegalSection[] = [
  {
    heading: 'Summary',
    body: [
      'This is a demonstration build of ComplyLens AI. It has no customers and no production data. The sample workspace ("AcmeCloud") is fictional and every document in it is synthetic.',
      'If you run this software yourself, you are the operator: the sections below describe what the code does so you can describe it accurately to your own users.',
    ],
  },
  {
    heading: 'Data the application stores',
    body: [
      'Account data: name, email address, job title, role and a scrypt password hash. Session tokens are signed with HMAC-SHA256 and expire based on the configured session lifetime.',
      'Workspace data: organisation and workspace names, settings, evidence metadata (file name, type, size, category, upload timestamp, analysis status), the extracted text of uploaded documents, generated report snapshots and an activity log of workspace actions.',
    ],
  },
  {
    heading: 'Data the application does not store',
    body: [
      'Uploaded files are parsed in memory and discarded. The original binary is never written to disk and there is no endpoint that serves it back.',
      'No analytics, advertising or tracking scripts are included in the client bundle. No third-party service receives data by default.',
    ],
  },
  {
    heading: 'Optional AI provider',
    body: [
      'If an operator configures an OpenAI-compatible endpoint and sets AI_ALLOW_EXTERNAL=true, evidence text excerpts and report figures may be sent to that provider to improve summary wording. External AI is disabled by default and the product works fully without it.',
      'Operators enabling an external provider are responsible for the contractual and regulatory basis for that transfer.',
    ],
  },
  {
    heading: 'Retention and deletion',
    body: [
      'In the default in-memory mode, all data disappears when the process stops. With Supabase PostgreSQL configured, retention is controlled by the operator; the organisation settings include a retention preference that roadmap versions will enforce.',
      'Evidence documents and reports can be deleted from the workspace at any time, and deletions are recorded in the activity log.',
    ],
  },
  {
    heading: 'Your choices',
    body: [
      'You can contact the operator of any deployment you use to request access to, correction of, or deletion of your account data. In this demo build, accounts are reset whenever the server restarts.',
    ],
  },
];

const TERMS: LegalSection[] = [
  {
    heading: '1. What this product is',
    body: [
      'ComplyLens AI is a compliance readiness and gap-analysis tool. It analyses evidence submitted to a workspace and reports how that evidence maps to controls in frameworks such as SOC 2 and ISO 27001.',
      'It is not an auditor, a certification body, a legal service, a compliance guarantee or a replacement for an external auditor. Nothing it produces is a certification, an audit opinion, or legal advice.',
    ],
  },
  {
    heading: '2. Demo build and sample data',
    body: [
      'This build ships with a fictional sample organisation, fictional users and synthetic documents, all labelled as demo data. Any resemblance to a real company is coincidental.',
      'Pricing shown in the application is demonstration pricing. No payment provider is connected and no charges are made.',
    ],
  },
  {
    heading: '3. No warranty of compliance',
    body: [
      'Results are produced by a deterministic rule-based analysis engine (and optionally wording assistance from a language model). They reflect only the documents present in the workspace at the time of analysis.',
      'Readiness scores are weighted composites defined in the product, not statements of fact about your security posture, and they must not be presented to customers, auditors or regulators as evidence of compliance or certification.',
    ],
  },
  {
    heading: '4. Acceptable use',
    body: [
      'Do not upload data you are not authorised to process. If you upload third-party or personal data, you are responsible for having a lawful basis to do so.',
      'Do not present generated reports as certification, audit opinions or legal advice.',
    ],
  },
  {
    heading: '5. Operator responsibility',
    body: [
      'Session secrets, database credentials, TLS termination, backups, access reviews and log retention are the responsibility of the operator running this software.',
      'Control libraries included in the repository are demonstration datasets. Operators requiring licensed framework text must supply it themselves.',
    ],
  },
  {
    heading: '6. Limitation of liability',
    body: [
      'This software is provided as-is for demonstration and evaluation purposes. The authors accept no liability for decisions made on the basis of its output, including audit preparation, customer commitments or regulatory filings.',
    ],
  },
];

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const isPrivacy = kind === 'privacy';
  const sections = isPrivacy ? PRIVACY : TERMS;

  return (
    <Section className="max-w-3xl">
      <Eyebrow>{isPrivacy ? 'Privacy' : 'Terms'}</Eyebrow>
      <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">
        {isPrivacy ? 'Privacy notice' : 'Terms of use'}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
        {isPrivacy
          ? 'How this application handles data — written for a demo build that contains no real customer information.'
          : 'The terms that apply to this demonstration build of ComplyLens AI.'}
      </p>
      <p className="mt-3 text-[12.5px] text-ink-400">Last updated: 8 October 2026</p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[16px] font-semibold text-ink-900">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-3 text-[13.5px] leading-relaxed text-ink-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-ink-200 bg-ink-50 px-5 py-4">
        <p className="text-[12.5px] leading-relaxed text-ink-500">
          ComplyLens AI provides preliminary compliance readiness analysis and does not provide certification, audit
          opinions, or legal advice. This page is part of a demonstration product and is not a substitute for legal
          review of your own deployment.
        </p>
      </div>
    </Section>
  );
}
