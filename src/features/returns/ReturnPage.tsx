import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { PageHeader } from '@/components/shared/PageHeader'
import { ReasonDialog } from '@/components/shared/ReasonDialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money, Qty } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { problemMessage } from '@/lib/api/problem'
import { openSignedUrl } from '@/lib/download'
import { dateTime, isZero } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { returnQuery, useApproveReturn, useCreditNotePdf, useRejectReturn } from './api'

const route = getRouteApi('/_app/returns/$id')

/** Return / credit note, approved or rejected by the owner (FR-RT-02/03, ui-plan #12). */
export function ReturnPage() {
  const { id } = route.useParams()
  const { data: cn } = useSuspenseQuery(returnQuery(id))
  const canApprove = useCan('return.approve')
  const approve = useApproveReturn()
  const reject = useRejectReturn()
  const pdf = useCreditNotePdf()
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = cn.status === 'pending'
  const restocked = cn.lines?.some((l) => l.restock)
  const close = () => (setDialog(null), setError(null))

  return (
    <div className="grid max-w-4xl gap-4">
      <PageHeader
        title={
          cn.cn_no ? (
            <span className="flex items-baseline gap-3">
              Credit note <Code>{cn.cn_no}</Code>
            </span>
          ) : (
            'Return (awaiting approval)'
          )
        }
        back={
          <Link to="/returns" className="hover:text-ink">
            Returns
          </Link>
        }
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={cn.status} />
            {cn.einvoice && cn.einvoice.status !== 'not_required' && (
              <StatusBadge status={cn.einvoice.status} />
            )}
          </span>
        }
        actions={
          <>
            {cn.status === 'approved' && (
              <Button
                variant="outline"
                disabled={pdf.isPending}
                onClick={async () => {
                  try {
                    openSignedUrl((await pdf.mutateAsync(id)).url)
                  } catch (e) {
                    toast.error(problemMessage(e))
                  }
                }}
              >
                <FileDown className="size-4" /> Credit note PDF
              </Button>
            )}
            {pending && canApprove && (
              <>
                <Button variant="outline" onClick={() => setDialog('reject')}>
                  Reject
                </Button>
                <Button onClick={() => setDialog('approve')}>Approve</Button>
              </>
            )}
          </>
        }
      />
      {pending && !canApprove && (
        <p role="status" className="rounded-md border bg-warning-tint px-3 py-2 text-sm">
          Waiting for the owner (Super Admin) to approve. Stock and the ledger change only after
          approval.
        </p>
      )}

      <KeyValueGrid
        className="rounded-lg border bg-surface p-4"
        items={[
          [
            'Against bill',
            <Link
              key="b"
              to="/bills/$id"
              params={{ id: cn.bill_id }}
              className="code text-steel hover:underline"
            >
              {cn.bill_no}
            </Link>,
          ],
          ['Customer', cn.party_name],
          ['Date', <DateText key="d" value={cn.cn_date} />],
          ['Settlement', cn.settlement === 'refund' ? 'Refund' : 'Credit to ledger'],
          ['Reason', cn.reason],
          ['Created by', cn.created_by_name],
          [
            'Approved by',
            cn.approved_by_name &&
              `${cn.approved_by_name}${cn.approved_at ? `, ${dateTime(cn.approved_at)}` : ''}`,
          ],
        ]}
      />

      <section className="overflow-x-auto rounded-lg border bg-surface">
        <table aria-label="Returned lines" className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate ₹</th>
              <th className="px-3 py-2 text-right font-medium">Taxable ₹</th>
              <th className="px-3 py-2 font-medium">Stock</th>
            </tr>
          </thead>
          <tbody>
            {cn.lines?.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2 text-right">
                  <Qty value={l.qty} unit={l.unit} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={l.rate} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={l.taxable_value} />
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {l.restock ? 'Restocked' : 'Not restocked (damaged)'}
                </td>
              </tr>
            ))}
          </tbody>
          {cn.totals && (
            <tfoot>
              <tr className="border-t-2 bg-surface-sunken font-medium">
                <td className="px-3 py-2" colSpan={3}>
                  Credit note total
                  {cn.totals.cgst && !isZero(cn.totals.cgst)
                    ? ' (incl. CGST + SGST)'
                    : cn.totals.igst && !isZero(cn.totals.igst)
                      ? ' (incl. IGST)'
                      : ''}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={cn.totals.grand_total} />
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && close()}
        title="Approve this return?"
        effect={
          <ul className="list-disc pl-5">
            <li>A credit note number is issued.</li>
            {restocked && <li>Restocked lines go back into stock at their locations.</li>}
            <li>
              {cn.settlement === 'refund'
                ? 'The refund is recorded as a payment.'
                : `${cn.party_name}’s ledger is credited.`}
            </li>
            {cn.einvoice && cn.einvoice.status !== 'not_required' && (
              <li>The credit note is e-invoiced like the bill.</li>
            )}
          </ul>
        }
        confirmLabel="Approve return"
        error={error}
        pending={approve.isPending}
        onConfirm={async () => {
          try {
            const done = await approve.mutateAsync(id)
            toast.success(`Credit note ${done.cn_no ?? ''} issued`)
            close()
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && close()}
        title="Reject this return?"
        effect="Nothing changes in stock or the ledger. The person who created it sees the reason."
        confirmLabel="Reject return"
        danger
        error={error}
        pending={reject.isPending}
        onConfirm={async (reason) => {
          try {
            await reject.mutateAsync({ id, reason })
            toast.success('Return rejected')
            close()
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
    </div>
  )
}
