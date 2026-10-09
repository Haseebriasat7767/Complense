import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Checkbox } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/session';
import { ApiError } from '@/lib/api';
import { AuthDivider, AuthFootnoteLink, AuthLayout, DemoEntryPanel } from './AuthLayout';

export function SignupPage() {
  const { signup, loading } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    organizationName: '',
    jobTitle: '',
  });
  const [seedDemo, setSeedDemo] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!form.email.includes('@')) next.email = 'Enter a valid work email address.';
    if (form.password.length < 10) next.password = 'Use at least 10 characters.';
    else if (!(/[a-z]/.test(form.password) && /\d/.test(form.password)) && !/[A-Z]/.test(form.password)) {
      next.password = 'Include at least two of: lowercase letters, uppercase letters, numbers.';
    }
    if (form.organizationName.trim().length < 2) next.organizationName = 'Enter your organisation name.';
    if (!accepted) next.accepted = 'Please acknowledge how the demo handles data.';
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      const result = await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        organizationName: form.organizationName,
        jobTitle: form.jobTitle || undefined,
        seedDemo,
      });
      toast.success(
        'Account created',
        seedDemo
          ? 'Your workspace includes clearly labelled sample documents so you can evaluate the analysis immediately.'
          : 'Your workspace is empty — upload your first evidence document to run an assessment.',
      );
      if (result.persistence === 'memory') {
        toast.info(
          'In-memory demo store',
          'This deployment stores data in memory, so accounts reset when the server restarts. Configure Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY) to persist.',
        );
      }
      navigate('/app/dashboard', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Account creation failed. Please try again.');
    }
  };

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start a readiness assessment for SOC 2 or ISO 27001 in under a minute."
      footer={
        <>
          Already have an account? <AuthFootnoteLink to="/login">Log in</AuthFootnoteLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
            <Input id="name" value={form.name} onChange={update('name')} autoComplete="name" placeholder="Alex Morgan" />
          </Field>
          <Field label="Job title" htmlFor="jobTitle" optional>
            <Input id="jobTitle" value={form.jobTitle} onChange={update('jobTitle')} placeholder="Head of Security" />
          </Field>
        </div>

        <Field label="Work email" htmlFor="signup-email" error={fieldErrors.email}>
          <Input
            id="signup-email"
            type="email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
            placeholder="you@company.com"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="signup-password"
          error={fieldErrors.password}
          hint="At least 10 characters, including two of: lowercase, uppercase and numbers."
        >
          <Input
            id="signup-password"
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            placeholder="••••••••••"
          />
        </Field>

        <Field label="Organisation" htmlFor="organizationName" error={fieldErrors.organizationName}>
          <Input
            id="organizationName"
            value={form.organizationName}
            onChange={update('organizationName')}
            autoComplete="organization"
            placeholder="Northwind Labs"
          />
        </Field>

        <div className="rounded-lg border border-ink-200 bg-ink-50/70 px-3.5 py-3">
          <Checkbox
            checked={seedDemo}
            onChange={setSeedDemo}
            label="Start with sample evidence"
            description="Loads the labelled demo document set so the analysis, mapping and gap views are populated immediately. You can delete it at any time."
          />
          <div className="mt-3 border-t border-ink-200 pt-3">
            <Checkbox
              checked={accepted}
              onChange={setAccepted}
              label="I understand this is a readiness tool, not a certification."
              description="ComplyLens AI does not provide certification, audit opinions or legal advice."
            />
            {fieldErrors.accepted ? (
              <p className="mt-1.5 text-[12px] text-danger-700" role="alert">
                {fieldErrors.accepted}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
          iconLeft={<UserPlus className="size-4" aria-hidden="true" />}
        >
          Create account
        </Button>
      </form>

      <AuthDivider />
      <DemoEntryPanel />
    </AuthLayout>
  );
}
