import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Code } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { categoriesQuery, type Category } from './api'

const columns: Column<Category>[] = [
  { id: 'name', header: 'Category', cell: (c) => c.name, required: true, mobile: 'title' },
  {
    id: 'hsn',
    header: 'HSN',
    cell: (c) => (c.default_hsn ? <Code>{c.default_hsn}</Code> : null),
    mobile: 'subtitle',
  },
  {
    id: 'gst',
    header: 'GST',
    align: 'right',
    cell: (c) => c.default_gst && <span className="tabular">{c.default_gst}%</span>,
  },
  {
    id: 'units',
    header: 'Units',
    cell: (c) =>
      c.units
        ?.map((u) => u.unit?.symbol)
        .filter(Boolean)
        .join(', '),
    mobile: 'subtitle',
  },
  {
    id: 'attributes',
    header: 'Attributes',
    cell: (c) => (
      <span className="text-ink-muted">
        {[...(c.attributes ?? [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((a) => a.label)
          .join(', ') || '—'}
      </span>
    ),
  },
  {
    id: 'items',
    header: 'Items',
    align: 'right',
    cell: (c) => <span className="tabular">{c.item_count ?? 0}</span>,
    mobile: 'value',
  },
  {
    id: 'status',
    header: 'Status',
    cell: (c) => (c.is_active ? null : <StatusBadge status="inactive" />),
    mobile: 'meta',
  },
]

export function CategoriesPage() {
  const categories = useQuery(categoriesQuery())
  const canManage = useCan('catalogue.manage')
  const rows =
    categories.data &&
    [...categories.data].sort(
      (a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name),
    )
  return (
    <>
      <PageHeader
        title="Categories"
        meta="Each category sets its units, its attributes, and default HSN and GST for new items."
        actions={
          canManage && (
            <Button asChild>
              <Link to="/catalogue/categories/new">
                <Plus className="size-4" /> New category
              </Link>
            </Button>
          )
        }
      />
      <DataTable
        label="Categories"
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        rowLink={(c) => ({ to: '/catalogue/categories/$id', params: { id: c.id } })}
        isLoading={categories.isLoading}
        error={categories.error}
        onRetry={() => void categories.refetch()}
        empty="No categories yet. Create one for each kind of material you sell: Cement, Steel, Nails."
        rowClassName={(c) => (c.is_active ? undefined : 'text-ink-muted')}
      />
    </>
  )
}
