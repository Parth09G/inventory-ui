import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Plus, Upload } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/shared/FilterBar'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { shortName } from '@/components/shared/StockByLocation'
import { Money, Qty, Rate } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { categoriesQuery } from '@/features/catalogue/api'
import { locationsQuery } from '@/lib/api/reference'
import { useCan } from '@/lib/permissions'
import { itemsQuery, type Item } from './api'

const route = getRouteApi('/_app/inventory/')

/** Inventory grid (FR-DB-08, ui-plan #19). Filters live in the URL. */
export function InventoryPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const canManage = useCan('item.manage')
  const locations = useQuery(locationsQuery())
  const categories = useQuery(categoriesQuery())
  const items = useQuery(itemsQuery(search))

  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })

  const category = categories.data?.find((c) => c.id === search.category_id)
  const attrDefs = [...(category?.attributes ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const activeLocations = (locations.data ?? []).filter((l) => l.is_active !== false)
  const filtered = !!(
    search.q ||
    search.category_id ||
    search.location_id ||
    search.stock_status ||
    search.include_inactive
  )

  const columns: Column<Item>[] = [
    {
      id: 'name',
      header: 'Item',
      sortKey: 'name',
      required: true,
      cell: (i) => i.name,
      mobile: 'title',
    },
    {
      id: 'category',
      header: 'Category',
      sortKey: 'category',
      cell: (i) => <span className="text-ink-muted">{i.category_name}</span>,
      mobile: 'subtitle',
    },
    ...activeLocations.map((l): Column<Item> => ({
      id: `loc${l.id}`,
      header: shortName(l.name),
      align: 'right',
      width: '6rem',
      cell: (i) => {
        const s = i.stock?.find((x) => x.location_id === l.id)
        return (
          <Qty
            value={s?.qty ?? '0'}
            decimals={i.base_unit.decimals}
            className={!s || /^0*(\.0*)?$/.test(s.qty) ? 'text-ink-faint' : undefined}
          />
        )
      },
    })),
    {
      id: 'total',
      header: 'Total',
      align: 'right',
      sortKey: 'stock_total',
      cell: (i) => (
        <Qty value={i.stock_total} decimals={i.base_unit.decimals} className="font-medium" />
      ),
      mobile: 'value',
    },
    {
      id: 'unit',
      header: 'Unit',
      cell: (i) => <span className="text-ink-muted">{i.base_unit.symbol}</span>,
      width: '4rem',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (i) =>
        i.is_active === false ? (
          <StatusBadge status="inactive" />
        ) : (
          <StatusBadge status={i.stock_status} />
        ),
      mobile: 'meta',
    },
    {
      id: 'value',
      header: 'Value ₹',
      align: 'right',
      sortKey: 'stock_value',
      cell: (i) => <Money value={i.stock_value} />,
    },
    {
      id: 'avg',
      header: 'Avg cost ₹',
      align: 'right',
      defaultHidden: true,
      cell: (i) => <Rate value={i.avg_cost} />,
    },
    {
      id: 'reorder',
      header: 'Reorder at',
      align: 'right',
      defaultHidden: true,
      cell: (i) => <Qty value={i.reorder_level} decimals={i.base_unit.decimals} />,
    },
    {
      id: 'hsn',
      header: 'HSN',
      defaultHidden: true,
      cell: (i) => <span className="code">{i.hsn_code}</span>,
    },
    {
      id: 'sku',
      header: 'SKU',
      defaultHidden: true,
      cell: (i) => (i.sku ? <span className="code">{i.sku}</span> : null),
    },
  ]

  return (
    <>
      <PageHeader
        title="Inventory"
        meta={items.data && `${items.data.meta.total.toLocaleString('en-IN')} items`}
        actions={
          canManage && (
            <>
              <Button variant="outline" asChild>
                <Link to="/items/import">
                  <Upload className="size-4" /> Import
                </Link>
              </Button>
              <Button asChild>
                <Link to="/items/new" search={{ category_id: search.category_id }}>
                  <Plus className="size-4" /> New item
                </Link>
              </Button>
            </>
          )
        }
      />
      <FilterBar
        active={filtered}
        onClear={() =>
          set({
            q: undefined,
            category_id: undefined,
            location_id: undefined,
            stock_status: undefined,
            include_inactive: undefined,
            attr: undefined,
          })
        }
      >
        <SearchInput
          value={search.q}
          onChange={(q) => set({ q })}
          placeholder="Name, brand, size…"
          label="Search items"
        />
        <FilterSelect
          label="Category"
          value={search.category_id ? String(search.category_id) : undefined}
          onChange={(v) => set({ category_id: v ? Number(v) : undefined, attr: undefined })}
          options={(categories.data ?? [])
            .filter((c) => c.is_active)
            .map((c) => ({ value: String(c.id), label: c.name }))}
        />
        {attrDefs.map((a) =>
          a.data_type === 'select' ? (
            <FilterSelect
              key={a.code}
              label={a.label}
              value={search.attr?.[a.code]}
              onChange={(v) => set({ attr: cleanAttr({ ...search.attr, [a.code]: v }) })}
              options={(a.options ?? []).map((o) => ({ value: o, label: o }))}
              allLabel="Any"
            />
          ) : (
            <label key={a.code} className="grid gap-0.5 text-xs font-medium text-ink-muted">
              {a.label}
              <AttrInput
                value={search.attr?.[a.code]}
                onChange={(v) => set({ attr: cleanAttr({ ...search.attr, [a.code]: v }) })}
                label={a.label}
              />
            </label>
          ),
        )}
        <FilterSelect
          label="Location"
          value={search.location_id ? String(search.location_id) : undefined}
          onChange={(v) => set({ location_id: v ? Number(v) : undefined })}
          options={activeLocations.map((l) => ({ value: String(l.id), label: l.name }))}
        />
        <FilterSelect
          label="Stock"
          value={search.stock_status}
          onChange={(stock_status) => set({ stock_status })}
          options={[
            { value: 'ok', label: 'In stock' },
            { value: 'low', label: 'Low' },
            { value: 'out', label: 'Out of stock' },
          ]}
        />
        <label className="flex h-(--control-h) items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-ink"
            checked={!!search.include_inactive}
            onChange={(e) => set({ include_inactive: e.target.checked || undefined })}
          />
          Include inactive
        </label>
      </FilterBar>
      <DataTable
        label="Inventory"
        storageKey="inventory"
        columns={columns}
        rows={items.data?.data}
        rowKey={(i) => i.id}
        rowLink={(i) => ({ to: '/items/$id', params: { id: i.id } })}
        sort={search.sort}
        onSortChange={(sort) => set({ sort })}
        isLoading={items.isLoading}
        error={items.error}
        onRetry={() => void items.refetch()}
        empty={
          filtered
            ? 'No items match these filters.'
            : 'No items yet. Add items, or import them from Excel per category.'
        }
        rowClassName={(i) => (i.is_active === false ? 'text-ink-muted' : undefined)}
      />
      <Pagination meta={items.data?.meta} onPage={(page) => set({ page })} />
    </>
  )
}

function cleanAttr(a: Record<string, string | undefined>): Record<string, string> | undefined {
  const out = Object.fromEntries(Object.entries(a).filter(([, v]) => v)) as Record<string, string>
  return Object.keys(out).length ? out : undefined
}

function AttrInput({
  value,
  onChange,
  label,
}: {
  value: string | undefined
  onChange: (v: string | undefined) => void
  label: string
}) {
  return (
    <input
      aria-label={label}
      defaultValue={value}
      key={value ?? ''}
      onBlur={(e) => onChange(e.target.value.trim() || undefined)}
      onKeyDown={(e) => e.key === 'Enter' && onChange(e.currentTarget.value.trim() || undefined)}
      className="h-(--control-h) w-28 rounded-md border border-input bg-surface px-2 text-base font-normal text-ink"
    />
  )
}
