import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { FilterBar, FilterSelect } from '@/components/shared/FilterBar'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code, DateText, Money, Qty, Rate } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { problemMessage } from '@/lib/api/problem'
import { locationsQuery } from '@/lib/api/reference'
import { useCan } from '@/lib/permissions'
import {
  itemQuery,
  MOVEMENT_KIND,
  movementsQuery,
  useDeactivateItem,
  type StockMovement,
} from './api'

const route = getRouteApi('/_app/items/$id/')

/** Item detail with stock by location and the stock ledger (FR-PU-07, ui-plan #21). */
export function ItemPage() {
  const { id } = route.useParams()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const go = useNavigate()
  const { data: item } = useSuspenseQuery(itemQuery(id))
  const locations = useQuery(locationsQuery())
  const canManage = useCan('item.manage')
  const canDeactivate = useCan('item.deactivate')
  const deactivate = useDeactivateItem()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tab = search.tab ?? 'stock'
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  const d = item.base_unit.decimals
  const sym = item.base_unit.symbol

  return (
    <div className="grid gap-5">
      <PageHeader
        title={item.name}
        back={
          <Link to="/inventory" className="hover:text-ink">
            Inventory
          </Link>
        }
        meta={
          <span className="flex flex-wrap items-center gap-2">
            {item.category_name}
            {item.is_active === false ? (
              <StatusBadge status="inactive" />
            ) : (
              <StatusBadge status={item.stock_status} />
            )}
          </span>
        }
        actions={
          <>
            {canDeactivate && item.is_active !== false && (
              <Button variant="outline" onClick={() => setConfirm(true)}>
                Deactivate
              </Button>
            )}
            {canManage && (
              <Button variant="outline" asChild>
                <Link to="/items/$id/edit" params={{ id }}>
                  Edit item
                </Link>
              </Button>
            )}
          </>
        }
      />

      <section
        aria-label="Stock by location"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-rule sm:grid-cols-4"
      >
        {(item.stock ?? []).map((s) => (
          <div key={s.location_id} className="bg-surface px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              {s.location_name}
            </p>
            <p className="mt-1 text-lg">
              <Qty
                value={s.qty}
                decimals={d}
                unit={sym}
                className={/^0*(\.0*)?$/.test(s.qty) ? 'text-ink-faint' : undefined}
              />
            </p>
          </div>
        ))}
        <div className="bg-surface-sunken px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Total</p>
          <p className="mt-1 text-lg font-semibold">
            <Qty value={item.stock_total} decimals={d} unit={sym} />
          </p>
        </div>
      </section>

      <KeyValueGrid
        className="rounded-lg border bg-surface p-4"
        items={[
          ['HSN', <Code key="h">{item.hsn_code}</Code>],
          ['GST', `${item.gst_rate}%`],
          ['Base unit', `${item.base_unit.name} (${sym})`],
          [
            'Other units',
            item.units
              ?.filter((u) => u.unit_id !== item.base_unit.id)
              .map(
                (u) => `1 ${u.symbol} = ${Number(u.factor_to_base).toLocaleString('en-IN')} ${sym}`,
              )
              .join(', ') || null,
          ],
          [
            'Reorder level',
            item.reorder_level ? (
              <Qty key="r" value={item.reorder_level} decimals={d} unit={sym} />
            ) : null,
          ],
          [
            'Average cost',
            item.avg_cost ? (
              <span key="a">
                ₹ <Rate value={item.avg_cost} /> / {sym}
              </span>
            ) : null,
          ],
          [
            'Last purchase rate',
            item.last_purchase_rate ? (
              <span key="l">
                ₹ <Rate value={item.last_purchase_rate} /> / {sym}
              </span>
            ) : null,
          ],
          ['Stock value', <Money key="v" value={item.stock_value} symbol />],
          ['SKU', item.sku ? <Code key="s">{item.sku}</Code> : null],
        ]}
      />

      <Tabs value={tab} onValueChange={(t) => set({ tab: t as 'stock' | 'ledger' })}>
        <TabsList>
          <TabsTrigger value="stock">Attributes</TabsTrigger>
          <TabsTrigger value="ledger">Stock ledger</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'stock' ? (
        <KeyValueGrid
          items={Object.entries(item.attributes ?? {}).map(([k, v]) => [
            k.replace(/_/g, ' '),
            String(v),
          ])}
        />
      ) : (
        <Ledger
          itemId={id}
          unit={sym}
          decimals={d}
          search={search}
          set={set}
          locations={locations.data ?? []}
        />
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={(o) => !o && (setConfirm(false), setError(null))}
        title={`Deactivate ${item.name}?`}
        effect="It is hidden from billing and purchase searches. Its stock history stays in reports."
        confirmLabel="Deactivate item"
        danger
        error={error}
        pending={deactivate.isPending}
        onConfirm={async () => {
          try {
            await deactivate.mutateAsync(id)
            toast.success(`${item.name} deactivated`)
            setConfirm(false)
            await go({ to: '/inventory' })
          } catch (e) {
            setError(problemMessage(e))
          }
        }}
      />
    </div>
  )
}

type LedgerSearch = { loc?: number; from?: string; to?: string; page?: number }

function Ledger({
  itemId,
  unit,
  decimals,
  search,
  set,
  locations,
}: {
  itemId: number
  unit: string
  decimals: number
  search: LedgerSearch
  set: (p: LedgerSearch) => void
  locations: { id: number; name: string }[]
}) {
  const movements = useQuery(
    movementsQuery(itemId, {
      location_id: search.loc,
      from: search.from,
      to: search.to,
      page: search.page,
    }),
  )
  const columns: Column<StockMovement>[] = [
    {
      id: 'date',
      header: 'Date',
      width: '7rem',
      required: true,
      cell: (m) => <DateText value={m.date} />,
      mobile: 'title',
    },
    { id: 'kind', header: 'Type', cell: (m) => MOVEMENT_KIND[m.kind], mobile: 'subtitle' },
    {
      id: 'doc',
      header: 'Document',
      cell: (m) => (m.ref_no ? <Code>{m.ref_no}</Code> : null),
      mobile: 'subtitle',
    },
    { id: 'loc', header: 'Location', cell: (m) => m.location_name, mobile: 'subtitle' },
    {
      id: 'in',
      header: `In (${unit})`,
      align: 'right',
      cell: (m) =>
        /^0*(\.0*)?$/.test(m.qty_in) ? null : (
          <Qty value={m.qty_in} decimals={decimals} className="text-success" />
        ),
      mobile: 'value',
    },
    {
      id: 'out',
      header: `Out (${unit})`,
      align: 'right',
      cell: (m) =>
        /^0*(\.0*)?$/.test(m.qty_out) ? null : <Qty value={m.qty_out} decimals={decimals} />,
      mobile: 'value',
    },
    {
      id: 'bal',
      header: 'Balance',
      align: 'right',
      cell: (m) => <Qty value={m.balance} decimals={decimals} className="font-medium" />,
    },
    {
      id: 'cost',
      header: 'Cost ₹',
      align: 'right',
      defaultHidden: true,
      cell: (m) => <Rate value={m.unit_cost} />,
    },
    {
      id: 'user',
      header: 'By',
      cell: (m) => <span className="text-ink-muted">{m.user_name}</span>,
      mobile: 'meta',
    },
  ]
  return (
    <div>
      <FilterBar
        active={!!(search.loc || search.from || search.to)}
        onClear={() => set({ loc: undefined, from: undefined, to: undefined })}
      >
        <FilterSelect
          label="Location"
          value={search.loc ? String(search.loc) : undefined}
          onChange={(v) => set({ loc: v ? Number(v) : undefined })}
          options={locations.map((l) => ({ value: String(l.id), label: l.name }))}
        />
        <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
      </FilterBar>
      <DataTable
        label="Stock ledger"
        storageKey="item-ledger"
        columns={columns}
        rows={movements.data?.data}
        rowKey={(m) => m.id}
        isLoading={movements.isLoading}
        error={movements.error}
        onRetry={() => void movements.refetch()}
        empty="No stock movements in this period."
      />
      <Pagination meta={movements.data?.meta} onPage={(page) => set({ page })} />
    </div>
  )
}
