import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { MODE_LABEL } from '@/components/shared/inputs/PaymentSplitEditor'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCan } from '@/lib/permissions'
import { paymentsQuery, type Payment } from './api'

const route = getRouteApi('/_app/payments/')

const columns: Column<Payment>[] = [
  {
    id: 'no',
    header: 'Receipt no.',
    required: true,
    cell: (p) => <Code>{p.doc_no}</Code>,
    mobile: 'title',
  },
  {
    id: 'date',
    header: 'Date',
    width: '7rem',
    cell: (p) => <DateText value={p.pay_date} />,
    mobile: 'subtitle',
  },
  { id: 'party', header: 'Party', cell: (p) => p.party_name, mobile: 'subtitle' },
  {
    id: 'mode',
    header: 'Mode',
    cell: (p) => MODE_LABEL[p.mode as keyof typeof MODE_LABEL] ?? p.mode,
  },
  {
    id: 'ref',
    header: 'Reference',
    cell: (p) =>
      p.cheque_no ? (
        <span className="tabular">Cheque {p.cheque_no}</span>
      ) : p.reference ? (
        <Code>{p.reference}</Code>
      ) : null,
  },
  {
    id: 'amount',
    header: 'Amount ₹',
    align: 'right',
    cell: (p) => <Money value={p.amount} />,
    mobile: 'value',
  },
  {
    id: 'status',
    header: 'Status',
    cell: (p) =>
      p.status === 'cancelled' ? (
        <StatusBadge status="cancelled" />
      ) : p.cheque_status ? (
        <StatusBadge status={p.cheque_status} label={`Cheque ${p.cheque_status}`} />
      ) : null,
    mobile: 'meta',
  },
]

/** Receipts and dealer payments (ui-plan #13). */
export function PaymentsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canCreate = useCan('payment.create')
  const direction = search.direction ?? 'received'
  const payments = useQuery(paymentsQuery({ ...search, direction }))
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  return (
    <>
      <PageHeader
        title="Payments"
        meta={
          payments.data &&
          `${payments.data.meta.total.toLocaleString('en-IN')} ${direction === 'received' ? 'receipts' : 'payments made'}`
        }
        actions={
          canCreate && (
            <Button asChild>
              <Link to="/payments/new" search={{ direction }}>
                <Plus className="size-4" />{' '}
                {direction === 'received' ? 'Record receipt' : 'Record payment to dealer'}
              </Link>
            </Button>
          )
        }
      />
      <Tabs value={direction} onValueChange={(d) => set({ direction: d as 'received' | 'paid' })}>
        <TabsList className="mb-3">
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="paid">Paid to dealers</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterBar
        active={!!(search.mode || search.cheque_status || search.from || search.to)}
        onClear={() =>
          set({ mode: undefined, cheque_status: undefined, from: undefined, to: undefined })
        }
      >
        <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
        <FilterSelect
          label="Mode"
          value={search.mode}
          onChange={(mode) => set({ mode })}
          options={(['cash', 'upi', 'cheque', 'bank_transfer'] as const).map((m) => ({
            value: m,
            label: MODE_LABEL[m],
          }))}
        />
        <FilterSelect
          label="Cheque"
          value={search.cheque_status}
          onChange={(cheque_status) => set({ cheque_status })}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'cleared', label: 'Cleared' },
            { value: 'bounced', label: 'Bounced' },
          ]}
        />
      </FilterBar>
      <DataTable
        label="Payments"
        storageKey="payments"
        columns={columns}
        rows={payments.data?.data}
        rowKey={(p) => p.id}
        rowLink={(p) => ({ to: '/payments/$id', params: { id: p.id } })}
        isLoading={payments.isLoading}
        error={payments.error}
        onRetry={() => void payments.refetch()}
        empty="No payments in this view."
        rowClassName={(p) =>
          p.status === 'cancelled' ? 'text-ink-muted line-through decoration-ink-faint' : undefined
        }
      />
      <Pagination meta={payments.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}
