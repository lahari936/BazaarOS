import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Loader2, X, RotateCw } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';

export const cx = (...c) => c.filter(Boolean).join(' ');

export function Card({ className, children, ...p }) {
  return <div className={cx('rounded-2xl border border-line bg-surface shadow-card', className)} {...p}>{children}</div>;
}

const BTN = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-mint text-primary hover:bg-green-200',
  ghost: 'text-ink hover:bg-black/5',
  outline: 'border border-line bg-surface hover:bg-bg',
  danger: 'bg-danger text-white hover:bg-red-700',
};
export function Button({ variant = 'primary', loading, className, children, ...p }) {
  return (
    <button className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', BTN[variant], className)} disabled={loading || p.disabled} {...p}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
export const inputCls = 'w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20';
export const Input = (p) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = ({ children, ...p }) => <select {...p} className={cx(inputCls, p.className)}>{children}</select>;

const BADGE = { green: 'bg-mint text-primary', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', gray: 'bg-slate-100 text-slate-600', blue: 'bg-sky-100 text-sky-800' };
export const Badge = ({ tone = 'gray', children, className }) => <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', BADGE[tone], className)}>{children}</span>;

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted"><Loader2 className="size-5 animate-spin" />{label}</div>
);

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">{error}</div>
      {onRetry && <button onClick={onRetry} className="inline-flex items-center gap-1 font-semibold"><RotateCw className="size-3.5" />Retry</button>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {Icon && <div className="rounded-2xl bg-mint p-3 text-primary"><Icon className="size-6" /></div>}
      <div className="font-semibold">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Close"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** GET with loading/error/reload. */
export function useFetch(url, deps = []) {
  const [s, set] = useState({ data: null, loading: true, error: null });
  const load = useCallback(async () => {
    set((p) => ({ ...p, loading: true, error: null }));
    try { set({ data: (await api.get(url)).data, loading: false, error: null }); }
    catch (e) { set((p) => ({ ...p, loading: false, error: errMsg(e) })); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { ...s, reload: load, setData: (data) => set((p) => ({ ...p, data })) };
}
