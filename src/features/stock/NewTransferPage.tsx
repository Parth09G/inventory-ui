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
import { Input } from '@/components/ui/input'
import type { ShortLine } from '@/features/billing/api'
import type { Item } from '@/features/inventory/api'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useShortcut } from '@/hooks/useShortcut'
import { ApiProblem, problemMessage } from '@/lib/api/problem'
import { locationsQuery } from '@/lib/api/reference'
import { todayIST } from '@/lib/format'
import { useCreateTransfer } from './api'
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
    from: z.string().min(1, 'Choose where the stock leaves from'),
    to: z.string().min(1, 'Choose where it goes'),
    date: z.string(),
    vehicle_no: z.string(),
    notes: z.string(),
    lines: z.array(z.custom<StockLine>()),
  })
  .superRefine((v, ctx) => {
    if (v.from && v.from === v.to)
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Choose a different location' })
    for (const i of stockLineIssues(v.lines)) ctx.addIssue({ code: 'custom', ...i })
  })
type Values = z.infer<typeof schema>

/** Move stock between the shop and godowns in one transaction (FR-PU-04, ui-plan #28). */
export function NewTransferPage({ item, from, to }: { item?: Item; from?: number; to?: number }) {
  const navigate = useNavigate()
  const { data: locations } = useSuspenseQuery(locationsQuery())
  const create = useCreateTransfer()
  const [key, renewKey] = useIdempotencyKey()
  const [alert, setAlert] = useState<string | null>(null)
  const [shortages, setShortages] = useState(new Map<number, ShortLine>())
  const active = locations.filter((l) => l.is_active !== false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      from: from ? String(from) : String(active.find((l) => l.kind === 'godown')?.id ?? ''),
      to: to ? String(to) : String(active.find((l) => l.kind === 'shop')?.id ?? ''),
      date: todayIST(),
      vehicle_no: '',
      notes: '',
      lines: [emptyStockLine(item)],
    },
  })
  const e = form.formState.errors
  const fromId = Number(form.watch('from')) || undefined

  const onSubmit = form.handleSubmit(async (v) => {
    setAlert(null)
    setShortages(new Map())
    const index: number[] = []
    const lines = v.lines.flatMap((l, i) => {
      if (isBlankStockLine(l)) return []
      index.push(i)
      return [{ item_id: l.item!.id, qty: l.qty, unit_id: Number(l.unit_id) }]
    })
    try {
      const t = await create.mutateAsync({
        key,
        body: {
          from_location_id: Number(v.from),
          to_location_id: Number(v.to),
          transfer_date: v.date,
          vehicle_no: v.vehicle_no || undefined,
          notes: v.notes || undefined,
          lines,
        },
      })
      renewKey()
      toast.success(`Transfer ${t.doc_no ?? ''} saved`)
      await navigate({ to: '/transfers/$id', params: { id: t.id! } })
    } catch (err) {
      if (err instanceof ApiProblem && err.code === 'INSUFFICIENT_STOCK') {
        const short = (err.body.short_lines as ShortLine[] | undefined) ?? []
        setShortages(new Map(short.map((s) => [index[(s.line_no ?? 1) - 1] ?? 0, s])))
        setAlert('Not enough stock at the source for the marked lines. Nothing was moved.')
      } else setAlert(problemMessage(err))
    }
  })
  useShortcut('ctrl+enter', () => void onSubmit(), { allowInInputs: true })

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-4xl gap-4">
      <PageHeader
        title="New transfer"
        back={
          <Link to="/transfers" className="hover:text-ink">
            Transfers
          </Link>
        }
      />
      <FormAlert message={alert} />
      <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-4">
        <Field label="From" error={e.from?.message}>
          <NativeSelect {...form.register('from')}>
            <option value="">Choose</option>
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="To" error={e.to?.message}>
          <NativeSelect {...form.register('to')}>
            <option value="">Choose</option>
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
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
        <Field label="Vehicle no.">
          <Input
            className="code uppercase"
            {...form.register('vehicle_no', {
              setValueAs: (s: string) => s.toUpperCase().replace(/\s/g, ''),
            })}
          />
        </Field>
      </section>
      <StockLines
        form={form as unknown as UseFormReturn<StockLinesForm>}
        label="Transfer lines"
        locationId={fromId}
        shortages={shortages}
      />
      <Field label="Notes">
        <Input {...form.register('notes')} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Save transfer
        </Button>
      </div>
    </form>
  )
}
