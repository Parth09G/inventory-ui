import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { Code, DateText } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { locationsQuery } from '@/lib/api/reference'
import { useCan } from '@/lib/permissions'
import { transfersQuery, type Transfer } from './api'

const route = getRouteApi('/_app/transfers/')

/** Transfer register (ui-plan #27). */
export function TransfersPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canCreate = useCan('stock.transfer')
  const locations = useQuery(locationsQuery())
  const transfers = useQuery(transfersQuery(search))
  const name = (id?: number) => locations.data?.find((l) => l.id === id)?.name ?? ''
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  const columns: Column<Transfer>[] = [
    {
      id: 'no',
      header: 'Transfer no.',
      required: true,
      cell: (t) => <Code>{t.doc_no}</Code>,
      mobile: 'title',
    },
    {
      id: 'date',
      header: 'Date',
      width: '7rem',
      cell: (t) => <DateText value={t.transfer_date} />,
      mobile: 'subtitle',
    },
    {
      id: 'route',
      header: 'From → To',
      cell: (t) => `${name(t.from_location_id)} → ${name(t.to_location_id)}`,
      mobile: 'subtitle',
    },
    {
      id: 'items',
      header: 'Items',
      cell: (t) => (
        <span className="text-ink-muted">{t.lines?.map((l) => l.item_name).join(', ')}</span>
      ),
    },
    {
      id: 'by',
      header: 'By',
      cell: (t) => <span className="text-ink-muted">{t.created_by_name}</span>,
      mobile: 'meta',
    },
  ]
  return (
    <>
      <PageHeader
        title="Transfers"
        actions={
          canCreate && (
            <Button asChild>
              <Link to="/transfers/new">
                <Plus className="size-4" /> New transfer
              </Link>
            </Button>
          )
        }
      />
      <FilterBar
        active={!!(search.location_id || search.from || search.to)}
        onClear={() => set({ location_id: undefined, from: undefined, to: undefined })}
      >
        <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
        <FilterSelect
          label="Location"
          value={search.location_id ? String(search.location_id) : undefined}
          onChange={(v) => set({ location_id: v ? Number(v) : undefined })}
          options={(locations.data ?? []).map((l) => ({ value: String(l.id), label: l.name }))}
        />
      </FilterBar>
      <DataTable
        label="Transfers"
        columns={columns}
        rows={transfers.data?.data}
        rowKey={(t) => t.id ?? t.doc_no ?? ''}
        rowLink={(t) => ({ to: '/transfers/$id', params: { id: t.id! } })}
        isLoading={transfers.isLoading}
        error={transfers.error}
        onRetry={() => void transfers.refetch()}
        empty="No transfers in this period."
      />
      <Pagination meta={transfers.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}
