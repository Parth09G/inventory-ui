import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import * as f from '@/lib/format'
import { cn } from '@/lib/utils'

type Dec = string | null | undefined

/** Money cell: tabular, right-aligned by the caller's column; negatives in danger colour. */
export function Money({
  value,
  symbol,
  className,
}: {
  value: Dec
  symbol?: boolean
  className?: string
}) {
  return (
    <span
      className={cn('whitespace-nowrap tabular', f.isNegative(value) && 'text-danger', className)}
    >
      {f.money(value, { symbol })}
    </span>
  )
}

export function Qty({
  value,
  decimals,
  unit,
  className,
}: {
  value: Dec
  decimals?: number
  unit?: string
  className?: string
}) {
  return (
    <span
      className={cn('whitespace-nowrap tabular', f.isNegative(value) && 'text-danger', className)}
    >
      {f.qty(value, decimals)}
      {unit && <span className="text-ink-muted"> {unit}</span>}
    </span>
  )
}

export function Rate({ value, className }: { value: Dec; className?: string }) {
  return <span className={cn('whitespace-nowrap tabular', className)}>{f.rate(value)}</span>
}

/** Ledger balance with Dr / Cr suffix (design P3). */
export function Balance({ value, className }: { value: Dec; className?: string }) {
  const b = f.balance(value)
  return (
    <span className={cn('whitespace-nowrap tabular', className)}>
      {b.text}
      {b.side && (
        <span className={cn('ml-1 text-xs', b.side === 'Cr' ? 'text-success' : 'text-ink-muted')}>
          {b.side}
        </span>
      )}
    </span>
  )
}

export function DateText({ value, short }: { value: Dec; short?: boolean }) {
  return (
    <span className="whitespace-nowrap tabular">{short ? f.shortDate(value) : f.date(value)}</span>
  )
}

/** Bill numbers, GSTIN, IRN, HSN, UTR in mono, optionally copyable. */
export function Code({ children, copy }: { children: string | null | undefined; copy?: boolean }) {
  if (!children) return null
  if (!copy) return <span className="code whitespace-nowrap">{children}</span>
  return (
    <span className="group inline-flex items-center gap-1">
      <span className="code whitespace-nowrap">{children}</span>
      <button
        type="button"
        aria-label={`Copy ${children}`}
        className="text-ink-faint opacity-0 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          void navigator.clipboard?.writeText(children)
          toast.success('Copied')
        }}
      >
        <Copy className="size-3.5" />
      </button>
    </span>
  )
}
