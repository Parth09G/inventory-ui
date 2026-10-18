import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormAlert } from '@/components/shared/FormAlert'
import { KeyValueGrid } from '@/components/shared/KeyValueGrid'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { formError } from '@/lib/api/forms'
import { unitsQuery } from '@/lib/api/reference'
import { cn } from '@/lib/utils'
import { useSaveCategory } from './api'
import { AttributeDialog } from './AttributeDialog'
import { AttributeTable } from './AttributeTable'
import { BASIC_FIELDS, CategoryBasics } from './CategoryBasics'
import { categorySchema, toCategoryInput, type CategoryValues } from './category-form'
import { UnitsPicker } from './UnitsPicker'

const STEPS = ['Basics', 'Units', 'Attributes', 'Review'] as const

/** Category setup wizard (FR-IN-01, ui-plan #34). */
export function NewCategoryPage() {
  const navigate = useNavigate()
  const save = useSaveCategory()
  const units = useQuery(unitsQuery())
  const [step, setStep] = useState(0)
  const [alert, setAlert] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      parent_id: '',
      default_hsn: '',
      default_gst: '18',
      tally_group: '',
      description: '',
      units: [],
      attributes: [],
    },
  })
  const attrs = useFieldArray({ control: form.control, name: 'attributes', keyName: 'key' })
  const values = form.watch()

  const next = async () => {
    const fields =
      step === 0 ? [...BASIC_FIELDS] : step === 1 ? (['units'] as const) : (['attributes'] as const)
    if (await form.trigger(fields, { shouldFocus: true })) setStep((s) => s + 1)
  }

  const submit = form.handleSubmit(async (v) => {
    setAlert(null)
    try {
      const created = await save.mutateAsync({ body: toCategoryInput(v, true) })
      toast.success(`Category ${created.name} created`)
      await navigate({ to: '/catalogue/categories/$id', params: { id: created.id } })
    } catch (e) {
      const msg = formError(e, form.setError, {
        duplicateField: 'name',
        duplicateMessage: 'A category with this name already exists',
      })
      if (form.formState.errors.name) setStep(0)
      setAlert(msg)
    }
  })

  const unitName = (id: number) => units.data?.find((u) => u.id === id)?.name ?? `#${id}`

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New category"
        back={
          <Link to="/catalogue/categories" className="hover:text-ink">
            Categories
          </Link>
        }
      />
      <ol className="mb-5 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5',
              i === step ? 'font-medium text-ink' : 'text-ink-muted',
            )}
          >
            <span
              className={cn(
                'grid size-5 place-items-center rounded-full border text-xs tabular',
                i < step && 'border-ink bg-ink text-white',
                i === step && 'border-ink',
              )}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (step === STEPS.length - 1) void submit(e)
          else void next()
        }}
        noValidate
        className="grid gap-4 rounded-lg border bg-surface p-4 sm:p-5"
      >
        <FormAlert message={alert} />
        {step === 0 && <CategoryBasics form={form} />}
        {step === 1 && (
          <UnitsPicker
            value={values.units}
            onChange={(u) =>
              form.setValue('units', u, { shouldValidate: form.formState.isSubmitted })
            }
            error={
              form.formState.errors.units?.message ?? form.formState.errors.units?.root?.message
            }
          />
        )}
        {step === 2 && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Attributes items in this category have</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing('new')}>
                <Plus className="size-4" /> Add attribute
              </Button>
            </div>
            <AttributeTable
              attributes={attrs.fields}
              onEdit={setEditing}
              onMove={(i, d) => attrs.swap(i, i + d)}
              onDelete={(i) => attrs.remove(i)}
            />
            {form.formState.errors.attributes?.root?.message && (
              <p className="text-sm text-danger">{form.formState.errors.attributes.root.message}</p>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="grid gap-4">
            <KeyValueGrid
              items={[
                ['Name', values.name],
                [
                  'Default HSN',
                  values.default_hsn && (
                    <span key="hsn" className="code">
                      {values.default_hsn}
                    </span>
                  ),
                ],
                ['Default GST', values.default_gst && `${values.default_gst}%`],
                [
                  'Units',
                  values.units
                    .map((u) => unitName(u.unit_id) + (u.is_default ? ' (default)' : ''))
                    .join(', '),
                ],
              ]}
            />
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">
                Attributes
              </p>
              <p>
                {values.attributes.length
                  ? values.attributes.map((a) => a.label).join(', ')
                  : 'None'}
              </p>
            </div>
          </div>
        )}
        <div className="flex justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="submit">Next: {STEPS[step + 1]}</Button>
          ) : (
            <Button type="submit" disabled={save.isPending}>
              Create category
            </Button>
          )}
        </div>
      </form>

      {editing !== null && (
        <AttributeDialog
          initial={editing === 'new' ? undefined : attrs.fields[editing]}
          takenCodes={attrs.fields.filter((_, i) => i !== editing).map((a) => a.code)}
          onSave={(v) => {
            if (editing === 'new') attrs.append(v)
            else attrs.update(editing, v)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
