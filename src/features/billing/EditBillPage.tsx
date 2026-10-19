import { useQueries, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { StatusPage } from '@/components/shared/StatusPage'
import { itemQuery, type Item } from '@/features/inventory/api'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'
import { hasAction } from '@/lib/permissions'
import { billQuery } from './api'
import { fromBill } from './bill-form'
import { BillEditor } from './editor/BillEditor'

/** Edit a draft (anyone) or a saved bill (when allowed_actions has "edit", O-02). */
export function EditBillPage({ id }: { id: number }) {
  const bill = useSuspenseQuery(billQuery(id))
  const { data: settings } = useSuspenseQuery(settingsQuery())
  const { data: locations } = useSuspenseQuery(locationsQuery())
  const editable =
    bill.data.status === 'draft' || (bill.data.status === 'active' && hasAction(bill.data, 'edit'))
  const itemIds = [...new Set(bill.data.lines.flatMap((l) => (l.item_id ? [l.item_id] : [])))]
  const items = useQueries({
    queries: itemIds.map((i) => ({ ...itemQuery(i), enabled: editable })),
  })
  // Remount the form only on an explicit reload, not on every refetch.
  const [generation, setGeneration] = useState(0)
  const b = bill.data

  if (b.status === 'cancelled')
    return (
      <StatusPage code="Cancelled" title={`Bill ${b.bill_no} is cancelled`}>
        <p className="text-ink-muted">A cancelled bill cannot be edited.</p>
      </StatusPage>
    )
  if (b.status === 'active' && !hasAction(b, 'edit'))
    return (
      <div className="grid max-w-lg gap-2 py-8">
        <h1 className="text-xl font-semibold">This bill cannot be edited</h1>
        <p className="text-ink-muted">
          Only the owner (Super Admin) can edit a saved bill, within the e-invoice window. Use a
          return (credit note) to correct it.
        </p>
        <Link
          to="/bills/$id"
          params={{ id }}
          className="text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
        >
          Back to bill {b.bill_no}
        </Link>
      </div>
    )
  if (items.some((q) => q.isPending))
    return <p className="py-8 text-ink-muted">Loading the bill…</p>

  const map = new Map(items.flatMap((q) => (q.data ? [[q.data.id, q.data] as [number, Item]] : [])))
  const defaultLocation = (
    locations.find((l) => l.is_default_billing) ?? locations.find((l) => l.kind === 'shop')
  )?.id
  return (
    <BillEditor
      key={`${b.id}-${generation}`}
      initial={fromBill(b, map)}
      bill={b}
      shopState={settings.state_code}
      defaultLocationId={defaultLocation}
      defaultChargeGst={settings.default_charge_gst ?? '18'}
      onReload={async () => {
        await bill.refetch()
        setGeneration((g) => g + 1)
      }}
    />
  )
}
