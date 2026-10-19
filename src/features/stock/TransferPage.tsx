import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { PageHeader } from '@/components/shared/PageHeader'
import { Code, DateText, Qty } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'
import { transferQuery } from './api'

const route = getRouteApi('/_app/transfers/$id')

/** Transfer note, printable on A4 (FR-PU-04, ui-plan #29). */
export function TransferPage() {
  const { id } = route.useParams()
  const { data: t } = useSuspenseQuery(transferQuery(id))
  const locations = useQuery(locationsQuery())
  const settings = useQuery(settingsQuery())
  const name = (lid?: number) => locations.data?.find((l) => l.id === lid)?.name
  return (
    <div className="grid max-w-3xl gap-4">
      <PageHeader
        title={
          <span className="flex items-baseline gap-3">
            Transfer note <Code>{t.doc_no}</Code>
          </span>
        }
        back={
          <span className="print:hidden">
            <Link to="/transfers" className="hover:text-ink">
              Transfers
            </Link>
          </span>
        }
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer className="size-4" /> Print
          </Button>
        }
      />
      <p className="hidden font-semibold print:block">{settings.data?.shop_name}</p>
      <KeyValueGrid
        className="rounded-lg border bg-surface p-4"
        items={[
          ['Date', <DateText key="d" value={t.transfer_date} />],
          ['From', name(t.from_location_id)],
          ['To', name(t.to_location_id)],
          ['By', t.created_by_name],
        ]}
      />
      <table aria-label="Transferred items" className="w-full rounded-lg border bg-surface text-sm">
        <thead>
          <tr className="bg-surface-sunken text-left text-xs tracking-wide text-ink-muted uppercase">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 text-right font-medium">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {t.lines?.map((l, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2 text-ink-faint tabular">{i + 1}</td>
              <td className="px-3 py-2">{l.item_name}</td>
              <td className="px-3 py-2 text-right">
                <Qty value={l.base_qty} unit={l.unit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-10 hidden grid-cols-2 gap-8 text-sm print:grid">
        <p className="border-t pt-1">Sent by</p>
        <p className="border-t pt-1">Received by</p>
      </div>
    </div>
  )
}
