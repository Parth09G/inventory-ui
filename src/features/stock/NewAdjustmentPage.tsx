import { zodResolver } from '@hookform/resolvers/zod'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ShortLine } from '@/features/billing/api'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useShortcut } from '@/hooks/useShortcut'
import { ApiProblem, problemMessage } from '@/lib/api/problem'
import { locationsQuery } from '@/lib/api/reference'
import { todayIST } from '@/lib/format'
import { ADJUST_REASON, useCreateAdjustment, type AdjustmentInput } from './api'
import {
  emptyStockLine,
  isBlankStockLine,
  StockLines,
  stockLineIssues,
  type StockLine,
  type StockLinesForm,
} from './StockLines'

const schema = z
  .object({
    location_id: z.string().min(1, 'Choose the location'),
    date: z.string(),
    reason: z.enum(['damage', 'breakage', 'wastage', 'count_correction', 'sample', 'other']),
    notes: z.string().trim(),
    lines: z.array(z.custom<StockLine>()),
  })
  .superRefine((v, ctx) => {
    if (v.reason === 'other' && v.notes.length < 3)
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Explain the adjustment' })
    for (const i of stockLineIssues(v.lines)) ctx.addIssue({ code: 'custom', ...i })
  })
type Values = z.infer<typeof schema>

/** Stock adjustment with a mandatory reason (FR-PU-05, ui-plan #31). */
export function NewAdjustmentPage() {
  const navigate = useNavigate()
  const { data: locations } = useSuspenseQuery(locationsQuery())
  const create = useCreateAdjustment()
  const [key, renewKey] = useIdempotencyKey()
  const [alert, setAlert] = useState<string | null>(null)
  const [shortages, setShortages] = useState(new Map<number, ShortLine>())
  const active = locations.filter((l) => l.is_active !== false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      location_id: String(active[0]?.id ?? ''),
      date: todayIST(),
      reason: 'damage',
      notes: '',
      lines: [emptyStockLine()],
    },
  })
  const e = form.formState.errors
  const locationId = Number(form.watch('location_id')) || undefined

  const onSubmit = form.handleSubmit(async (v) => {
    setAlert(null)
    setShortages(new Map())
    const index: number[] = []
    const lines = v.lines.flatMap((l, i) => {
      if (isBlankStockLine(l)) return []
      index.push(i)
      // Signed change in the item's base unit: removing stock is negative.
      return [{ item_id: l.item!.id, qty_change: l.direction === 'out' ? `-${l.qty}` : l.qty }]
    })
    try {
      const a = await create.mutateAsync({
        key,
        body: {
          location_id: Number(v.location_id),
          adj_date: v.date,
          reason: v.reason as AdjustmentInput['reason'],
          notes: v.notes || undefined,
          lines,
        },
      })
      renewKey()
      toast.success(`Adjustment ${a.doc_no ?? ''} saved`)
      await navigate({ to: '/adjustments' })
    } catch (err) {
      if (err instanceof ApiProblem && err.code === 'INSUFFICIENT_STOCK') {
        const short = (err.body.short_lines as ShortLine[] | undefined) ?? []
        setShortages(new Map(short.map((s) => [index[(s.line_no ?? 1) - 1] ?? 0, s])))
        setAlert('Stock cannot go below zero. Check the marked lines.')
      } else setAlert(problemMessage(err))
    }
  })
  useShortcut('ctrl+enter', () => void onSubmit(), { allowInInputs: true })

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-4xl gap-4">
      <PageHeader
        title="New adjustment"
        back={
          <Link to="/adjustments" className="hover:text-ink">
            Adjustments
          </Link>
        }
      />
      <FormAlert message={alert} />
      <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-3">
        <Field label="Location" error={e.location_id?.message}>
          <NativeSelect {...form.register('location_id')}>
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Reason">
          <NativeSelect {...form.register('reason')}>
            {Object.entries(ADJUST_REASON).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date">
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
          />
        </Field>
      </section>
      <StockLines
        form={form as unknown as UseFormReturn<StockLinesForm>}
        label="Adjustment lines"
        locationId={locationId}
        signed
        shortages={shortages}
      />
      <Field label="Notes" error={e.notes?.message}>
        <Textarea rows={2} {...form.register('notes')} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Save adjustment
        </Button>
      </div>
    </form>
  )
}
