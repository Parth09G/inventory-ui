import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { Badge, StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { locationsQuery } from '@/lib/api/reference'
import { useCan } from '@/lib/permissions'
import { billsQuery, type BillSummary } from './api'

const route = getRouteApi('/_app/bills/')

const columns: Column<BillSummary>[] = [
  {
    id: 'no',
    header: 'Bill no.',
    sortKey: 'bill_no',
    required: true,
    cell: (b) =>
      b.bill_no ? <Code>{b.bill_no}</Code> : <span className="text-ink-muted">Draft</span>,
    mobile: 'title',
  },
  {
    id: 'date',
    header: 'Date',
    sortKey: 'bill_date',
    width: '7rem',
    cell: (b) => <DateText value={b.bill_date} />,
    mobile: 'subtitle',
  },
  {
    id: 'type',
    header: 'Type',
    cell: (b) =>
      b.bill_type === 'account' ? (
        <Badge tone="account">{b.is_account_copy ? 'Account copy' : 'Account'}</Badge>
      ) : (
        <Badge>Cash</Badge>
      ),
    mobile: 'meta',
  },
  { id: 'customer', header: 'Customer', cell: (b) => b.customer_name, mobile: 'subtitle' },
  {
    id: 'total',
    header: 'Total ₹',
    align: 'right',
    sortKey: 'grand_total',
    cell: (b) => <Money value={b.grand_total} />,
    mobile: 'value',
  },
  {
    id: 'due',
    header: 'Due ₹',
    align: 'right',
    cell: (b) => (b.balance_due && b.status === 'active' ? <Money value={b.balance_due} /> : null),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (b) =>
      b.status === 'active' ? (
        <StatusBadge status={b.payment_status} />
      ) : (
        <StatusBadge status={b.status} />
      ),
    mobile: 'meta',
  },
  {
    id: 'einv',
    header: 'E-invoice',
    cell: (b) =>
      b.einvoice_status && b.einvoice_status !== 'not_required' ? (
        <StatusBadge status={b.einvoice_status} />
      ) : null,
    mobile: 'meta',
  },
  {
    id: 'by',
    header: 'By',
    defaultHidden: true,
    cell: (b) => <span className="text-ink-muted">{b.created_by_name}</span>,
  },
]

/** Bill register (FR-BL-11, ui-plan #6). */
export function BillsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canCreate = useCan('bill.create')
  const locations = useQuery(locationsQuery())
  const { tab, ...params } = search
  const bills = useQuery(billsQuery({ ...params, status: tab ?? params.status }))
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  const filtered = !!(
    search.q ||
    search.bill_type ||
    search.payment_status ||
    search.einvoice_status ||
    search.location_id ||
    search.from ||
    search.to ||
    search.unlinked_account_bills
  )

  return (
    <>
      <PageHeader
        title="Bills"
        meta={bills.data && `${bills.data.meta.total.toLocaleString('en-IN')} bills`}
        actions={
          canCreate && (
            <>
              <Button variant="outline" asChild>
                <Link to="/bills/new" search={{ type: 'account' }}>
                  <Plus className="size-4" /> Account bill
                </Link>
              </Button>
              <Button asChild>
                <Link to="/bills/new" search={{ type: 'cash' }}>
                  <Plus className="size-4" /> Cash bill
                </Link>
              </Button>
            </>
          )
        }
      />
      <Tabs
        value={tab ?? 'all'}
        onValueChange={(t) => set({ tab: t === 'all' ? undefined : (t as 'draft' | 'cancelled') })}
      >
        <TabsList className="mb-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterBar
        active={filtered}
        onClear={() =>
          set({
            q: undefined,
            bill_type: undefined,
            payment_status: undefined,
            einvoice_status: undefined,
            location_id: undefined,
            from: undefined,
            to: undefined,
            unlinked_account_bills: undefined,
          })
        }
      >
        <SearchInput
          value={search.q}
          onChange={(q) => set({ q })}
          placeholder="Bill no., customer…"
          label="Search bills"
        />
        <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
        <FilterSelect
          label="Type"
          value={search.bill_type}
          onChange={(bill_type) => set({ bill_type })}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'account', label: 'Account' },
          ]}
        />
        <FilterSelect
          label="Payment"
          value={search.payment_status}
          onChange={(payment_status) => set({ payment_status })}
          options={[
            { value: 'paid', label: 'Paid' },
            { value: 'partial', label: 'Part paid' },
            { value: 'unpaid', label: 'Unpaid' },
          ]}
        />
        <FilterSelect
          label="E-invoice"
          value={search.einvoice_status}
          onChange={(einvoice_status) => set({ einvoice_status })}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'generated', label: 'Generated' },
            { value: 'failed', label: 'Failed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'not_required', label: 'Not needed' },
          ]}
        />
        <FilterSelect
          label="Location"
          value={search.location_id ? String(search.location_id) : undefined}
          onChange={(v) => set({ location_id: v ? Number(v) : undefined })}
          options={(locations.data ?? []).map((l) => ({ value: String(l.id), label: l.name }))}
        />
        <label className="flex h-(--control-h) items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            className="size-4 accent-ink"
            checked={!!search.unlinked_account_bills}
            onChange={(e) => set({ unlinked_account_bills: e.target.checked || undefined })}
          />
          Account bills not linked to a Cash bill
        </label>
      </FilterBar>
      <DataTable
        label="Bills"
        storageKey="bills"
        columns={columns}
        rows={bills.data?.data}
        rowKey={(b) => b.id}
        rowLink={(b) =>
          b.status === 'draft'
            ? { to: '/bills/$id/edit', params: { id: b.id } }
            : { to: '/bills/$id', params: { id: b.id } }
        }
        sort={search.sort}
        onSortChange={(sort) => set({ sort })}
        isLoading={bills.isLoading}
        error={bills.error}
        onRetry={() => void bills.refetch()}
        empty={filtered ? 'No bills match these filters.' : 'No bills yet. New Cash bill: Alt+N.'}
        rowClassName={(b) =>
          b.status === 'cancelled' ? 'text-ink-muted line-through decoration-ink-faint' : undefined
        }
      />
      <Pagination meta={bills.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}
