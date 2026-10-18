import { Plus, X } from 'lucide-react'
import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { GstRateSelect } from '@/components/shared/inputs/GstRateSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BillFormValues, ChargeValues } from '../bill-form'

const KIND: Record<ChargeValues['kind'], string> = {
  labour: 'Labour',
  transport: 'Transport',
  other: 'Other',
}

/** Labour, transport and other charges, each with its own GST (FR-BL-04). */
export function ChargesSection({
  form,
  defaultGst,
}: {
  form: UseFormReturn<BillFormValues>
  defaultGst: string
}) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'charges' })
  const e = form.formState.errors
  const add = (kind: ChargeValues['kind']) =>
    append({ kind, description: '', amount: '', gst_rate: defaultGst, sac_code: '' })
  return (
    <section className="grid gap-2" aria-label="Charges">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-semibold">Charges</h2>
        {(['labour', 'transport', 'other'] as const).map((k) => (
          <Button key={k} type="button" variant="outline" size="sm" onClick={() => add(k)}>
            <Plus className="size-4" /> {KIND[k]}
          </Button>
        ))}
      </div>
      {fields.map((f, i) => (
        <div
          key={f.id}
          className="grid grid-cols-[6rem_1fr_7rem_5.5rem_auto] items-start gap-1.5 max-sm:grid-cols-[1fr_7rem_auto]"
        >
          <span className="pt-1.5 text-sm font-medium max-sm:col-span-3">{KIND[f.kind]}</span>
          <Input
            aria-label={`${KIND[f.kind]} description`}
            placeholder="Description"
            className="max-sm:col-span-3"
            {...form.register(`charges.${i}.description`)}
          />
          <Controller
            control={form.control}
            name={`charges.${i}.amount`}
            render={({ field }) => (
              <DecimalInput
                ref={field.ref}
                aria-label={`${KIND[f.kind]} amount`}
                aria-invalid={!!e.charges?.[i]?.amount}
                decimals={2}
                placeholder="₹"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <GstRateSelect
            aria-label={`${KIND[f.kind]} GST`}
            {...form.register(`charges.${i}.gst_rate`)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${KIND[f.kind]} charge`}
            onClick={() => remove(i)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </section>
  )
}
