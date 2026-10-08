import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Click-outside + Escape aware popover menu. */
export function Dropdown({
  trigger,
  children,
  align = 'right',
  className,
  panelClassName,
  ariaLabel,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  panelClassName?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((value) => !value), id })}
      {open ? (
        <div
          role="menu"
          aria-label={ariaLabel}
          id={id}
          className={cn(
            'absolute z-40 mt-2 min-w-56 overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-overlay animate-scale-in',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  icon,
  tone = 'default',
  description,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  description?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
        tone === 'danger' ? 'text-danger-700 hover:bg-danger-50' : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0 text-ink-400">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block truncate font-medium">{children}</span>
        {description ? <span className="mt-0.5 block text-[12px] text-ink-500">{description}</span> : null}
      </span>
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-ink-400 uppercase">{children}</p>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-ink-200" role="separator" />;
}

/** Small informational tooltip on hover/focus. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-1.5 text-[11.5px] leading-snug font-normal text-white opacity-0 shadow-raised transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
