import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { PageHeader } from '@/components/shared/PageHeader'
import { Code } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formError } from '@/lib/api/forms'
import { unitsQuery } from '@/lib/api/reference'
import { useCan } from '@/lib/permissions'
import { useSaveUnit, type Unit } from './api'

export function UnitsPage() {
  const units = useQuery(unitsQuery())
  const canEdit = useCan('catalogue.manage')
  const [editing, setEditing] = useState<Unit | 'new' | null>(null)

  const columns: Column<Unit>[] = [
    { id: 'name', header: 'Name', cell: (u) => u.name, required: true, mobile: 'title' },
    { id: 'symbol', header: 'Symbol', cell: (u) => <Code>{u.symbol}</Code>, mobile: 'value' },
    {
      id: 'uqc',
      header: 'GST UQC',
      cell: (u) => (u.uqc_code ? <Code>{u.uqc_code}</Code> : null),
      mobile: 'subtitle',
    },
    {
      id: 'decimals',
      header: 'Decimals',
      align: 'right',
      cell: (u) => <span className="tabular">{u.decimals}</span>,
      mobile: 'subtitle',
    },
  ]
  if (canEdit)
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      required: true,
      width: '5rem',
      cell: (u) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(u)}
          aria-label={`Edit ${u.name}`}
        >
          Edit
        </Button>
      ),
      mobile: 'meta',
    })

  return (
    <>
      <PageHeader
        title="Units"
        meta="Units of measure used by categories and items. Quantities are stored in each item's base unit."
        actions={
          canEdit && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add unit
            </Button>
          )
        }
      />
      <DataTable
        label="Units"
        columns={columns}
        rows={units.data}
        rowKey={(u) => u.id}
        isLoading={units.isLoading}
        error={units.error}
        onRetry={() => void units.refetch()}
        empty="No units yet. Add the units you sell in: bag, kg, ton, nos."
      />
      {editing && (
        <UnitDialog
          unit={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  symbol: z.string().trim().min(1, 'Enter a symbol').max(10, 'At most 10 characters'),
  uqc_code: z
    .string()
    .trim()
    .max(3, 'GST UQC codes are 3 letters')
    .regex(/^[A-Z]*$/, 'Use capital letters, e.g. KGS'),
  decimals: z.coerce.number<string>().int().min(0).max(3),
})
type Values = z.input<typeof schema>

export function UnitDialog({ unit, onClose }: { unit?: Unit; onClose: (saved?: Unit) => void }) {
  const save = useSaveUnit()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: unit?.name ?? '',
      symbol: unit?.symbol ?? '',
      uqc_code: unit?.uqc_code ?? '',
      decimals: String(unit?.decimals ?? 0),
    },
  })
  const errors = form.formState.errors

  const onSubmit = form.handleSubmit(async (v) => {
    setAlert(null)
    try {
      const saved = await save.mutateAsync({
        id: unit?.id,
        body: {
          name: v.name,
          symbol: v.symbol,
          uqc_code: v.uqc_code || undefined,
          decimals: v.decimals,
        },
      })
      toast.success(unit ? `Unit ${saved.name} saved` : `Unit ${saved.name} added`)
      onClose(saved)
    } catch (e) {
      setAlert(
        formError(e, form.setError, {
          duplicateField: 'symbol',
          duplicateMessage: 'A unit with this symbol already exists',
        }),
      )
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{unit ? `Edit unit ${unit.name}` : 'Add unit'}</DialogTitle>
        </DialogHeader>
        <form id="unit-form" onSubmit={onSubmit} noValidate className="grid gap-3">
          <FormAlert message={alert} />
          <Field label="Name" error={errors.name?.message}>
            <Input autoFocus placeholder="Kilogram" {...form.register('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol" error={errors.symbol?.message}>
              <Input placeholder="kg" {...form.register('symbol')} />
            </Field>
            <Field label="GST UQC" error={errors.uqc_code?.message} hint="For e-invoices">
              <Input
                placeholder="KGS"
                className="uppercase"
                {...form.register('uqc_code', { setValueAs: (v: string) => v.toUpperCase() })}
              />
            </Field>
          </div>
          <Field
            label="Decimal places"
            error={errors.decimals?.message}
            hint="0 for bags and pieces; 3 for kg and tonnes"
          >
            <select
              className="h-(--control-h) rounded-md border border-input bg-surface px-2"
              {...form.register('decimals')}
            >
              {[0, 1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>
            Cancel
          </Button>
          <Button type="submit" form="unit-form" disabled={save.isPending}>
            {unit ? 'Save unit' : 'Add unit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
