import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/Store';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-white p-4 dark:border-[#2a2e38] dark:bg-[#171a21] ${className}`}>
      {children}
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-lg font-semibold">{children}</h2>;
}
export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-4 mb-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{children}</h3>;
}
export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-sm text-neutral-500 dark:text-neutral-400 ${className}`}>{children}</div>;
}

type Variant = 'primary' | 'default' | 'ok' | 'danger' | 'ghost';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white border-accent',
  default: 'bg-white text-ink border-line dark:bg-[#1f232b] dark:text-neutral-100 dark:border-[#2a2e38]',
  ok: 'bg-accent-soft text-accent border-accent/30 dark:bg-[#123a22] dark:text-[#8fe3ad]',
  danger: 'bg-danger-soft text-danger border-danger/30 dark:bg-[#3a1512] dark:text-[#f3a097]',
  ghost: 'bg-transparent text-ink border-transparent dark:text-neutral-100',
};

export function Button({
  variant = 'default',
  className = '',
  full = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean }) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 text-[15px] font-medium active:scale-[0.98] disabled:opacity-50 ${VARIANT[variant]} ${full ? 'w-full' : ''} ${className}`}
    />
  );
}

export function Chip({
  on = false,
  dim = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; dim?: boolean }) {
  return (
    <button
      {...rest}
      className={`min-h-[40px] rounded-full border px-3.5 text-[14px] leading-tight ${
        on
          ? 'border-accent bg-accent text-white'
          : 'border-line bg-white text-ink dark:border-[#2a2e38] dark:bg-[#1f232b] dark:text-neutral-100'
      } ${dim ? 'opacity-45' : ''}`}
    >
      {children}
    </button>
  );
}

export function Chips({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>;
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'weak' | 'mid' | 'done'; children: ReactNode }) {
  const cls = {
    neutral: 'bg-neutral-100 text-neutral-600 dark:bg-[#23272f] dark:text-neutral-300',
    weak: 'bg-danger-soft text-danger dark:bg-[#3a1512] dark:text-[#f3a097]',
    mid: 'bg-warn-soft text-warn dark:bg-[#3a2c10] dark:text-[#f0c36a]',
    done: 'bg-accent-soft text-accent dark:bg-[#123a22] dark:text-[#8fe3ad]',
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function masteryTone(m: number | null | undefined): 'neutral' | 'weak' | 'mid' | 'done' {
  if (m === null || m === undefined || m === 0) return 'neutral';
  if (m < 40) return 'weak';
  if (m < 80) return 'mid';
  return 'done';
}

export function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2a2e38]">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** Bangla text. Hidden when the global language toggle is EN only. */
export function Bn({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { settings } = useStore();
  if (settings.lang !== 'en-bn' || !children) return null;
  return (
    <div className={`bn rounded-xl bg-accent-soft/60 px-3 py-2 text-[15px] dark:bg-[#12291b] ${className}`}>{children}</div>
  );
}

/** Anything that must stay hidden until the learner taps Show. Never open by default. */
export function Reveal({
  label = 'Show',
  hideLabel = 'Hide',
  children,
  onReveal,
}: {
  label?: string;
  hideLabel?: string;
  children: ReactNode;
  onReveal?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {open && <div className="mb-2">{children}</div>}
      <Button
        onClick={() => {
          if (!open) onReveal?.();
          setOpen(!open);
        }}
      >
        {open ? hideLabel : label}
      </Button>
    </div>
  );
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <pre data-lang={lang}>
      <code>{code}</code>
    </pre>
  );
}

export function ListRow({ to, children, right }: { to: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] active:bg-neutral-50 dark:border-[#2a2e38] dark:bg-[#171a21] dark:active:bg-[#1f232b]"
    >
      <span className="min-w-0 flex-1">{children}</span>
      {right}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-neutral-500 dark:text-neutral-400">{children}</div>;
}

export function Page({ title, back, children, actions }: { title?: string; back?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 pt-3 pb-24">
      {(title || back) && (
        <div className="flex items-center gap-2">
          {back && (
            <Link to={back} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-lg no-print" aria-label="Back">
              ←
            </Link>
          )}
          {title && <h1 className="flex-1 truncate text-xl font-semibold">{title}</h1>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Big({ children }: { children: ReactNode }) {
  return <div className="text-4xl font-semibold leading-none">{children}</div>;
}
