import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('relative overflow-hidden rounded-md bg-ink-100', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="surface p-5">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1">
              <SkeletonText lines={2} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-400">
        {icon ?? <Inbox className="size-5" aria-hidden="true" />}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-500">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  offline = false,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  offline?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('rounded-xl border border-danger-100 bg-danger-50 px-5 py-6 text-center', className)}
    >
      <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-white text-danger-600">
        {offline ? <WifiOff className="size-4.5" aria-hidden="true" /> : <AlertTriangle className="size-4.5" aria-hidden="true" />}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-600">
        {description ?? 'The request could not be completed. Please try again.'}
      </p>
      {onRetry ? (
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="secondary" iconLeft={<RefreshCw className="size-3.5" />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  tone = 'info',
  title,
  children,
  className,
  icon,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'pass' | 'neutral';
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const tones = {
    info: 'border-info-100 bg-info-50 text-info-700',
    warn: 'border-warn-100 bg-warn-50 text-warn-700',
    danger: 'border-danger-100 bg-danger-50 text-danger-700',
    pass: 'border-pass-100 bg-pass-50 text-pass-700',
    neutral: 'border-ink-200 bg-ink-50 text-ink-600',
  } as const;

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[13px]', tones[tone], className)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn('text-[13px] leading-relaxed', Boolean(title) && 'mt-0.5 opacity-90')}>{children}</div> : null}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  size = 'md',
  label,
}: {
  value: number;
  tone?: 'brand' | 'pass' | 'warn' | 'danger' | 'ink';
  size?: 'sm' | 'md';
  label?: string;
}) {
  const tones = {
    brand: 'bg-brand-600',
    pass: 'bg-pass-600',
    warn: 'bg-warn-600',
    danger: 'bg-danger-600',
    ink: 'bg-ink-800',
  } as const;
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-ink-100', size === 'sm' ? 'h-1.5' : 'h-2')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
