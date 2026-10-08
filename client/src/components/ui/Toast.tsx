import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
};

type ToastContextValue = {
  push: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONES: Record<ToastTone, { icon: ReactNode; ring: string; iconClass: string }> = {
  success: {
    icon: <CheckCircle2 className="size-4.5" aria-hidden="true" />,
    ring: 'border-pass-100',
    iconClass: 'text-pass-600',
  },
  error: {
    icon: <XCircle className="size-4.5" aria-hidden="true" />,
    ring: 'border-danger-100',
    iconClass: 'text-danger-600',
  },
  warning: {
    icon: <AlertTriangle className="size-4.5" aria-hidden="true" />,
    ring: 'border-warn-100',
    iconClass: 'text-warn-600',
  },
  info: { icon: <Info className="size-4.5" aria-hidden="true" />, ring: 'border-info-100', iconClass: 'text-info-600' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<ToastContextValue['push']>((toast) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { ...toast, id, duration: toast.duration ?? 5200 }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ tone: 'success', title, description }),
      error: (title, description) => push({ tone: 'error', title, description, duration: 7200 }),
      info: (title, description) => push({ tone: 'info', title, description }),
      warning: (title, description) => push({ tone: 'warning', title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const tone = TONES[toast.tone];

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-xl border bg-white px-4 py-3 shadow-raised animate-in-up',
        tone.ring,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 shrink-0', tone.iconClass)}>{tone.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink-900">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{toast.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-mt-0.5 -mr-1 flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
