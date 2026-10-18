import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { attributeSchema, codeFromLabel, type AttributeValues } from './category-form'

const EMPTY: AttributeValues = {
  label: '',
  code: '',
  data_type: 'text',
  options: '',
  value_unit: '',
  is_required: true,
  part_of_name: true,
}

type Props = {
  initial?: AttributeValues
  /** Codes already used in the category (duplicates are refused). */
  takenCodes: string[]
  /** Throws to keep the dialog open; returns a form-level message, or nothing on success. */
  onSave: (v: AttributeValues) => Promise<string | null | void> | string | null | void
  onClose: () => void
}

/** Add or edit one category attribute (FR-IN-02). */
export function AttributeDialog({ initial, takenCodes, onSave, onClose }: Props) {
  const [alert, setAlert] = useState<string | null>(null)
  const [codeEdited, setCodeEdited] = useState(!!initial)
  const form = useForm<AttributeValues>({
    resolver: zodResolver(attributeSchema),
    defaultValues: initial ?? EMPTY,
  })
  const e = form.formState.errors
  const type = form.watch('data_type')

  const submit = form.handleSubmit(async (v) => {
    if (takenCodes.includes(v.code)) {
      form.setError(
        'code',
        { message: 'Another attribute already uses this code' },
        { shouldFocus: true },
      )
      return
    }
    const msg = await onSave(v)
    if (msg) setAlert(msg)
    else onClose()
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit attribute ${initial.label}` : 'Add attribute'}</DialogTitle>
          <DialogDescription>
            Items in this category record a value for it, e.g. Brand or Size.
          </DialogDescription>
        </DialogHeader>
        <form
          id="attr-form"
          onSubmit={(ev) => (ev.stopPropagation(), void submit(ev))}
          noValidate
          className="grid gap-3"
        >
          <FormAlert message={alert} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label" error={e.label?.message}>
              <Input
                autoFocus
                placeholder="Size"
                {...form.register('label', {
                  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                    if (!codeEdited) form.setValue('code', codeFromLabel(ev.target.value))
                  },
                })}
              />
            </Field>
            <Field label="Code" error={e.code?.message} hint="Used in Excel import columns">
              <Input
                className="code"
                {...form.register('code', { onChange: () => setCodeEdited(true) })}
              />
            </Field>
            <Field label="Type">
              <NativeSelect {...form.register('data_type')}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Pick-list</option>
              </NativeSelect>
            </Field>
            <Field label="Unit of value" hint="Optional, e.g. mm, kg/m, L">
              <Input placeholder="mm" {...form.register('value_unit')} />
            </Field>
          </div>
          {type === 'select' && (
            <Field label="Options" error={e.options?.message} hint="Separate with commas">
              <Input placeholder="Round, Square, Rectangular" {...form.register('options')} />
            </Field>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              {...form.register('is_required')}
            />
            Required on every item
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              {...form.register('part_of_name')}
            />
            Part of the item name (e.g. “JSW 12 mm”)
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="attr-form" disabled={form.formState.isSubmitting}>
            {initial ? 'Save attribute' : 'Add attribute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
