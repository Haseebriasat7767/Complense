import { cn, scoreTone } from '@/lib/utils';

/**
 * Readiness gauge. Single value, no chart library — the ring and the number
 * are the whole message.
 */
export function ScoreRing({
  value,
  size = 148,
  stroke = 10,
  label = 'Readiness index',
  sublabel,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;
  const tone = scoreTone(clamped);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${clamped}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('metric-value', size > 120 ? 'text-3xl' : 'text-xl', tone.text)}>
          {clamped}
          <span className="text-[0.6em] align-top">%</span>
        </span>
        <span className="mt-0.5 text-[11px] font-medium tracking-wide text-ink-500 uppercase">{label}</span>
        {sublabel ? <span className="mt-1 text-[12px] text-ink-600">{sublabel}</span> : null}
      </div>
    </div>
  );
}

/** Compact horizontal score bar used in framework cards and lists. */
export function ScoreBar({
  value,
  label,
  sublabel,
  tone,
  className,
}: {
  value: number;
  label: string;
  sublabel?: string;
  tone?: string;
  className?: string;
}) {
  const resolved = tone ?? scoreTone(value).text;
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-700">{label}</span>
        <span className={cn('tnum text-[15px] font-semibold', resolved)}>{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-current transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, color: scoreTone(value).stroke }}
        />
      </div>
      {sublabel ? <p className="text-[12px] text-ink-500">{sublabel}</p> : null}
    </div>
  );
}

export function StackedStatusBar({
  passed,
  needsAttention,
  missing,
  needsReview,
  className,
  showLegend = true,
}: {
  passed: number;
  needsAttention: number;
  missing: number;
  needsReview: number;
  className?: string;
  showLegend?: boolean;
}) {
  const total = passed + needsAttention + missing + needsReview || 1;
  const segments = [
    { key: 'passed', value: passed, className: 'bg-pass-600', label: 'Passed' },
    { key: 'needsAttention', value: needsAttention, className: 'bg-warn-600', label: 'Needs attention' },
    { key: 'missing', value: missing, className: 'bg-danger-600', label: 'Missing' },
    { key: 'needsReview', value: needsReview, className: 'bg-ink-300', label: 'Needs review' },
  ];

  return (
    <div className={className}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink-100">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={cn('h-full transition-[width] duration-500', segment.className)}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      {showLegend ? (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-1.5 text-[12px] text-ink-600">
              <span className={cn('size-2 rounded-sm', segment.className)} aria-hidden="true" />
              {segment.label}
              <span className="tnum font-medium text-ink-800">{segment.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
