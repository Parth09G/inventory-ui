import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { locationsQuery } from '@/lib/api/reference'
import { isZero } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { purchasesQuery, type Purchase } from './api'

const route = getRouteApi('/_app/purchases/')

const columns: Column<Purchase>[] = [
  {
    id: 'no',
    header: 'Purchase no.',
    sortKey: 'doc_no',
    required: true,
    cell: (p) => <Code>{p.doc_no}</Code>,
    mobile: 'title',
  },
  {
    id: 'date',
    header: 'Received',
    sortKey: 'received_date',
    width: '7rem',
    cell: (p) => <DateText value={p.received_date} />,
    mobile: 'subtitle',
  },
  { id: 'dealer', header: 'Dealer', cell: (p) => p.supplier_name, mobile: 'subtitle' },
  {
    id: 'invoice',
    header: 'Dealer invoice',
    cell: (p) => (p.supplier_invoice_no ? <Code>{p.supplier_invoice_no}</Code> : null),
  },
  {
    id: 'location',
    header: 'Into',
    cell: (p) => <span className="text-ink-muted">{p.location_name}</span>,
  },
  {
    id: 'total',
    header: 'Total ₹',
    align: 'right',
    sortKey: 'grand_total',
    cell: (p) => <Money value={p.totals.grand_total} />,
    mobile: 'value',
  },
  {
    id: 'payable',
    header: 'Payable ₹',
    align: 'right',
    cell: (p) =>
      p.balance_payable && !isZero(p.balance_payable) && p.status !== 'cancelled' ? (
        <Money value={p.balance_payable} />
      ) : null,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (p) => (p.status === 'cancelled' ? <StatusBadge status="cancelled" /> : null),
    mobile: 'meta',
  },
]

/** Purchase register (ui-plan #23). */
export function PurchasesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canCreate = useCan('purchase.create')
  const locations = useQuery(locationsQuery())
  const purchases = useQuery(purchasesQuery(search))
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  const filtered = !!(search.q || search.location_id || search.from || search.to || search.party_id)
  return (
    <>
      <PageHeader
        title="Purchases"
        meta={purchases.data && `${purchases.data.meta.total.toLocaleString('en-IN')} purchases`}
        actions={
          canCreate && (
            <Button asChild>
              <Link to="/purchases/new">
                <Plus className="size-4" /> New purchase
              </Link>
            </Button>
          )
        }
      />
      <FilterBar
        active={filtered}
        onClear={() =>
          set({
            q: undefined,
            location_id: undefined,
            from: undefined,
            to: undefined,
            party_id: undefined,
          })
        }
      >
        <SearchInput
          value={search.q}
          onChange={(q) => set({ q })}
          placeholder="Purchase no., dealer, invoice…"
          label="Search purchases"
        />
        <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
        <FilterSelect
          label="Received into"
          value={search.location_id ? String(search.location_id) : undefined}
          onChange={(v) => set({ location_id: v ? Number(v) : undefined })}
          options={(locations.data ?? []).map((l) => ({ value: String(l.id), label: l.name }))}
        />
      </FilterBar>
      <DataTable
        label="Purchases"
        storageKey="purchases"
        columns={columns}
        rows={purchases.data?.data}
        rowKey={(p) => p.id}
        rowLink={(p) => ({ to: '/purchases/$id', params: { id: p.id } })}
        sort={search.sort}
        onSortChange={(sort) => set({ sort })}
        isLoading={purchases.isLoading}
        error={purchases.error}
        onRetry={() => void purchases.refetch()}
        empty={
          filtered ? 'No purchases match these filters.' : 'No purchases yet. New purchase: Alt+P.'
        }
        rowClassName={(p) =>
          p.status === 'cancelled' ? 'text-ink-muted line-through decoration-ink-faint' : undefined
        }
      />
      <Pagination meta={purchases.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}
