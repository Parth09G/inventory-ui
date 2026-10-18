import { useQuery } from '@tanstack/react-query'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { Field } from '@/components/shared/Field'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { PartyPicker } from '@/components/shared/inputs/PartyPicker'
import { StateSelect } from '@/components/shared/inputs/StateSelect'
import { Balance, Code, Money } from '@/components/shared/values'
import { Input } from '@/components/ui/input'
import { partyQuery } from '@/features/parties/api'
import type { BillFormValues } from '../bill-form'

/** Customer, place of supply, date and vehicle (FR-BL-01). */
export function BillHeader({
  form,
  shopState,
  readOnlyCustomer,
}: {
  form: UseFormReturn<BillFormValues>
  shopState: string
  readOnlyCustomer?: boolean
}) {
  const v = form.watch()
  const c = v.customer
  const e = form.formState.errors
  const party = useQuery({
    ...partyQuery(c.party?.id ?? 0),
    enabled: c.mode === 'party' && !!c.party,
  }).data
  const isCash = v.bill_type === 'cash'

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_10rem_9rem]">
      <div className="grid content-start gap-1">
        <Field label={isCash ? 'Customer' : 'Customer (named)'} error={e.customer?.party?.message}>
          <PartyPicker
            kind="customer"
            disabled={readOnlyCustomer}
            selectedLabel={
              c.mode === 'party'
                ? (c.party?.name ?? '')
                : c.mode === 'walk_in'
                  ? 'Walk-in customer'
                  : ''
            }
            onSelect={(p) => {
              form.setValue(
                'customer',
                {
                  mode: 'party',
                  party: p,
                  walk_in_name: '',
                  gstin: p.gstin ?? '',
                  billing_address: p.billing_address ?? '',
                  mobile: p.mobile ?? '',
                  site_address: '',
                },
                { shouldValidate: form.formState.isSubmitted },
              )
              // Place of supply follows the customer's state (CGST/SGST vs IGST, FR-BL-05).
              form.setValue('place_of_supply', p.state_code || shopState)
              // Date, place of supply and vehicle have good defaults: go straight to the first item (design P1).
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>('[data-line-grid] [data-cell="item"] input')
                  ?.focus(),
              )
            }}
            onWalkIn={
              isCash
                ? () => {
                    form.setValue('customer', {
                      mode: 'walk_in',
                      party: null,
                      walk_in_name: '',
                      gstin: '',
                      billing_address: '',
                      mobile: '',
                      site_address: '',
                    })
                    form.setValue('place_of_supply', shopState)
                  }
                : undefined
            }
          />
        </Field>
        {c.mode === 'party' && party && (
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
            {party.gstin ? <Code>{party.gstin}</Code> : <span>No GSTIN (B2C)</span>}
            <span>
              Balance <Balance value={party.balance} className="text-ink" />
            </span>
            {party.credit_limit && (
              <span>
                Limit <Money value={party.credit_limit} className="text-ink" />
              </span>
            )}
          </p>
        )}
        {c.mode === 'walk_in' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Walk-in name" error={e.customer?.walk_in_name?.message}>
              <Input autoFocus {...form.register('customer.walk_in_name')} />
            </Field>
            <Field label="Mobile (optional)">
              <Input type="tel" inputMode="tel" {...form.register('customer.mobile')} />
            </Field>
          </div>
        )}
        {c.mode === 'party' && !!party?.sites?.length && (
          <Field label="Deliver to site">
            <NativeSelect {...form.register('customer.site_address')}>
              <option value="">Billing address</option>
              {party.sites.map((s) => (
                <option key={s.id} value={s.address}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      <Field label="Place of supply" error={e.place_of_supply?.message}>
        <StateSelect {...form.register('place_of_supply')} />
      </Field>
      <Field label="Bill date" error={e.bill_date?.message}>
        <Controller
          control={form.control}
          name="bill_date"
          render={({ field }) => (
            <DateInput
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </Field>
      <Field label="Vehicle no.">
        <Input
          className="code uppercase"
          placeholder="KA05AB1234"
          {...form.register('vehicle_no', {
            setValueAs: (s: string) => s.toUpperCase().replace(/\s/g, ''),
          })}
        />
      </Field>
    </div>
  )
}
