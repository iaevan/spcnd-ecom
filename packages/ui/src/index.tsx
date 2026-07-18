import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/**
 * Minimal shadcn-style primitives (docs/AGENTS.md §9.3). Styling is Tailwind
 * v4 utility classes; the admin app owns the Tailwind build.
 */

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

export function Button({
  variant = 'default',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'destructive' | 'ghost' }) {
  const variants = {
    default: 'bg-violet-600 text-white hover:bg-violet-700',
    outline: 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
  } as const;
  return (
    <button
      className={cx(
        'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Badge({
  tone = 'zinc',
  children,
}: {
  tone?: 'zinc' | 'green' | 'amber' | 'red' | 'violet' | 'blue';
  children: ReactNode;
}) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    violet: 'bg-violet-100 text-violet-700',
    blue: 'bg-blue-100 text-blue-700',
  } as const;
  return (
    <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}

/** Status badge with WC's order-status color vocabulary. */
export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'green'
      : status === 'processing'
        ? 'violet'
        : status === 'on-hold'
          ? 'amber'
          : ['cancelled', 'failed', 'trash'].includes(status)
            ? 'red'
            : status === 'refunded'
              ? 'blue'
              : 'zinc';
  return <Badge tone={tone}>{status}</Badge>;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-zinc-500">{message}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

/** Formats integer minor units (4dp) for display. */
export function money(minor: number, symbol = '$'): string {
  const sign = minor < 0 ? '-' : '';
  return `${sign}${symbol}${(Math.abs(minor) / 10000).toFixed(2)}`;
}

/** Formats a stored fixed-decimal money string for display. */
export function moneyString(value: string | null, symbol = '$'): string {
  if (value === null || value === '') return '—';
  return `${symbol}${Number(value).toFixed(2)}`;
}
