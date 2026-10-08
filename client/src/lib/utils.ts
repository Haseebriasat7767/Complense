import type { ControlStatus, EvidenceStatus, RiskLevel } from './types';

/** Tailwind-friendly className joiner. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type StatusTone = {
  label: string;
  text: string;
  bg: string;
  border: string;
  dot: string;
  solid: string;
};

const STATUS_TONES: Record<ControlStatus, StatusTone> = {
  passed: {
    label: 'Passed',
    text: 'text-pass-700',
    bg: 'bg-pass-50',
    border: 'border-pass-100',
    dot: 'bg-pass-600',
    solid: 'bg-pass-600',
  },
  needs_attention: {
    label: 'Needs attention',
    text: 'text-warn-700',
    bg: 'bg-warn-50',
    border: 'border-warn-100',
    dot: 'bg-warn-600',
    solid: 'bg-warn-600',
  },
  missing: {
    label: 'Missing',
    text: 'text-danger-700',
    bg: 'bg-danger-50',
    border: 'border-danger-100',
    dot: 'bg-danger-600',
    solid: 'bg-danger-600',
  },
  needs_review: {
    label: 'Needs review',
    text: 'text-ink-600',
    bg: 'bg-ink-100',
    border: 'border-ink-200',
    dot: 'bg-ink-400',
    solid: 'bg-ink-500',
  },
};

export function statusTone(status: ControlStatus): StatusTone {
  return STATUS_TONES[status] ?? STATUS_TONES.needs_review;
}

const RISK_TONES: Record<RiskLevel, StatusTone> = {
  critical: { ...STATUS_TONES.missing, label: 'Critical' },
  high: { ...STATUS_TONES.needs_attention, label: 'High' },
  medium: {
    label: 'Medium',
    text: 'text-info-700',
    bg: 'bg-info-50',
    border: 'border-info-100',
    dot: 'bg-info-600',
    solid: 'bg-info-600',
  },
  low: { ...STATUS_TONES.passed, label: 'Low' },
};

export function riskTone(risk: RiskLevel): StatusTone {
  return RISK_TONES[risk] ?? RISK_TONES.low;
}

const EVIDENCE_TONES: Record<EvidenceStatus, StatusTone> = {
  analyzed: { ...STATUS_TONES.passed, label: 'Analyzed' },
  analyzing: {
    label: 'Analyzing',
    text: 'text-info-700',
    bg: 'bg-info-50',
    border: 'border-info-100',
    dot: 'bg-info-600',
    solid: 'bg-info-600',
  },
  needs_review: { ...STATUS_TONES.needs_attention, label: 'Needs review' },
  failed: { ...STATUS_TONES.missing, label: 'Failed' },
};

export function evidenceTone(status: EvidenceStatus): StatusTone {
  return EVIDENCE_TONES[status] ?? EVIDENCE_TONES.needs_review;
}

export function scoreTone(index: number): { text: string; stroke: string; label: string } {
  if (index >= 85) return { text: 'text-pass-700', stroke: '#16a34a', label: 'Strong readiness' };
  if (index >= 70) return { text: 'text-brand-700', stroke: '#0d9488', label: 'Moderate readiness' };
  if (index >= 50) return { text: 'text-warn-700', stroke: '#d97706', label: 'At risk' };
  return { text: 'text-danger-700', stroke: '#dc2626', label: 'Critical gaps' };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CL';
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatDate(value);
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
