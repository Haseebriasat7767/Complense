import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
};

/** Keyboard-accessible tab list with roving focus (Left/Right/Home/End). */
export function Tabs({
  items,
  active,
  onChange,
  className,
  size = 'md',
  ariaLabel = 'Sections',
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === active);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    const target = items[next];
    if (!target) return;
    onChange(target.id);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'flex items-center gap-1 overflow-x-auto scroll-area border-b border-ink-200',
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            id={`${baseId}-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative -mb-px flex shrink-0 items-center gap-2 border-b-2 font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-2 text-[12px]' : 'px-3 py-2.5 text-[13px]',
              selected
                ? 'border-ink-900 text-ink-900'
                : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800',
              index === 0 && 'pl-0',
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: string;
  children: ReactNode;
  className?: string;
}) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" className={cn('animate-fade', className)}>
      {children}
    </div>
  );
}

/** Segmented control used for compact filters. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  ariaLabel,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-lg border border-ink-200 bg-ink-50 p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2 py-1 text-[12px]' : 'px-2.5 py-1.5 text-[12.5px]',
              selected ? 'bg-white text-ink-900 shadow-subtle' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('tnum text-[11px]', selected ? 'text-ink-500' : 'text-ink-400')}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
