import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { unitsQuery } from '@/lib/api/reference'
import { cn } from '@/lib/utils'
import { UnitDialog } from './UnitsPage'

type Sel = { unit_id: number; is_default: boolean }

/** Units allowed in a category, with one default (FR-IN-01). New units can be added on the spot. */
export function UnitsPicker({
  value,
  onChange,
  error,
}: {
  value: Sel[]
  onChange: (v: Sel[]) => void
  error?: string
}) {
  const units = useQuery(unitsQuery())
  const [adding, setAdding] = useState(false)
  const selected = new Map(value.map((v) => [v.unit_id, v]))

  const toggle = (id: number) => {
    if (selected.has(id)) {
      const rest = value.filter((v) => v.unit_id !== id)
      // Keep a default when the default unit is removed.
      if (selected.get(id)?.is_default && rest[0]) rest[0] = { ...rest[0], is_default: true }
      onChange(rest)
    } else onChange([...value, { unit_id: id, is_default: value.length === 0 }])
  }
  const setDefault = (id: number) =>
    onChange(value.map((v) => ({ ...v, is_default: v.unit_id === id })))

  return (
    <fieldset className="grid gap-2" aria-describedby={error ? 'units-error' : undefined}>
      <legend className="mb-1 text-sm font-medium">Units allowed in this category</legend>
      <ul className="grid divide-y rounded-lg border bg-surface">
        {units.data?.map((u) => {
          const sel = selected.get(u.id)
          return (
            <li
              key={u.id}
              className={cn(
                'flex min-h-(--row-h) items-center gap-3 px-3',
                sel && 'bg-steel-tint/40',
              )}
            >
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-ink"
                  checked={!!sel}
                  onChange={() => toggle(u.id)}
                />
                <span>{u.name}</span>
                <span className="code text-ink-muted">{u.symbol}</span>
              </label>
              {sel && (
                <label className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <input
                    type="radio"
                    name="default-unit"
                    className="size-4 accent-ink"
                    checked={sel.is_default}
                    onChange={() => setDefault(u.id)}
                    aria-label={`${u.name} is the default unit`}
                  />
                  Default
                </label>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <p id="units-error" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> New unit
        </Button>
      </div>
      {adding && (
        <UnitDialog
          onClose={(saved) => {
            setAdding(false)
            if (saved) onChange([...value, { unit_id: saved.id, is_default: value.length === 0 }])
          }}
        />
      )}
    </fieldset>
  )
}
