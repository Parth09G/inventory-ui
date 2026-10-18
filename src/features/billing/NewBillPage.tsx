import { useSuspenseQuery } from '@tanstack/react-query'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'
import { emptyBill, type BillType } from './bill-form'
import { BillEditor } from './editor/BillEditor'

export function NewBillPage({ type }: { type: BillType }) {
  const { data: settings } = useSuspenseQuery(settingsQuery())
  const { data: locations } = useSuspenseQuery(locationsQuery())
  const defaultLocation = (
    locations.find((l) => l.is_default_billing) ?? locations.find((l) => l.kind === 'shop')
  )?.id
  return (
    <BillEditor
      key={type}
      initial={emptyBill(type, settings.state_code, defaultLocation)}
      shopState={settings.state_code}
      defaultLocationId={defaultLocation}
      defaultChargeGst={settings.default_charge_gst ?? '18'}
    />
  )
}
