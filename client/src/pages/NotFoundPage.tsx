import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';

export function NotFoundPage({ insideApp = false }: { insideApp?: boolean }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <EmptyState
        icon={<Compass className="size-5" aria-hidden="true" />}
        title="This page does not exist"
        description={
          insideApp
            ? 'The link may be outdated or the resource may have been removed from this workspace. Try the dashboard or the command palette (⌘K).'
            : 'The page you are looking for has moved or never existed. The product tour starts on the landing page.'
        }
        action={
          <ButtonLink
            to={insideApp ? '/app/dashboard' : '/'}
            variant="primary"
            iconLeft={<ArrowLeft className="size-4" aria-hidden="true" />}
          >
            {insideApp ? 'Back to the dashboard' : 'Back to the landing page'}
          </ButtonLink>
        }
        secondaryAction={
          insideApp ? (
            <ButtonLink to="/app/gaps" variant="secondary">
              View gap analysis
            </ButtonLink>
          ) : (
            <ButtonLink to="/overview" variant="secondary">
              Product overview
            </ButtonLink>
          )
        }
        className="w-full"
      />
    </div>
  );
}
