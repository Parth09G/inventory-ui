import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/shared/FilterBar'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Balance, Code, Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCan } from '@/lib/permissions'
import { KIND_LABEL, partiesQuery, type Party } from './api'

const route = getRouteApi('/_app/parties/')

const columns: Column<Party>[] = [
  {
    id: 'name',
    header: 'Name',
    sortKey: 'name',
    required: true,
    cell: (p) => p.name,
    mobile: 'title',
  },
  {
    id: 'kind',
    header: 'Type',
    cell: (p) => <span className="text-ink-muted">{KIND_LABEL[p.kind]}</span>,
  },
  {
    id: 'mobile',
    header: 'Mobile',
    cell: (p) => (p.mobile ? <span className="tabular">{p.mobile}</span> : null),
    mobile: 'subtitle',
  },
  {
    id: 'gstin',
    header: 'GSTIN',
    cell: (p) => (p.gstin ? <Code>{p.gstin}</Code> : null),
    mobile: 'subtitle',
  },
  {
    id: 'balance',
    header: 'Balance ₹',
    align: 'right',
    sortKey: 'balance',
    cell: (p) => <Balance value={p.balance} />,
    mobile: 'value',
  },
  {
    id: 'limit',
    header: 'Credit limit ₹',
    align: 'right',
    cell: (p) => (p.credit_limit ? <Money value={p.credit_limit} /> : null),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (p) => (p.is_active ? null : <StatusBadge status="inactive" />),
    mobile: 'meta',
  },
]

/** Customers and dealers (ui-plan #16). */
export function PartiesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canManage = useCan('party.manage')
  const parties = useQuery(
    partiesQuery({
      q: search.q,
      kind: search.kind,
      with_balance: search.balance,
      page: search.page,
      sort: search.sort,
    }),
  )
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })

  return (
    <>
      <PageHeader
        title="Parties"
        meta={parties.data && `${parties.data.meta.total.toLocaleString('en-IN')} parties`}
        actions={
          canManage && (
            <Button asChild>
              <Link
                to="/parties/new"
                search={{ kind: search.kind === 'supplier' ? 'supplier' : 'customer' }}
              >
                <Plus className="size-4" /> New party
              </Link>
            </Button>
          )
        }
      />
      <Tabs
        value={search.kind ?? 'all'}
        onValueChange={(k) =>
          set({ kind: k === 'all' ? undefined : (k as 'customer' | 'supplier') })
        }
      >
        <TabsList className="mb-3">
          <TabsTrigger value="customer">Customers</TabsTrigger>
          <TabsTrigger value="supplier">Dealers</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterBar
        active={!!(search.q || search.balance)}
        onClear={() => set({ q: undefined, balance: undefined })}
      >
        <SearchInput
          value={search.q}
          onChange={(q) => set({ q })}
          placeholder="Name, mobile, GSTIN…"
          label="Search parties"
        />
        <FilterSelect
          label="Balance"
          value={search.balance}
          onChange={(balance) => set({ balance })}
          options={[
            { value: 'receivable', label: 'They owe us (Dr)' },
            { value: 'payable', label: 'We owe them (Cr)' },
          ]}
        />
      </FilterBar>
      <DataTable
        label="Parties"
        storageKey="parties"
        columns={columns}
        rows={parties.data?.data}
        rowKey={(p) => p.id}
        rowLink={(p) => ({ to: '/parties/$id', params: { id: p.id } })}
        sort={search.sort}
        onSortChange={(sort) => set({ sort })}
        isLoading={parties.isLoading}
        error={parties.error}
        onRetry={() => void parties.refetch()}
        empty={
          search.q || search.balance
            ? 'No parties match these filters.'
            : 'No parties yet. Add your regular customers and dealers.'
        }
        rowClassName={(p) => (p.is_active ? undefined : 'text-ink-muted')}
      />
      <Pagination meta={parties.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}
