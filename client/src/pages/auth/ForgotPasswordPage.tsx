import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/Feedback';
import { api, ApiError } from '@/lib/api';
import { AuthFootnoteLink, AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post<{ message: string }>('/api/auth/forgot-password', { email }, { auth: false });
      setSent(response.message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The request could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address associated with your account."
      footer={
        <>
          Remembered it? <AuthFootnoteLink to="/login">Back to log in</AuthFootnoteLink>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <InlineAlert tone="info" title="Request received">
            {sent}
          </InlineAlert>
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Email delivery is not configured in this build. A production deployment would connect a transactional email
            provider and issue a single-use, time-limited reset token.
          </p>
          <Button variant="secondary" fullWidth onClick={() => setSent(null)}>
            Try another address
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
          <Field label="Work email" htmlFor="forgot-email">
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            iconLeft={<Mail className="size-4" aria-hidden="true" />}
          >
            Send reset instructions
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
