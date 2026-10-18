import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'account'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  info: 'bg-info-tint text-info',
  account: 'bg-account-tint text-account',
}

// Every status the API returns, with its label and tone. Text always carries the meaning (P8).
const STATUS: Record<string, [string, Tone]> = {
  // stock
  ok: ['In stock', 'success'],
  low: ['Low', 'warning'],
  out: ['Out of stock', 'danger'],
  // documents
  draft: ['Draft', 'info'],
  active: ['Active', 'neutral'],
  cancelled: ['Cancelled', 'danger'],
  inactive: ['Inactive', 'neutral'],
  // payment
  paid: ['Paid', 'success'],
  partial: ['Part paid', 'warning'],
  unpaid: ['Unpaid', 'danger'],
  // e-invoice
  not_required: ['No IRN needed', 'neutral'],
  pending: ['Pending', 'warning'],
  generated: ['IRN generated', 'success'],
  failed: ['Failed', 'danger'],
  // cheques and returns
  cleared: ['Cleared', 'success'],
  bounced: ['Bounced', 'danger'],
  approved: ['Approved', 'success'],
  rejected: ['Rejected', 'danger'],
  // jobs
  queued: ['Queued', 'info'],
  running: ['Running', 'info'],
  succeeded: ['Done', 'success'],
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm px-1.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Status from the API rendered with its standard label and tone. `label` overrides the text. */
export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined
  label?: string
}) {
  if (!status) return null
  const [text, tone] = STATUS[status] ?? [status.replace(/_/g, ' '), 'neutral' as Tone]
  return <Badge tone={tone}>{label ?? text}</Badge>
}
