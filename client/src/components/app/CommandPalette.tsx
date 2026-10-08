import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LayoutDashboard, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useApi, useDebounced } from '@/lib/api';
import { cn, statusTone } from '@/lib/utils';
import type { ControlListItem, EvidenceItem, Finding } from '@/lib/types';

type Palette = {
  open: boolean;
  onClose: () => void;
};

type Result =
  | { kind: 'control'; id: string; title: string; subtitle: string; status: ControlListItem['status'] }
  | { kind: 'evidence'; id: string; title: string; subtitle: string }
  | { kind: 'finding'; id: string; title: string; subtitle: string; risk: Finding['riskLevel'] };

const QUICK_LINKS: Array<{ label: string; to: string; icon: typeof LayoutDashboard }> = [
  { label: 'Overview', to: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Evidence', to: '/app/evidence', icon: FileText },
  { label: 'Controls', to: '/app/controls', icon: ShieldCheck },
  { label: 'Gap analysis', to: '/app/gaps', icon: TriangleAlert },
];

/**
 * Command palette (⌘K / Ctrl+K). Searches controls, evidence and findings
 * through the API so results always match the workspace state.
 */
export function CommandPalette({ open, onClose }: Palette) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebounced(query, 220);

  const controls = useApi<{ items: ControlListItem[] }>(
    open && debounced.length >= 2 ? `/api/controls?search=${encodeURIComponent(debounced)}&limit=5` : null,
  );
  const evidence = useApi<{ items: EvidenceItem[] }>(
    open && debounced.length >= 2 ? `/api/evidence?search=${encodeURIComponent(debounced)}` : null,
  );
  const gaps = useApi<{ items: Finding[] }>(
    open && debounced.length >= 2 ? `/api/gaps?search=${encodeURIComponent(debounced)}&limit=5` : null,
  );

  const results = useMemo<Result[]>(() => {
    if (debounced.length < 2) return [];
    const list: Result[] = [];
    for (const item of controls.data?.items ?? []) {
      list.push({
        kind: 'control',
        id: item.id,
        title: `${item.code} · ${item.name}`,
        subtitle: `${item.framework} · ${item.category}`,
        status: item.status,
      });
    }
    for (const item of evidence.data?.items.slice(0, 4) ?? []) {
      list.push({
        kind: 'evidence',
        id: item.id,
        title: item.fileName,
        subtitle: `${item.category} · ${item.mappedControlCount} controls mapped`,
      });
    }
    for (const item of gaps.data?.items.slice(0, 5) ?? []) {
      list.push({
        kind: 'finding',
        id: item.id,
        title: item.title,
        subtitle: `${item.controlCode} · ${item.priority}`,
        risk: item.riskLevel,
      });
    }
    return list.slice(0, 12);
  }, [controls.data, evidence.data, gaps.data, debounced]);

  useEffect(() => {
    setHighlight(0);
  }, [debounced]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlight(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (results.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((value) => (value + 1) % results.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((value) => (value - 1 + results.length) % results.length);
      } else if (event.key === 'Enter') {
        const target = results[highlight];
        if (target) {
          event.preventDefault();
          openResult(target);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, highlight]);

  const openResult = (result: Result) => {
    if (result.kind === 'control') navigate(`/app/controls/${result.id}`);
    if (result.kind === 'evidence') navigate(`/app/evidence/${result.id}`);
    if (result.kind === 'finding') navigate(`/app/gaps/${result.id}`);
    onClose();
  };

  if (!open) return null;

  const loading = controls.loading || evidence.loading || gaps.loading;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]" role="presentation">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the workspace"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-ink-200 bg-white shadow-overlay animate-scale-in"
      >
        <div className="flex items-center gap-2.5 border-b border-ink-200 px-4 py-3">
          <Search className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search controls, evidence and findings…"
            aria-label="Search controls, evidence and findings"
            className="h-6 w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
          />
          <kbd className="hidden rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto scroll-area p-2">
          {debounced.length < 2 ? (
            <div className="p-2">
              <p className="px-2 pb-2 text-[11px] font-medium tracking-wide text-ink-400 uppercase">
                Jump to
              </p>
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => {
                    navigate(link.to);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-ink-100"
                >
                  <link.icon className="size-4 text-ink-400" aria-hidden="true" />
                  {link.label}
                </button>
              ))}
              <p className="px-2 pt-3 pb-1 text-[12px] text-ink-400">
                Type at least two characters to search the workspace.
              </p>
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-ink-500">
              {loading ? 'Searching…' : `No matches for “${debounced}”.`}
            </p>
          ) : (
            <ul role="listbox" aria-label="Search results">
              {results.map((result, index) => (
                <li key={`${result.kind}-${result.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => openResult(result)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
                      index === highlight ? 'bg-ink-100' : 'hover:bg-ink-50',
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-500">
                      {result.kind === 'control' ? (
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                      ) : result.kind === 'evidence' ? (
                        <FileText className="size-3.5" aria-hidden="true" />
                      ) : (
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-900">{result.title}</span>
                      <span className="block truncate text-[12px] text-ink-500">{result.subtitle}</span>
                    </span>
                    {result.kind === 'control' ? (
                      <span className={cn('text-[11px] font-medium', statusTone(result.status).text)}>
                        {statusTone(result.status).label}
                      </span>
                    ) : null}
                    {result.kind === 'finding' ? (
                      <span className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                        {result.risk}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-ink-200 bg-ink-50/60 px-4 py-2 text-[11px] text-ink-500">
          <span className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-ink-200 bg-white px-1 py-0.5 font-mono">↑</kbd>{' '}
              <kbd className="rounded border border-ink-200 bg-white px-1 py-0.5 font-mono">↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-ink-200 bg-white px-1 py-0.5 font-mono">↵</kbd> open
            </span>
          </span>
          <span>Demo workspace</span>
        </div>
      </div>
    </div>
  );
}
