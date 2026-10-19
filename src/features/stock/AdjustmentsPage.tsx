import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ClipboardCheck, Plus } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { Badge } from '@/components/shared/StatusBadge'
import { Code, DateText, Qty } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { locationsQuery } from '@/lib/api/reference'
import { useCan } from '@/lib/permissions'
import { ADJUST_REASON, adjustmentsQuery, type Adjustment } from './api'

const route = getRouteApi('/_app/adjustments/')

/** Stock adjustments with their lines shown inline (there is no single-adjustment endpoint) (ui-plan #30). */
export function AdjustmentsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canAdjust = useCan('stock.adjust')
  const canCount = useCan('stock.count')
  const locations = useQuery(locationsQuery())
  const adjustments = useQuery(adjustmentsQuery(search))
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  const columns: Column<Adjustment>[] = [
    {
      id: 'no',
      header: 'Adjustment no.',
      required: true,
      cell: (a) => <Code>{a.doc_no}</Code>,
      mobile: 'title',
    },
    {
      id: 'date',
      header: 'Date',
      width: '7rem',
      cell: (a) => <DateText value={a.adj_date} />,
      mobile: 'subtitle',
    },
    {
      id: 'location',
      header: 'Location',
      cell: (a) => locations.data?.find((l) => l.id === a.location_id)?.name,
      mobile: 'subtitle',
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (a) => (
        <Badge tone={a.reason === 'count_correction' ? 'info' : 'neutral'}>
          {ADJUST_REASON[a.reason as keyof typeof ADJUST_REASON] ?? a.reason}
        </Badge>
      ),
      mobile: 'meta',
    },
    {
      id: 'lines',
      header: 'Items',
      cell: (a) => (
        <ul className="grid gap-0.5">
          {a.lines?.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{l.item_name}</span>
              <Qty
                value={l.qty_change?.startsWith('-') ? l.qty_change : `+${l.qty_change}`}
                className={l.qty_change?.startsWith('-') ? undefined : 'text-success'}
              />
            </li>
          ))}
        </ul>
      ),
      mobile: 'subtitle',
    },
    {
      id: 'notes',
      header: 'Notes',
      defaultHidden: true,
      cell: (a) => <span className="text-ink-muted">{a.notes}</span>,
    },
    {
      id: 'by',
      header: 'By',
      cell: (a) => <span className="text-ink-muted">{a.created_by_name}</span>,
    },
  ]
  return (
    <>
      <PageHeader
        title="Adjustments"
        meta="Damage, breakage, wastage, samples and count corrections."
        actions={
          <>
            {canCount && (
              <Button variant="outline" asChild>
                <Link to="/stock-counts/new">
                  <ClipboardCheck className="size-4" /> Physical count
                </Link>
              </Button>
            )}
            {canAdjust && (
              <Button asChild>
                <Link to="/adjustments/new">
                  <Plus className="size-4" /> New adjustment
                </Link>
              </Button>
            )}
          </>
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
        label="Adjustments"
        storageKey="adjustments"
        columns={columns}
        rows={adjustments.data?.data}
        rowKey={(a) => a.id ?? a.doc_no ?? ''}
        isLoading={adjustments.isLoading}
        error={adjustments.error}
        onRetry={() => void adjustments.refetch()}
        empty="No adjustments in this period."
      />
      <Pagination meta={adjustments.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}
