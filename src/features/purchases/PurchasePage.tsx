import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { IndianRupee, Undo2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { PageHeader } from '@/components/shared/PageHeader'
import { ReasonDialog } from '@/components/shared/ReasonDialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money, Qty, Rate } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { isProblem, problemMessage } from '@/lib/api/problem'
import { locationsQuery } from '@/lib/api/reference'
import { isZero } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { purchaseQuery, useCancelPurchase } from './api'

const route = getRouteApi('/_app/purchases/$id/')

/** Purchase with landed costs, payable balance and follow-up actions (ui-plan #25). */
export function PurchasePage() {
  const { id } = route.useParams()
  const { data: p } = useSuspenseQuery(purchaseQuery(id))
  const canPay = useCan('payment.create')
  const canReturn = useCan('purchase_return.create')
  const canCancel = useCan('purchase.cancel')
  const cancel = useCancelPurchase()
  const locations = useQuery(locationsQuery())
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = p.status !== 'cancelled'
  const t = p.totals

  return (
    <div className="grid gap-4">
      <PageHeader
        title={
          <span className="flex items-baseline gap-3">
            Purchase <Code>{p.doc_no}</Code>
          </span>
        }
        back={
          <Link to="/purchases" className="hover:text-ink">
            Purchases
          </Link>
        }
        meta={!active && <StatusBadge status="cancelled" />}
        actions={
          active && (
            <>
              {canPay && p.balance_payable && !isZero(p.balance_payable) && (
                <Button variant="outline" asChild>
                  <Link to="/payments/new" search={{ direction: 'paid', party: p.supplier_id }}>
                    <IndianRupee className="size-4" /> Pay dealer
                  </Link>
                </Button>
              )}
              {canReturn && (
                <Button variant="outline" asChild>
                  <Link to="/purchases/$id/return" params={{ id }}>
                    <Undo2 className="size-4" /> Return to dealer
                  </Link>
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" onClick={() => setOpen(true)}>
                  <XCircle className="size-4" /> Cancel purchase
                </Button>
              )}
            </>
          )
        }
      />
      <KeyValueGrid
        className="rounded-lg border bg-surface p-4"
        items={[
          [
            'Dealer',
            <Link
              key="d"
              to="/parties/$id"
              params={{ id: p.supplier_id }}
              className="text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
            >
              {p.supplier_name}
            </Link>,
          ],
          ['Dealer invoice', p.supplier_invoice_no && <Code key="i">{p.supplier_invoice_no}</Code>],
          ['Invoice date', <DateText key="id" value={p.supplier_invoice_dt} />],
          ['Received', <DateText key="r" value={p.received_date} />],
          ['Into', p.location_name],
          ['Payable', p.balance_payable && <Money key="p" value={p.balance_payable} symbol />],
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section tabIndex={0} className="min-w-0 overflow-x-auto rounded-lg border bg-surface">
          <table aria-label="Purchase lines" className="w-full text-sm">
            <thead>
              <tr className="bg-surface-sunken text-left text-xs tracking-wide text-ink-muted uppercase">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Into</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Rate ₹</th>
                <th className="px-3 py-2 text-right font-medium">Taxable ₹</th>
                <th className="px-3 py-2 text-right font-medium">GST</th>
                <th className="px-3 py-2 text-right font-medium">Landed cost ₹</th>
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l, i) => (
                <tr key={l.id ?? i} className="border-t">
                  <td className="px-3 py-2">{l.item_name}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {locations.data?.find((x) => x.id === l.location_id)?.name ?? p.location_name}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={l.qty} unit={l.unit} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Rate value={l.rate} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={l.taxable_value} />
                  </td>
                  <td className="px-3 py-2 text-right tabular">{l.gst_rate}%</td>
                  <td className="px-3 py-2 text-right">
                    <Rate value={l.landed_unit_cost} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
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
          ].map(([k, val]) =>
            val && !isZero(val) ? (
              <div key={k} className="flex justify-between">
                <span className="text-ink-muted">{k}</span>
                <Money value={val} />
              </div>
            ) : null,
          )}
          <div className="mt-1 flex items-baseline justify-between border-t pt-2">
            <span className="font-medium">Total</span>
            <span className="text-figure font-semibold">
              ₹ <Money value={t.grand_total} />
            </span>
          </div>
        </section>
      </div>
      <ReasonDialog
        open={open}
        onOpenChange={(o) => !o && (setOpen(false), setError(null))}
        title={`Cancel purchase ${p.doc_no}?`}
        effect="The stock it added is taken back out and the dealer’s balance is reversed. Possible only while that stock has not been sold."
        confirmLabel="Cancel purchase"
        danger
        error={error}
        pending={cancel.isPending}
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync({ id, reason })
            toast.success(`Purchase ${p.doc_no} cancelled`)
            setOpen(false)
          } catch (e) {
            setError(
              isProblem(e, 'INSUFFICIENT_STOCK') ||
                isProblem(e, 'INVALID_STATE') ||
                isProblem(e, 'CONFLICT')
                ? 'Some of this stock has already been sold, so the purchase cannot be cancelled. Use “Return to dealer” for what is left.'
                : problemMessage(e),
            )
          }
        }}
      />
    </div>
  )
}
