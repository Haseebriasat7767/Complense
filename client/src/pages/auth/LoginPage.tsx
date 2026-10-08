import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/session';
import { ApiError } from '@/lib/api';
import { AuthDivider, AuthFootnoteLink, AuthLayout, DemoEntryPanel } from './AuthLayout';

export function LoginPage() {
  const { login, loading } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const nextFieldErrors: typeof fieldErrors = {};
    if (!email.includes('@')) nextFieldErrors.email = 'Enter the email address you signed up with.';
    if (password.length === 0) nextFieldErrors.password = 'Enter your password.';
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    try {
      await login(email, password);
      toast.success('Signed in', 'Welcome back to ComplyLens.');
      const redirect = params.get('redirect');
      navigate(redirect && redirect.startsWith('/app') ? redirect : '/app/dashboard', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Sign in failed. Check your connection and try again.',
      );
    }
  };

  return (
    <AuthLayout
      title="Log in to ComplyLens"
      subtitle="Access your compliance readiness workspace."
      footer={
        <>
          New to ComplyLens? <AuthFootnoteLink to="/signup">Create an account</AuthFootnoteLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        <Field label="Work email" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
          />
        </Field>

        <div className="flex items-center justify-between">
          <AuthFootnoteLink to="/forgot-password">Forgot password?</AuthFootnoteLink>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
          iconLeft={<LogIn className="size-4" aria-hidden="true" />}
        >
          Log in
        </Button>
      </form>

      <AuthDivider />
      <DemoEntryPanel />

      <p className="mt-4 rounded-lg border border-ink-200 bg-white px-3.5 py-3 text-[12px] leading-relaxed text-ink-500">
        Demo dataset credentials — <span className="font-mono text-ink-700">demo@complylens.ai</span> /{' '}
        <span className="font-mono text-ink-700">DemoPass123!</span>
      </p>
    </AuthLayout>
  );
}
