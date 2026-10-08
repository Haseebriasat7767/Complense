import type { ReactNode } from 'react';
import { cn, evidenceTone, riskTone, statusTone } from '@/lib/utils';
import type { ControlStatus, EvidenceStatus, Priority, RiskLevel } from '@/lib/types';

export function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'pass' | 'warn' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
  icon?: ReactNode;
}) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700 border-ink-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-100',
    pass: 'bg-pass-50 text-pass-700 border-pass-100',
    warn: 'bg-warn-50 text-warn-700 border-warn-100',
    danger: 'bg-danger-50 text-danger-700 border-danger-100',
    info: 'bg-info-50 text-info-700 border-info-100',
    outline: 'bg-white text-ink-600 border-ink-200',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  className,
}: {
  status: ControlStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        tone.bg,
        tone.text,
        tone.border,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      {label ?? tone.label}
    </span>
  );
}

export function RiskBadge({
  risk,
  size = 'md',
  showDot = false,
  className,
}: {
  risk: RiskLevel;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}) {
  const tone = riskTone(risk);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-semibold tracking-wide uppercase',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        tone.bg,
        tone.text,
        tone.border,
        className,
      )}
    >
      {showDot ? <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true" /> : null}
      {tone.label}
    </span>
  );
}

export function EvidenceStatusBadge({ status, size = 'md' }: { status: EvidenceStatus; size?: 'sm' | 'md' }) {
  const tone = evidenceTone(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        tone.bg,
        tone.text,
        tone.border,
      )}
    >
      {status === 'analyzing' ? (
        <span className="relative flex size-1.5" aria-hidden="true">
          <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-75', tone.dot)} />
          <span className={cn('relative inline-flex size-1.5 rounded-full', tone.dot)} />
        </span>
      ) : (
        <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      )}
      {tone.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center rounded-md border border-ink-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-600">
      {priority}
    </span>
  );
}

export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <Badge tone="info" size="sm" className={cn('font-mono tracking-wide uppercase', className)}>
      Demo data
    </Badge>
  );
}
