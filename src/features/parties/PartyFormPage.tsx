import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { StateSelect } from '@/components/shared/inputs/StateSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formError } from '@/lib/api/forms'
import { cn } from '@/lib/utils'
import { useSaveParty, type Party } from './api'
import { emptyParty, fromParty, partySchema, toPartyInput, type PartyValues } from './party-form'

/** Create or edit a customer or dealer (FR-CU-01, ui-plan #17). */
export function PartyFormPage({ party, kind }: { party?: Party; kind?: Party['kind'] }) {
  const navigate = useNavigate()
  const save = useSaveParty()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<PartyValues>({
    resolver: zodResolver(partySchema),
    defaultValues: party ? fromParty(party) : emptyParty(kind),
  })
  const sites = useFieldArray({ control: form.control, name: 'sites' })
  const e = form.formState.errors
  const side = form.watch('opening_side')

  const onSubmit = form.handleSubmit(async (v) => {
    setAlert(null)
    try {
      const saved = await save.mutateAsync({ id: party?.id, body: toPartyInput(v) })
      toast.success(party ? `${saved.name} saved` : `${saved.name} added`)
      await navigate({ to: '/parties/$id', params: { id: saved.id } })
    } catch (err) {
      setAlert(
        formError(err, form.setError, {
          duplicateField: 'gstin',
          duplicateMessage: 'Another party already has this GSTIN',
        }),
      )
    }
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={party ? `Edit ${party.name}` : 'New party'}
        back={
          party ? (
            <Link to="/parties/$id" params={{ id: party.id }} className="hover:text-ink">
              {party.name}
            </Link>
          ) : (
            <Link to="/parties" className="hover:text-ink">
              Parties
            </Link>
          )
        }
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <FormAlert message={alert} />
        <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:p-5">
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
            <legend className="mb-1 text-sm font-medium">Type</legend>
            {(
              [
                ['customer', 'Customer'],
                ['supplier', 'Dealer (supplier)'],
                ['both', 'Both'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  value={value}
                  className="size-4 accent-ink"
                  {...form.register('kind')}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <Field label="Name" error={e.name?.message}>
            <Input autoFocus={!party} {...form.register('name')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mobile" error={e.mobile?.message}>
              <Input type="tel" inputMode="tel" {...form.register('mobile')} />
            </Field>
            <Field label="Other phone">
              <Input type="tel" inputMode="tel" {...form.register('alt_phone')} />
            </Field>
            <Field label="GSTIN" error={e.gstin?.message} hint="For B2B bills and e-invoices">
              <Input
                className="code uppercase"
                maxLength={15}
                {...form.register('gstin', {
                  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                    // The first two digits of a GSTIN are the state code.
                    const code = ev.target.value.slice(0, 2)
                    if (/^\d{2}$/.test(code))
                      form.setValue('state_code', code, {
                        shouldValidate: form.formState.isSubmitted,
                      })
                  },
                })}
              />
            </Field>
            <Field label="State" error={e.state_code?.message} hint="Decides CGST + SGST or IGST">
              <StateSelect {...form.register('state_code')} />
            </Field>
          </div>
          <Field label="Billing address">
            <Textarea rows={2} {...form.register('billing_address')} />
          </Field>
          <div className="max-w-40">
            <Field label="PIN code" error={e.pincode?.message}>
              <Input
                inputMode="numeric"
                maxLength={6}
                className="tabular"
                {...form.register('pincode')}
              />
            </Field>
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Sites</h2>
          <p className="text-sm text-ink-muted">Delivery addresses, chosen on bills.</p>
          {sites.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
              <Field label={`Site ${i + 1} name`} error={e.sites?.[i]?.label?.message}>
                <Input placeholder="Yelahanka plot" {...form.register(`sites.${i}.label`)} />
              </Field>
              <Field label="Address" error={e.sites?.[i]?.address?.message}>
                <Input {...form.register(`sites.${i}.address`)} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:mt-5"
                aria-label={`Remove site ${i + 1}`}
                onClick={() => sites.remove(i)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => sites.append({ label: '', address: '' })}
            >
              <Plus className="size-4" /> Add site
            </Button>
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Credit and opening balance</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Credit limit ₹"
              error={e.credit_limit?.message}
              hint="Warn when outstanding goes over it"
            >
              <Input
                inputMode="decimal"
                className="text-right tabular"
                {...form.register('credit_limit')}
              />
            </Field>
            <Field label="Opening balance ₹" error={e.opening_amount?.message}>
              <Input
                inputMode="decimal"
                className="text-right tabular"
                {...form.register('opening_amount')}
              />
            </Field>
            <Field label="As on" hint="Cut-over date">
              <Controller
                control={form.control}
                name="opening_date"
                render={({ field }) => (
                  <DateInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
            </Field>
          </div>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
            <legend className="sr-only">Opening balance direction</legend>
            {(
              [
                ['dr', 'They owe us (Dr)'],
                ['cr', 'We owe them (Cr)'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn('flex items-center gap-2', side === value && 'font-medium')}
              >
                <input
                  type="radio"
                  value={value}
                  className="size-4 accent-ink"
                  {...form.register('opening_side')}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <Field label="Notes">
            <Textarea rows={2} {...form.register('notes')} />
          </Field>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {party ? 'Save party' : 'Add party'}
          </Button>
        </div>
      </form>
    </div>
  )
}
