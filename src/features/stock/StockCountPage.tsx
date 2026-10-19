import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/FilterBar'
import { Money, Qty } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { categoriesQuery } from '@/features/catalogue/api'
import { itemsQuery } from '@/features/inventory/api'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { problemMessage } from '@/lib/api/problem'
import { locationsQuery } from '@/lib/api/reference'
import { isNegative, isZero, QTY_RE } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePostCount, usePreviewCount, type StockCountPreview } from './api'

const draftKey = (loc: string) => `count-draft:${loc}`
function readDraft(loc: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(draftKey(loc)) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/** Physical stock count: count, preview the differences, then post them as adjustments (FR-PU-06, ui-plan #32). */
export function StockCountPage() {
  const navigate = useNavigate()
  const locations = useQuery(locationsQuery())
  const categories = useQuery(categoriesQuery())
  const preview = usePreviewCount()
  const post = usePostCount()
  const [key, renewKey] = useIdempotencyKey()
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState<string | undefined>()
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [result, setResult] = useState<StockCountPreview | null>(null)
  const [alert, setAlert] = useState<string | null>(null)
  const items = useQuery({
    ...itemsQuery({
      location_id: Number(location),
      category_id: category ? Number(category) : undefined,
      q,
      page_size: 200,
      sort: 'name',
    }),
    enabled: !!location,
  })

  const chooseLocation = (loc: string) => {
    setLocation(loc)
    setCounts(loc ? readDraft(loc) : {})
    setResult(null)
  }
  const setCount = (itemId: number, value: string) => {
    const next = { ...counts, [itemId]: value }
    setCounts(next)
    setResult(null)
    try {
      localStorage.setItem(draftKey(location), JSON.stringify(next))
    } catch {
      /* the draft is a convenience only */
    }
  }
  const lines = Object.entries(counts)
    .filter(([, v]) => v !== '' && QTY_RE.test(v))
    .map(([item_id, counted_qty]) => ({ item_id: Number(item_id), counted_qty }))

  const runPreview = async () => {
    setAlert(null)
    try {
      setResult(await preview.mutateAsync({ location_id: Number(location), lines }))
    } catch (e) {
      setAlert(problemMessage(e))
    }
  }
  const runPost = async () => {
    setAlert(null)
    try {
      const adj = await post.mutateAsync({ key, body: { location_id: Number(location), lines } })
      renewKey()
      localStorage.removeItem(draftKey(location))
      toast.success(`Count posted as adjustment ${adj.doc_no ?? ''}`)
      await navigate({ to: '/adjustments' })
    } catch (e) {
      setAlert(problemMessage(e))
    }
  }
  const differences = result?.lines?.filter((l) => !isZero(l.difference)) ?? []

  return (
    <div className="grid max-w-4xl gap-4">
      <PageHeader
        title="Physical count"
        back={
          <Link to="/adjustments" className="hover:text-ink">
            Adjustments
          </Link>
        }
        meta="Enter what you counted. Items left empty are not changed. Counts are kept on this device until posted."
      />
      <FormAlert message={alert} />
      <section className="flex flex-wrap items-end gap-3 rounded-lg border bg-surface p-4">
        <div className="w-48">
          <Field label="Location">
            <NativeSelect value={location} onChange={(e) => chooseLocation(e.target.value)}>
              <option value="">Choose</option>
              {locations.data
                ?.filter((l) => l.is_active !== false)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="w-48">
          <Field label="Category">
            <NativeSelect
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!location}
            >
              <option value="">All</option>
              {categories.data
                ?.filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        </div>
        {location && (
          <SearchInput value={q} onChange={setQ} placeholder="Find item…" label="Find item" />
        )}
      </section>

      {location && !result && (
        <section className="rounded-lg border bg-surface">
          {items.isLoading ? (
            <p className="p-4 text-ink-muted">Loading items…</p>
          ) : (
            <ul aria-label="Count sheet" className="divide-y">
              {items.data?.data.map((it) => {
                const sys = it.stock?.find((s) => String(s.location_id) === location)?.qty ?? '0'
                return (
                  <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{it.name}</p>
                      <p className="text-sm text-ink-muted">
                        System:{' '}
                        <Qty
                          value={sys}
                          decimals={it.base_unit.decimals}
                          unit={it.base_unit.symbol}
                        />
                      </p>
                    </div>
                    <div className="w-32 shrink-0">
                      <DecimalInput
                        aria-label={`Counted ${it.name}`}
                        placeholder="Counted"
                        decimals={it.base_unit.decimals}
                        value={counts[it.id] ?? ''}
                        onChange={(v) => setCount(it.id, v)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {!!items.data && items.data.meta.total > items.data.data.length && (
            <p className="border-t px-4 py-2 text-sm text-ink-muted">
              Showing the first 200 items; narrow by category or search.
            </p>
          )}
        </section>
      )}

      {result && (
        <section aria-label="Differences" className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-sunken text-left text-xs tracking-wide text-ink-muted uppercase">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">System</th>
                <th className="px-3 py-2 text-right font-medium">Counted</th>
                <th className="px-3 py-2 text-right font-medium">Difference</th>
                <th className="px-3 py-2 text-right font-medium">Value ₹</th>
              </tr>
            </thead>
            <tbody>
              {result.lines?.map((l) => (
                <tr
                  key={l.item_id}
                  className={cn('border-t', isZero(l.difference) && 'text-ink-muted')}
                >
                  <td className="px-3 py-2">{l.item_name}</td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={l.system_qty} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Qty value={l.counted_qty} />
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-medium',
                      !isNegative(l.difference) && !isZero(l.difference) && 'text-success',
                    )}
                  >
                    <Qty value={l.difference} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={l.value_difference} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {location && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {result ? (
            <>
              <p className="mr-auto text-sm text-ink-muted">
                {differences.length
                  ? `${differences.length} items differ; posting adjusts them as “Count correction”.`
                  : 'Everything matches. Nothing to post.'}
              </p>
              <Button variant="outline" onClick={() => setResult(null)}>
                Back to counting
              </Button>
              <Button
                disabled={!differences.length || post.isPending}
                onClick={() => void runPost()}
              >
                Post adjustments
              </Button>
            </>
          ) : (
            <Button disabled={!lines.length || preview.isPending} onClick={() => void runPreview()}>
              Preview differences ({lines.length})
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
