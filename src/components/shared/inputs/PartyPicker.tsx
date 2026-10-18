import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { forwardRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { partiesQuery, useSaveParty, type Party } from '@/features/parties/api'
import { formError } from '@/lib/api/forms'
import { GSTIN_RE } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Field } from '../Field'
import { FormAlert } from '../FormAlert'
import { Balance } from '../values'
import { Combobox, type ComboboxExtra } from './Combobox'
import { StateSelect } from './StateSelect'

type Props = {
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  kind: 'customer' | 'supplier'
  /** Label of the current choice ("Walk-in: Mahesh", party name, or ''). */
  selectedLabel: string
  onSelect: (party: Party) => void
  /** Offer "Walk-in customer" (Cash bills only, BR-09). */
  onWalkIn?: () => void
  disabled?: boolean
}

/** Customer or dealer search with balance, plus walk-in and quick add (FR-BL-01). */
export const PartyPicker = forwardRef<HTMLInputElement, Props>(function PartyPicker(p, ref) {
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const canCreate = useCan('party.manage')
  const term = useDebouncedValue(q.trim(), 200)
  const results = useQuery({
    ...partiesQuery({ q: term, kind: p.kind, page_size: 10 }),
    enabled: term.length >= 1,
    placeholderData: undefined,
  })
  const noun = p.kind === 'customer' ? 'customer' : 'dealer'

  const extras: ComboboxExtra[] = []
  if (p.onWalkIn)
    extras.push({ key: 'walk-in', label: 'Walk-in customer (pays in full)', onSelect: p.onWalkIn })
  if (canCreate)
    extras.push({
      key: 'new',
      label: q.trim() ? `Add “${q.trim()}” as a new ${noun}` : `Add a new ${noun}`,
      onSelect: () => setAdding(q.trim()),
    })

  return (
    <>
      <Combobox<Party>
        ref={ref}
        id={p.id}
        aria-label={p['aria-label'] ?? (p.kind === 'customer' ? 'Customer' : 'Dealer')}
        aria-invalid={p['aria-invalid']}
        disabled={p.disabled}
        selectedLabel={p.selectedLabel}
        placeholder={`Search ${noun} by name, mobile, GSTIN…`}
        query={q}
        onQueryChange={setQ}
        options={term === q.trim() ? results.data?.data.filter((x) => x.is_active) : undefined}
        loading={results.isFetching || term !== q.trim()}
        getKey={(x) => x.id}
        onSelect={p.onSelect}
        extras={extras}
        renderOption={(x) => (
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{x.name}</p>
              <p className="truncate text-sm text-ink-muted">
                {[x.mobile, x.gstin].filter(Boolean).join(' · ') || 'No mobile or GSTIN'}
              </p>
            </div>
            <Balance value={x.balance} className="text-sm" />
          </div>
        )}
      />
      {adding !== null && (
        <QuickPartyDialog
          kind={p.kind}
          name={adding}
          onClose={(party) => {
            setAdding(null)
            if (party) p.onSelect(party)
          }}
        />
      )}
    </>
  )
})

const quickSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  mobile: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, '').replace(/^(\+?91)(?=\d{10}$)/, ''))
    .pipe(z.string().regex(/^$|^\d{10}$/, 'Enter a 10-digit mobile number')),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^$|${GSTIN_RE.source}`), 'Enter a valid 15-character GSTIN'),
  state_code: z.string(),
})

/** Short party form used from pickers; the full form is on the Parties page. */
function QuickPartyDialog({
  kind,
  name,
  onClose,
}: {
  kind: 'customer' | 'supplier'
  name: string
  onClose: (p?: Party) => void
}) {
  const save = useSaveParty()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<z.input<typeof quickSchema>, unknown, z.output<typeof quickSchema>>({
    resolver: zodResolver(quickSchema),
    defaultValues: { name, mobile: '', gstin: '', state_code: '' },
  })
  const e = form.formState.errors
  const submit = form.handleSubmit(async (v) => {
    try {
      const party = await save.mutateAsync({
        body: {
          kind,
          name: v.name,
          mobile: v.mobile || undefined,
          gstin: v.gstin || undefined,
          state_code: v.state_code || (v.gstin ? v.gstin.slice(0, 2) : undefined),
        },
      })
      onClose(party)
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New {kind === 'customer' ? 'customer' : 'dealer'}</DialogTitle>
          <DialogDescription>
            Add the address, sites and credit limit later from Parties.
          </DialogDescription>
        </DialogHeader>
        <form
          id="quick-party"
          onSubmit={(ev) => (ev.stopPropagation(), void submit(ev))}
          noValidate
          className="grid gap-3"
        >
          <FormAlert message={alert} />
          <Field label="Name" error={e.name?.message}>
            <Input autoFocus {...form.register('name')} />
          </Field>
          <Field label="Mobile" error={e.mobile?.message}>
            <Input type="tel" inputMode="tel" {...form.register('mobile')} />
          </Field>
          <Field label="GSTIN" error={e.gstin?.message} hint="Needed for B2B bills and e-invoices">
            <Input
              className="code uppercase"
              maxLength={15}
              {...form.register('gstin', {
                onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                  const code = ev.target.value.slice(0, 2)
                  if (/^\d{2}$/.test(code)) form.setValue('state_code', code)
                },
              })}
            />
          </Field>
          <Field label="State">
            <StateSelect {...form.register('state_code')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>
            Cancel
          </Button>
          <Button type="submit" form="quick-party" disabled={save.isPending}>
            Add {kind === 'customer' ? 'customer' : 'dealer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
