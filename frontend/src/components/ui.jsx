import { useNavigate } from 'react-router-dom';

export const STATUS = {
  planned: { label: 'Жоспарланған', dot: 'bg-status-planned', text: 'text-status-planned', soft: 'bg-status-planned/15', bar: 'bg-status-planned' },
  arrived: { label: 'Келді', dot: 'bg-status-reached', text: 'text-status-reached', soft: 'bg-status-reached/15', bar: 'bg-status-reached' },
  in_progress: { label: 'Жұмыста', dot: 'bg-status-progress', text: 'text-status-progress', soft: 'bg-status-progress/15', bar: 'bg-status-progress' },
  completed: { label: 'Аяқталды', dot: 'bg-status-completed', text: 'text-status-completed', soft: 'bg-status-completed/15', bar: 'bg-status-completed' },
  no_show: { label: 'Болмады', dot: 'bg-status-no-show', text: 'text-status-no-show', soft: 'bg-status-no-show/15', bar: 'bg-status-no-show' },
};

export function StatusPill({ status, className = '' }) {
  const s = STATUS[status] || STATUS.no_show;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.soft} ${s.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** Kazakhstan-style licence plate: "777 ABK 02" on a white plate with the flag strip. */
export function Plate({ number, size = 'md' }) {
  if (!number) return null;
  const text = size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-lg' : 'text-sm';
  return (
    <span className="kz-plate">
      <span className="kz-plate-flag">KZ</span>
      <span className={`kz-plate-text ${text}`}>{number}</span>
    </span>
  );
}

/** Sticky page header with a back button. `onBack` defaults to history back. */
export function PageHeader({ title, subtitle, onBack, back = true, right = null }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <button type="button" onClick={onBack || (() => navigate(-1))} className="icon-btn -ml-1" aria-label="Артқа">
          <span className="material-symbols-outlined text-ink text-[22px]">arrow_back</span>
        </button>
      )}
      <div className={`min-w-0 flex-1 ${back ? '' : 'pl-1'}`}>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted truncate">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-text-muted text-sm">
      <span className="w-4 h-4 rounded-full border-2 border-border-color border-t-primary animate-spin" />
      Жүктелуде...
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, hint, action = null }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <span className="material-symbols-outlined text-[40px] text-faint mb-3">{icon}</span>
      <p className="text-ink font-semibold">{title}</p>
      {hint && <p className="text-text-muted text-sm mt-1 max-w-[260px]">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger" role="alert">
      <span className="material-symbols-outlined text-[18px] mt-px">error</span>
      <span>{children}</span>
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on wide screens. */
export function Sheet({ title, onClose, children, busy = false }) {
  return (
    <div className="scrim" onClick={() => !busy && onClose?.()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-border-color sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} className="icon-btn -mr-2" aria-label="Жабу">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
