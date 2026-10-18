import { useQuery } from '@tanstack/react-query'
import { forwardRef, useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { itemsQuery, type Item } from '@/features/inventory/api'
import { StatusBadge } from '../StatusBadge'
import { StockByLocation } from '../StockByLocation'
import { Combobox } from './Combobox'

type Props = {
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  value: Item | undefined
  onChange: (item: Item) => void
  disabled?: boolean
}

/** Item search by name, category or attribute, with stock at every location (FR-BL-02, FR-BL-03). */
export const ItemPicker = forwardRef<HTMLInputElement, Props>(function ItemPicker(p, ref) {
  const [q, setQ] = useState('')
  const term = useDebouncedValue(q.trim(), 200)
  const results = useQuery({
    ...itemsQuery({ q: term, page_size: 10 }),
    enabled: term.length >= 1,
    placeholderData: undefined,
  })
  return (
    <Combobox<Item>
      ref={ref}
      id={p.id}
      aria-label={p['aria-label'] ?? 'Item'}
      aria-invalid={p['aria-invalid']}
      disabled={p.disabled}
      selectedLabel={p.value?.name ?? ''}
      placeholder="Search item…"
      query={q}
      onQueryChange={setQ}
      options={term === q.trim() ? results.data?.data : undefined}
      loading={results.isFetching || term !== q.trim()}
      getKey={(i) => i.id}
      onSelect={p.onChange}
      emptyText="No items match. Check the spelling or add the item in Inventory."
      renderOption={(i) => (
        <div className="grid gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{i.name}</span>
            {i.stock_status !== 'ok' && <StatusBadge status={i.stock_status} />}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm text-ink-muted">
            <span>
              {i.category_name} · {i.base_unit.symbol}
            </span>
            <StockByLocation stock={i.stock} decimals={i.base_unit.decimals} />
          </div>
        </div>
      )}
    />
  )
})
