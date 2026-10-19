import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  Copy,
  FileText,
  IndianRupee,
  MessageCircle,
  Pencil,
  Printer,
  Truck,
  Undo2,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { ReasonDialog } from '@/components/shared/ReasonDialog'
import { Badge, StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money, Qty, Rate } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { isProblem, problemMessage } from '@/lib/api/problem'
import { statesQuery } from '@/lib/api/reference'
import { openSignedUrl } from '@/lib/download'
import { dateTime, isZero } from '@/lib/format'
import { hasAction } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  billQuery,
  revisionsQuery,
  useBillDocuments,
  useCancelBill,
  useCopyToAccount,
  useEInvoiceActions,
} from './api'
import type { Bill } from './bill-form'

const route = getRouteApi('/_app/bills/$id/')
const PENDING_POLL_MS = 3000
const PENDING_POLL_LIMIT_MS = 2 * 60_000

export function paymentStatus(
  b: Pick<Bill, 'totals' | 'status'>,
): 'paid' | 'partial' | 'unpaid' | undefined {
  if (b.status !== 'active') return undefined
  if (isZero(b.totals.balance_due)) return 'paid'
  return isZero(b.totals.amount_paid) ? 'unpaid' : 'partial'
}

/** Bill view with server-driven actions (ui-plan #9, FR-ED-05/06, FR-EI-02/03/04). */
export function BillPage() {
  const { id } = route.useParams()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const go = useNavigate()
  const [pollExpired, setPollExpired] = useState(false)
  const { data: b, refetch } = useQuery({
    ...billQuery(id),
    // Watch a pending IRN for a while; the worker usually answers within seconds (D-22).
    refetchInterval: (q) =>
      q.state.data?.einvoice.status === 'pending' && !pollExpired ? PENDING_POLL_MS : false,
  })
  const docs = useBillDocuments(id)
  const einv = useEInvoiceActions(id)
  const cancel = useCancelBill()
  const copy = useCopyToAccount()
  const [copyKey, renewCopyKey] = useIdempotencyKey()
  const [dialog, setDialog] = useState<'cancel' | 'cancel-irn' | 'ewb' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (b?.einvoice.status !== 'pending') return
    const t = setTimeout(() => setPollExpired(true), PENDING_POLL_LIMIT_MS)
    return () => clearTimeout(t)
  }, [b?.einvoice.status])

  if (!b) return null
  const isCash = b.bill_type === 'cash'
  const typeLabel = isCash ? 'Cash bill' : 'Account bill'
  const irnPending = b.einvoice.status === 'pending'
  const tab = search.tab ?? 'bill'
  const pay = paymentStatus(b)

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      if (done) toast.success(done)
      return true
    } catch (e) {
      toast.error(problemMessage(e))
      return false
    }
  }
  const print = (copyKind?: 'original' | 'duplicate' | 'triplicate') =>
    run(async () => openSignedUrl((await docs.pdf.mutateAsync(copyKind)).url))
  const share = () =>
    run(async () => {
      const r = await docs.share.mutateAsync()
      const url = r.whatsapp_url ?? r.pdf_url
      if (url) window.open(url, '_blank', 'noopener')
    })

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-md border border-l-4 px-3 py-2',
          isCash ? 'border-l-cash bg-surface' : 'border-l-account bg-account-tint',
          b.status === 'cancelled' && 'border-l-danger',
        )}
      >
        <div className="grid gap-1">
          <p className="text-sm text-ink-muted">
            <Link to="/bills" className="hover:text-ink">
              Bills
            </Link>
          </p>
          <h1
            className={cn(
              'flex flex-wrap items-baseline gap-x-3 text-xl font-semibold',
              !isCash && 'text-account',
            )}
          >
            {typeLabel} <span className="code text-lg">{b.bill_no ?? 'Draft'}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={b.status} />
            {pay && <StatusBadge status={pay} />}
            {b.einvoice.status !== 'not_required' && (
              <StatusBadge status={b.einvoice.status} label={einvLabel(b.einvoice.status)} />
            )}
            {b.version > 1 && <Badge>Version {b.version}</Badge>}
            {b.source_bill?.id && (
              <span className="text-ink-muted">
                Copy of{' '}
                <Link
                  to="/bills/$id"
                  params={{ id: b.source_bill.id }}
                  className="code text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
                >
                  {b.source_bill.bill_no}
                </Link>
              </span>
            )}
            {b.account_copy?.id && (
              <span className="text-ink-muted">
                Account copy{' '}
                <Link
                  to="/bills/$id"
                  params={{ id: b.account_copy.id }}
                  className="code text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
                >
                  {b.account_copy.bill_no}
                </Link>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {b.status === 'draft' && (
            <Button asChild>
              <Link to="/bills/$id/edit" params={{ id }}>
                <Pencil className="size-4" /> Continue draft
              </Link>
            </Button>
          )}
          {hasAction(b, 'print') && (
            <PrintButton disabled={irnPending} onPrint={(c) => void print(c)} />
          )}
          {hasAction(b, 'share') && (
            <Button variant="outline" disabled={docs.share.isPending} onClick={() => void share()}>
              <MessageCircle className="size-4" /> Share
            </Button>
          )}
          {hasAction(b, 'record_payment') && b.customer.party_id && (
            <Button variant="outline" asChild>
              <Link
                to="/payments/new"
                search={{ direction: 'received', party: b.customer.party_id, bill: b.id }}
              >
                <IndianRupee className="size-4" /> Record payment
              </Link>
            </Button>
          )}
          {hasAction(b, 'create_return') && (
            <Button variant="outline" asChild>
              <Link to="/returns/new" search={{ bill: b.id }}>
                <Undo2 className="size-4" /> Return
              </Link>
            </Button>
          )}
          {hasAction(b, 'copy_to_account') && (
            <Button
              variant="outline"
              disabled={copy.isPending}
              onClick={() =>
                void run(async () => {
                  const created = await copy.mutateAsync({ id, key: copyKey })
                  renewCopyKey()
                  toast.success(`Account bill ${created.bill_no ?? ''} created`)
                  await go({ to: '/bills/$id', params: { id: created.id } })
                })
              }
            >
              <Copy className="size-4" /> Copy to Account bill
            </Button>
          )}
          {hasAction(b, 'edit') && (
            <Button variant="outline" asChild>
              <Link to="/bills/$id/edit" params={{ id }}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
          {hasAction(b, 'cancel') && (
            <Button variant="outline" onClick={() => setDialog('cancel')}>
              <XCircle className="size-4" /> Cancel bill
            </Button>
          )}
        </div>
      </div>

      {b.status === 'cancelled' && (
        <p
          role="status"
          className="rounded-md border border-danger/40 bg-danger-tint px-3 py-2 font-medium text-danger"
        >
          CANCELLED
          {b.cancel_reason && <span className="font-normal text-ink"> · {b.cancel_reason}</span>}
        </p>
      )}

      <section className="grid gap-4 rounded-lg border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Customer</p>
          {b.customer.party_id ? (
            <Link
              to="/parties/$id"
              params={{ id: b.customer.party_id }}
              className="font-medium text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
            >
              {b.customer.name}
            </Link>
          ) : (
            <p className="font-medium">
              {b.customer.name} <span className="font-normal text-ink-muted">(walk-in)</span>
            </p>
          )}
          {b.customer.gstin && (
            <p>
              <Code copy>{b.customer.gstin}</Code>
            </p>
          )}
          {b.customer.address && <p className="text-sm text-ink-muted">{b.customer.address}</p>}
          {b.customer.site_address && (
            <p className="text-sm text-ink-muted">Site: {b.customer.site_address}</p>
          )}
        </div>
        <KeyValueGrid
          items={[
            ['Date', <DateText key="d" value={b.bill_date} />],
            ['Place of supply', <PlaceOfSupply key="p" code={b.place_of_supply} />],
            ['Tax', b.is_interstate ? 'IGST (inter-state)' : 'CGST + SGST'],
            ['Vehicle', b.vehicle_no && <Code key="v">{b.vehicle_no}</Code>],
            ['Stock', b.affects_stock ? 'Reduced at line locations' : 'Not changed'],
            [
              'Created by',
              b.created_by_name &&
                `${b.created_by_name}${b.created_at ? `, ${dateTime(b.created_at)}` : ''}`,
            ],
          ]}
        />
      </section>

      <Tabs
        value={tab}
        onValueChange={(t) => void navigate({ search: { tab: t as typeof tab }, replace: true })}
      >
        <TabsList>
          <TabsTrigger value="bill">Bill</TabsTrigger>
          <TabsTrigger value="payments">Payments ({b.payments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="einvoice">E-invoice</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'bill' && <BillBody bill={b} />}
      {tab === 'payments' && <Payments bill={b} />}
      {tab === 'einvoice' && (
        <EInvoicePanel
          bill={b}
          pollExpired={pollExpired}
          onGenerate={() => void run(() => einv.generate.mutateAsync(), 'E-invoice requested')}
          onCancel={() => setDialog('cancel-irn')}
          onEwb={() => setDialog('ewb')}
          onRefresh={() => void refetch()}
        />
      )}
      {tab === 'history' && <History billId={id} />}

      <ReasonDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && (setDialog(null), setError(null))}
        title={`Cancel ${typeLabel.toLowerCase()} ${b.bill_no}?`}
        effect={
          <p>
            {b.affects_stock ? 'Stock goes back to the line locations and ' : ''}
            {b.posts_to_ledger ? 'the ledger entries are reversed. ' : ''}The number {b.bill_no} is
            kept and reprints say CANCELLED.
            {b.einvoice.status === 'generated' &&
              ' The IRN is cancelled if it is still within 24 hours.'}
          </p>
        }
        confirmLabel="Cancel bill"
        danger
        error={error}
        pending={cancel.isPending}
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync({ bill: b, reason })
            toast.success(`Bill ${b.bill_no} cancelled`)
            setDialog(null)
          } catch (e) {
            if (isProblem(e, 'VERSION_MISMATCH')) {
              setError(
                'Someone else changed this bill. It has been reloaded; check it and try again.',
              )
              void refetch()
            } else setError(problemMessage(e))
          }
        }}
      />
      <ReasonDialog
        open={dialog === 'cancel-irn'}
        onOpenChange={(o) => !o && (setDialog(null), setError(null))}
        title="Cancel the e-invoice (IRN)?"
        effect="The IRN is cancelled on the GST portal. This is possible only within 24 hours of generation. The bill itself stays active."
        confirmLabel="Cancel IRN"
        danger
        error={error}
        pending={einv.cancel.isPending}
        onConfirm={async (reason) => {
          try {
            await einv.cancel.mutateAsync(reason)
            toast.success('IRN cancellation requested')
            setDialog(null)
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
      {dialog === 'ewb' && (
        <EWayBillDialog
          vehicle={b.vehicle_no ?? ''}
          pending={einv.ewaybill.isPending}
          onClose={() => setDialog(null)}
          onSubmit={async (body) => {
            try {
              await einv.ewaybill.mutateAsync(body)
              toast.success('E-way bill requested')
              setDialog(null)
            } catch (e) {
              return problemMessage(e)
            }
          }}
        />
      )}
    </div>
  )
}

function einvLabel(s: Bill['einvoice']['status']) {
  return {
    not_required: 'No IRN needed',
    pending: 'IRN pending',
    generated: 'IRN generated',
    failed: 'IRN failed',
    cancelled: 'IRN cancelled',
  }[s]
}

function PlaceOfSupply({ code }: { code: string | undefined }) {
  const states = useQuery(statesQuery())
  const s = states.data?.find((x) => x.code === code)
  return <>{s ? `${s.code} · ${s.name}` : code}</>
}

function PrintButton({
  disabled,
  onPrint,
}: {
  disabled: boolean
  onPrint: (c?: 'original' | 'duplicate' | 'triplicate') => void
}) {
  if (disabled)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button variant="outline" disabled>
              <Printer className="size-4" /> Print
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Print after the IRN arrives (it carries the QR code)</TooltipContent>
      </Tooltip>
    )
  return (
    <div className="flex">
      <Button variant="outline" className="rounded-r-none" onClick={() => onPrint()}>
        <Printer className="size-4" /> Print
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="-ml-px rounded-l-none"
            aria-label="Print options"
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onPrint('original')}>
            Original for recipient
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPrint('duplicate')}>
            Duplicate for transporter
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPrint('triplicate')}>
            Triplicate for supplier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function BillBody({ bill: b }: { bill: Bill }) {
  const t = b.totals
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div tabIndex={0} className="min-w-0 overflow-x-auto rounded-lg border bg-surface">
        <table aria-label="Bill lines" className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">HSN</th>
              {b.affects_stock && <th className="px-3 py-2 text-left font-medium">From</th>}
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate ₹</th>
              <th className="px-3 py-2 text-right font-medium">Taxable ₹</th>
              <th className="px-3 py-2 text-right font-medium">GST</th>
              <th className="px-3 py-2 text-right font-medium">Amount ₹</th>
            </tr>
          </thead>
          <tbody>
            {b.lines.map((l) => (
              <tr key={l.id ?? l.line_no} className="border-t">
                <td className="px-3 py-2 text-ink-faint tabular">{l.line_no}</td>
                <td className="px-3 py-2">
                  {l.description}
                  {l.discount_pct && !isZero(l.discount_pct) && (
                    <span className="ml-1 text-xs text-ink-muted">({l.discount_pct}% off)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Code>{l.hsn_code}</Code>
                </td>
                {b.affects_stock && <td className="px-3 py-2 text-ink-muted">{l.location_name}</td>}
                <td className="px-3 py-2 text-right">
                  <Qty value={l.qty} unit={l.unit} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={l.rate} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={l.taxable_value} />
                </td>
                <td className="px-3 py-2 text-right tabular">{l.gst_rate}%</td>
                <td className="px-3 py-2 text-right font-medium">
                  <Money value={l.line_total} />
                </td>
              </tr>
            ))}
            {b.charges?.map((c) => (
              <tr key={c.id} className="border-t text-ink-muted">
                <td />
                <td className="px-3 py-2" colSpan={b.affects_stock ? 5 : 4}>
                  {c.kind === 'labour' ? 'Labour' : c.kind === 'transport' ? 'Transport' : 'Other'}
                  {c.description && `: ${c.description}`}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={c.amount} />
                </td>
                <td className="px-3 py-2 text-right tabular">{c.gst_rate}%</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section
        aria-label="Totals"
        className="grid content-start gap-1 rounded-lg border bg-surface p-4 text-sm tabular"
      >
        {[
          ['Taxable value', t.taxable_total],
          ['CGST', t.cgst],
          ['SGST', t.sgst],
          ['IGST', t.igst],
          ['Round off', t.round_off],
        ].map(([k, v]) =>
          v && !isZero(v) ? (
            <div key={k} className="flex justify-between">
              <span className="text-ink-muted">{k}</span>
              <Money value={v} />
            </div>
          ) : null,
        )}
        <div className="mt-1 flex items-baseline justify-between border-t pt-2">
          <span className="font-medium">Grand total</span>
          <span className="text-figure font-semibold">
            ₹ <Money value={t.grand_total} />
          </span>
        </div>
        {t.amount_in_words && <p className="text-xs text-ink-muted">{t.amount_in_words}</p>}
        <div className="flex justify-between">
          <span className="text-ink-muted">Paid</span>
          <Money value={t.amount_paid} />
        </div>
        <div className="flex justify-between font-medium">
          <span>Balance due</span>
          <Money value={t.balance_due} />
        </div>
        {b.gross_profit && (
          <p className="mt-2 border-t pt-2 text-xs text-ink-muted">
            Cost ₹ <Money value={b.cost_total} /> · Gross profit ₹ <Money value={b.gross_profit} />
          </p>
        )}
        {b.notes && <p className="mt-2 border-t pt-2 text-ink-muted">{b.notes}</p>}
      </section>
    </div>
  )
}

function Payments({ bill: b }: { bill: Bill }) {
  if (!b.payments?.length)
    return <p className="text-ink-muted">No payments recorded against this bill.</p>
  return (
    <ul className="grid divide-y rounded-lg border bg-surface">
      {b.payments.map((p) => (
        <li key={p.payment_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex items-center gap-3">
            <Code>{p.doc_no}</Code>
            <span className="text-ink-muted">{p.mode?.replace('_', ' ')}</span>
            <DateText value={p.date} />
          </span>
          <Money value={p.amount} className="font-medium" />
        </li>
      ))}
    </ul>
  )
}

function EInvoicePanel({
  bill: b,
  pollExpired,
  onGenerate,
  onCancel,
  onEwb,
  onRefresh,
}: {
  bill: Bill
  pollExpired: boolean
  onGenerate: () => void
  onCancel: () => void
  onEwb: () => void
  onRefresh: () => void
}) {
  const e = b.einvoice
  if (e.status === 'not_required')
    return (
      <p className="text-ink-muted">
        No e-invoice is needed: the customer has no GSTIN (B2C) or this is an Account copy.
      </p>
    )
  return (
    <section className="grid gap-3 rounded-lg border bg-surface p-4">
      {e.status === 'pending' && (
        <p role="status" className="text-warning">
          {pollExpired
            ? 'Still waiting for the GST portal. '
            : 'Waiting for the GST portal to return the IRN… '}
          <button type="button" className="text-steel underline" onClick={onRefresh}>
            Check now
          </button>
        </p>
      )}
      {e.status === 'failed' && (
        <FormAlert
          message={`The e-invoice failed: ${e.last_error ?? 'no details from the portal.'}`}
        />
      )}
      <KeyValueGrid
        items={[
          ['Status', <StatusBadge key="s" status={e.status} label={einvLabel(e.status)} />],
          [
            'IRN',
            e.irn && (
              <Code key="i" copy>
                {e.irn}
              </Code>
            ),
          ],
          ['Ack no.', e.ack_no && <Code key="a">{e.ack_no}</Code>],
          ['Ack date', e.ack_date && dateTime(e.ack_date)],
          ['Cancel possible until', e.cancel_deadline && dateTime(e.cancel_deadline)],
          ['E-way bill', e.ewb_no && <Code key="e">{e.ewb_no}</Code>],
          ['E-way bill valid until', e.ewb_valid_until && dateTime(e.ewb_valid_until)],
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {hasAction(b, 'generate_einvoice') && (
          <Button variant="outline" onClick={onGenerate}>
            <FileText className="size-4" />{' '}
            {e.status === 'failed' ? 'Retry e-invoice' : 'Generate e-invoice'}
          </Button>
        )}
        {hasAction(b, 'generate_ewaybill') && (
          <Button variant="outline" onClick={onEwb}>
            <Truck className="size-4" /> Generate e-way bill
          </Button>
        )}
        {hasAction(b, 'cancel_einvoice') && (
          <Button variant="outline" onClick={onCancel}>
            <XCircle className="size-4" /> Cancel IRN
          </Button>
        )}
      </div>
    </section>
  )
}

function EWayBillDialog({
  vehicle,
  pending,
  onClose,
  onSubmit,
}: {
  vehicle: string
  pending: boolean
  onClose: () => void
  onSubmit: (b: {
    vehicle_no: string
    distance_km: number
    transport_mode: 'road' | 'rail' | 'air' | 'ship'
  }) => Promise<string | void>
}) {
  const [v, setV] = useState(vehicle)
  const [km, setKm] = useState('')
  const [mode, setMode] = useState<'road' | 'rail' | 'air' | 'ship'>('road')
  const [error, setError] = useState<string | null>(null)
  const valid = v.trim().length >= 4 && /^\d{1,4}$/.test(km)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate e-way bill</DialogTitle>
          <DialogDescription>
            Part A comes from the bill; Part B needs the vehicle and distance.
          </DialogDescription>
        </DialogHeader>
        <FormAlert message={error} />
        <div className="grid gap-3">
          <Field label="Vehicle no.">
            <Input
              className="code uppercase"
              value={v}
              onChange={(e) => setV(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance (km)">
              <Input
                inputMode="numeric"
                className="text-right tabular"
                value={km}
                onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Mode">
              <NativeSelect value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="road">Road</option>
                <option value="rail">Rail</option>
                <option value="air">Air</option>
                <option value="ship">Ship</option>
              </NativeSelect>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={async () =>
              setError(
                (await onSubmit({
                  vehicle_no: v.trim(),
                  distance_km: Number(km),
                  transport_mode: mode,
                })) ?? null,
              )
            }
          >
            Generate e-way bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function History({ billId }: { billId: number }) {
  const revisions = useQuery(revisionsQuery(billId))
  if (revisions.isLoading) return <p className="text-ink-muted">Loading history…</p>
  if (!revisions.data?.length)
    return <p className="text-ink-muted">This bill has not been edited.</p>
  return (
    <ol className="grid gap-3" aria-label="Revisions">
      {revisions.data.map((r) => (
        <li key={r.version} className="grid gap-2 rounded-lg border bg-surface p-4">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-medium">Version {r.version}</span>
            <span className="text-sm text-ink-muted">
              replaced by {r.edited_by_name} on {dateTime(r.edited_at)}
            </span>
          </p>
          {r.reason && <p>Reason: {r.reason}</p>}
          {r.snapshot && (
            <table className="w-full max-w-2xl text-sm">
              <tbody>
                {r.snapshot.lines.map((l) => (
                  <tr key={l.line_no} className="border-t">
                    <td className="py-1 pr-2">{l.description}</td>
                    <td className="py-1 pr-2 text-right">
                      <Qty value={l.qty} unit={l.unit} />
                    </td>
                    <td className="py-1 pr-2 text-right">
                      @ <Rate value={l.rate} />
                    </td>
                    <td className="py-1 text-right">
                      <Money value={l.line_total} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-1" colSpan={3}>
                    Grand total then
                  </td>
                  <td className="py-1 text-right">
                    <Money value={r.snapshot.totals.grand_total} />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </li>
      ))}
    </ol>
  )
}
