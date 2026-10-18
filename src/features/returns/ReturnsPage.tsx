import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money } from '@/components/shared/values'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCan } from '@/lib/permissions'
import { returnsQuery, type CreditNote } from './api'

const route = getRouteApi('/_app/returns/')

const columns: Column<CreditNote>[] = [
  {
    id: 'no',
    header: 'Credit note',
    required: true,
    cell: (r) =>
      r.cn_no ? <Code>{r.cn_no}</Code> : <span className="text-ink-muted">Not numbered yet</span>,
    mobile: 'title',
  },
  {
    id: 'date',
    header: 'Date',
    width: '7rem',
    cell: (r) => <DateText value={r.cn_date} />,
    mobile: 'subtitle',
  },
  { id: 'bill', header: 'Against bill', cell: (r) => <Code>{r.bill_no}</Code>, mobile: 'subtitle' },
  { id: 'party', header: 'Customer', cell: (r) => r.party_name, mobile: 'subtitle' },
  {
    id: 'amount',
    header: 'Amount ₹',
    align: 'right',
    cell: (r) => <Money value={r.totals?.grand_total} />,
    mobile: 'value',
  },
  {
    id: 'status',
    header: 'Status',
    cell: (r) => <StatusBadge status={r.status} />,
    mobile: 'meta',
  },
  {
    id: 'by',
    header: 'Created by',
    cell: (r) => <span className="text-ink-muted">{r.created_by_name}</span>,
  },
]

/** Sales returns and credit notes (ui-plan #10). Approvers see the pending ones first. */
export function ReturnsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canApprove = useCan('return.approve')
  const tab = search.status ?? (canApprove ? 'pending' : 'all')
  const returns = useQuery(
    returnsQuery({
      status: tab === 'all' ? undefined : tab,
      from: search.from,
      to: search.to,
      page: search.page,
    }),
  )
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  return (
    <>
      <PageHeader
        title="Returns"
        meta="Create a return from the bill it belongs to. Returns by an Admin wait for the owner’s approval."
      />
      <Tabs value={tab} onValueChange={(t) => set({ status: t as typeof tab })}>
        <TabsList className="mb-3">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterBar
        active={!!(search.from || search.to)}
        onClear={() => set({ from: undefined, to: undefined })}
      >
        <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
      </FilterBar>
      <DataTable
        label="Returns"
        columns={columns}
        rows={returns.data?.data}
        rowKey={(r) => r.id}
        rowLink={(r) => ({ to: '/returns/$id', params: { id: r.id } })}
        isLoading={returns.isLoading}
        error={returns.error}
        onRetry={() => void returns.refetch()}
        empty={tab === 'pending' ? 'No returns waiting for approval.' : 'No returns in this view.'}
      />
      <Pagination meta={returns.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}
