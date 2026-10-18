import { useQuery } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'
import { Field } from '@/components/shared/Field'
import { GstRateSelect } from '@/components/shared/inputs/GstRateSelect'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { Input } from '@/components/ui/input'
import { categoriesQuery } from './api'
import type { CategoryValues } from './category-form'

export const BASIC_FIELDS = [
  'name',
  'parent_id',
  'default_hsn',
  'default_gst',
  'tally_group',
  'description',
] as const

export function CategoryBasics({
  form,
  excludeId,
}: {
  form: UseFormReturn<CategoryValues>
  excludeId?: number
}) {
  const categories = useQuery(categoriesQuery())
  const e = form.formState.errors
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Category name" error={e.name?.message} className="sm:col-span-2">
        <Input placeholder="Steel" {...form.register('name')} />
      </Field>
      <Field
        label="Default HSN"
        error={e.default_hsn?.message}
        hint="New items in this category start with it"
      >
        <Input
          inputMode="numeric"
          className="code"
          placeholder="7214"
          {...form.register('default_hsn')}
        />
      </Field>
      <Field label="Default GST rate" error={e.default_gst?.message}>
        <GstRateSelect placeholder="None" {...form.register('default_gst')} />
      </Field>
      <Field label="Parent category" hint="Optional, for grouping in reports">
        <NativeSelect {...form.register('parent_id')}>
          <option value="">None</option>
          {categories.data
            ?.filter((c) => c.is_active && c.id !== excludeId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </NativeSelect>
      </Field>
      <Field label="Tally stock group" hint="Name used in Tally exports">
        <Input {...form.register('tally_group')} />
      </Field>
      <Field label="Description" className="sm:col-span-2">
        <Input {...form.register('description')} />
      </Field>
    </div>
  )
}
