import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { MODE_LABEL } from '@/components/shared/inputs/PaymentSplitEditor'
import { PageHeader } from '@/components/shared/PageHeader'
import { ReasonDialog } from '@/components/shared/ReasonDialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { problemMessage } from '@/lib/api/problem'
import { openSignedUrl } from '@/lib/download'
import { isZero, money } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { paymentQuery, useCancelPayment, useChequeStatus, useReceipt } from './api'

const route = getRouteApi('/_app/payments/$id')

/** Payment with allocations, cheque status and cancel (FR-CU-03, ui-plan #15). */
export function PaymentPage() {
  const { id } = route.useParams()
  const { data: p } = useSuspenseQuery(paymentQuery(id))
  const canCheque = useCan('payment.cheque_status')
  const canCancel = useCan('payment.cancel')
  const cheque = useChequeStatus()
  const cancel = useCancelPayment()
  const receipt = useReceipt()
  const [dialog, setDialog] = useState<'cleared' | 'bounced' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const active = p.status !== 'cancelled'
  const close = () => (setDialog(null), setError(null))

  return (
    <div className="grid max-w-3xl gap-4">
      <PageHeader
        title={
          <span className="flex items-baseline gap-3">
            {p.direction === 'received' ? 'Receipt' : 'Payment'} <Code>{p.doc_no}</Code>
          </span>
        }
        back={
          <Link to="/payments" search={{ direction: p.direction }} className="hover:text-ink">
            Payments
          </Link>
        }
        meta={
          <span className="flex flex-wrap items-center gap-2">
            {!active && <StatusBadge status="cancelled" />}
            {p.cheque_status && (
              <StatusBadge status={p.cheque_status} label={`Cheque ${p.cheque_status}`} />
            )}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              disabled={receipt.isPending}
              onClick={async () => {
                try {
                  openSignedUrl((await receipt.mutateAsync(id)).url)
                } catch (e) {
                  toast.error(problemMessage(e))
                }
              }}
            >
              <FileDown className="size-4" /> Receipt
            </Button>
            {active && p.cheque_status === 'pending' && canCheque && (
              <>
                <Button variant="outline" onClick={() => setDialog('cleared')}>
                  Mark cleared
                </Button>
                <Button variant="outline" onClick={() => setDialog('bounced')}>
                  Mark bounced
                </Button>
              </>
            )}
            {active && canCancel && (
              <Button variant="outline" onClick={() => setDialog('cancel')}>
                Cancel payment
              </Button>
            )}
          </>
        }
      />

      <section className="grid gap-4 rounded-lg border bg-surface p-4">
        <p className="text-figure font-semibold">
          ₹ <Money value={p.amount} />
        </p>
        <KeyValueGrid
          items={[
            [
              p.direction === 'received' ? 'From' : 'To',
              p.party_id ? (
                <Link
                  key="p"
                  to="/parties/$id"
                  params={{ id: p.party_id }}
                  className="text-steel hover:underline"
                >
                  {p.party_name}
                </Link>
              ) : (
                p.party_name
              ),
            ],
            ['Date', <DateText key="d" value={p.pay_date} />],
            ['Mode', MODE_LABEL[p.mode as keyof typeof MODE_LABEL] ?? p.mode],
            ['Reference', p.reference && <Code key="r">{p.reference}</Code>],
            ['Cheque', p.cheque_no && `${p.cheque_no}${p.bank_name ? `, ${p.bank_name}` : ''}`],
            ['Cheque date', p.cheque_date && <DateText key="c" value={p.cheque_date} />],
          ]}
        />
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Applied to</h2>
        {p.allocations?.length ? (
          <ul className="grid divide-y rounded-lg border bg-surface">
            {p.allocations.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                {a.ref_type !== 'purchase' && a.ref_id ? (
                  <Link
                    to="/bills/$id"
                    params={{ id: a.ref_id }}
                    className="code text-steel hover:underline"
                  >
                    {a.ref_no}
                  </Link>
                ) : (
                  <Code>{a.ref_no}</Code>
                )}
                <Money value={a.amount} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">Not applied to any document.</p>
        )}
        {p.unallocated && !isZero(p.unallocated) && (
          <p className="text-sm text-ink-muted">₹ {money(p.unallocated)} is on account.</p>
        )}
      </section>

      <ConfirmDialog
        open={dialog === 'cleared'}
        onOpenChange={(o) => !o && close()}
        title="Mark the cheque as cleared?"
        effect="The amount is confirmed as received in the bank."
        confirmLabel="Mark cleared"
        error={error}
        pending={cheque.isPending}
        onConfirm={async () => {
          try {
            await cheque.mutateAsync({ id, status: 'cleared' })
            toast.success('Cheque marked cleared')
            close()
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
      <ConfirmDialog
        open={dialog === 'bounced'}
        onOpenChange={(o) => !o && close()}
        title="Mark the cheque as bounced?"
        effect={`₹ ${money(p.amount)} is owed again: the ledger entry is reversed and the bills it paid become due.`}
        confirmLabel="Mark bounced"
        danger
        error={error}
        pending={cheque.isPending}
        onConfirm={async () => {
          try {
            await cheque.mutateAsync({ id, status: 'bounced' })
            toast.success('Cheque marked bounced')
            close()
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
      <ReasonDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && close()}
        title={`Cancel ${p.doc_no}?`}
        effect="The payment is reversed in the ledger and its allocations are undone. The number is kept."
        confirmLabel="Cancel payment"
        danger
        error={error}
        pending={cancel.isPending}
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync({ id, reason })
            toast.success(`${p.doc_no} cancelled`)
            close()
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
    </div>
  )
}
