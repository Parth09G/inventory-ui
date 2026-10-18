import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Info } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import {
  ALL_MODES,
  BANK_MODES,
  emptyPayment,
  PaymentSplitEditor,
} from '@/components/shared/inputs/PaymentSplitEditor'
import { ReasonDialog } from '@/components/shared/ReasonDialog'
import { Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useLocalDraft } from '@/hooks/useLocalDraft'
import { useIsPhone } from '@/hooks/useMediaQuery'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useShortcut } from '@/hooks/useShortcut'
import { ApiProblem, applyFieldErrors, problemMessage, type FieldError } from '@/lib/api/problem'
import { dateTime, isZero } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useCreateBill, useUpdateBill, type ShortLine } from '../api'
import { billSchema, toBillInput, type Bill, type BillFormValues } from '../bill-form'
import { BillHeader } from './BillHeader'
import { BillLines } from './BillLines'
import { ChargesSection } from './ChargesSection'
import { EffectsSummary, walkInUnpaid } from './EffectsSummary'
import { ShortagePanel } from './ShortagePanel'
import { TotalsPanel } from './TotalsPanel'
import { useBillCalculation } from './useBillCalculation'

type Props = {
  initial: BillFormValues
  /** The bill being edited (draft or active); absent for a new bill. */
  bill?: Bill
  shopState: string
  defaultLocationId?: number
  defaultChargeGst: string
  onReload?: () => void
}

type Shortage = { lines: { row: number; short: ShortLine }[]; alertSent: boolean }
type Pending = { status: 'active' | 'draft'; reason?: string }

/** Cash and Account bill entry (ui-plan §5.1, #7 and #8). */
export function BillEditor({
  initial,
  bill,
  shopState,
  defaultLocationId,
  defaultChargeGst,
  onReload,
}: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const phone = useIsPhone()
  const online = useOnlineStatus()
  const canOverride = useCan('credit_limit.override')
  const create = useCreateBill()
  const update = useUpdateBill()
  const [key, renewKey] = useIdempotencyKey()
  const form = useForm<BillFormValues>({
    resolver: zodResolver(billSchema) as never,
    defaultValues: initial,
  })
  const values = form.watch()
  const calc = useBillCalculation(values)
  const draft = useLocalDraft(`bill-draft:${bill ? bill.id : `new:${initial.bill_type}`}`, form)
  const [alert, setAlert] = useState<string | null>(null)
  const [shortage, setShortage] = useState<Shortage | null>(null)
  const [creditConfirm, setCreditConfirm] = useState<{ pending: Pending; message: string } | null>(
    null,
  )
  const [reasonOpen, setReasonOpen] = useState(false)
  const [conflict, setConflict] = useState(false)

  const isCash = values.bill_type === 'cash'
  const editingActive = bill?.status === 'active'
  const canDraft = !editingActive
  const pending = create.isPending || update.isPending
  const unpaidWalkIn = walkInUnpaid(values, calc.result)
  const canSaveActive = calc.current && !unpaidWalkIn && online && !pending
  const typeLabel = isCash ? 'Cash bill' : 'Account bill'

  // Shortages from the live calculation, then from a refused save.
  const shortRows = new Map<number, ShortLine>()
  calc.result?.stock_warnings?.forEach((s) => {
    const row = calc.lineIndex[(s.line_no ?? 1) - 1]
    if (row !== undefined) shortRows.set(row, s)
  })
  shortage?.lines.forEach(({ row, short }) => shortRows.set(row, short))

  const remap = (errors: FieldError[], lineIndex: number[]) =>
    errors.map((e) => ({
      ...e,
      field: e.field?.replace(
        /^lines\[(\d+)\]/,
        (_, n: string) => `lines[${lineIndex[Number(n)] ?? n}]`,
      ),
    }))

  const doSave = async ({ status, reason }: Pending, override = false) => {
    setAlert(null)
    setShortage(null)
    const v = form.getValues()
    const { body, lineIndex } = toBillInput(v, status, {
      expected_total: status === 'active' ? calc.result?.totals?.grand_total : undefined,
      override_credit_limit: override,
    })
    try {
      const saved = bill
        ? await update.mutateAsync({
            id: bill.id,
            version: bill.version,
            body,
            reason: reason ?? '',
          })
        : await create.mutateAsync({ body, key })
      draft.clear()
      renewKey()
      form.reset(v)
      if (saved.status === 'draft') {
        toast.success('Draft saved')
        if (!bill)
          await navigate({ to: '/bills/$id/edit', params: { id: saved.id }, replace: true })
      } else {
        toast.success(`${typeLabel} ${saved.bill_no} saved`)
        await navigate({ to: '/bills/$id', params: { id: saved.id } })
      }
    } catch (e) {
      if (!(e instanceof ApiProblem)) return setAlert(problemMessage(e))
      switch (e.code) {
        case 'INSUFFICIENT_STOCK': {
          const lines = ((e.body.short_lines as ShortLine[] | undefined) ?? []).map((s) => ({
            row: lineIndex[(s.line_no ?? 1) - 1] ?? 0,
            short: s,
          }))
          setShortage({ lines, alertSent: !!e.body.alert_sent })
          break
        }
        case 'CREDIT_LIMIT_EXCEEDED':
          if (canOverride) setCreditConfirm({ pending: { status, reason }, message: e.message })
          else setAlert(`${e.message} Only the owner (Super Admin) can save over the credit limit.`)
          break
        case 'VALIDATION_FAILED': {
          const rest = applyFieldErrors(form.setError, remap(e.errors, lineIndex))
          if (rest.some((x) => x.field === 'expected_total')) {
            void qc.invalidateQueries({ queryKey: ['bills', 'calculate'] })
            setAlert('The totals changed on the server. Check the new totals and save again.')
          } else if (rest.length) setAlert(rest.map((x) => x.message).join(' '))
          break
        }
        case 'IDEMPOTENCY_REPLAY_MISMATCH':
        case 'CONFLICT':
          renewKey()
          setAlert(`${e.message} Save again.`)
          break
        case 'VERSION_MISMATCH':
          setConflict(true)
          break
        default:
          setAlert(problemMessage(e))
      }
    }
  }

  const saveActive = form.handleSubmit(() => {
    if (!canSaveActive) return
    if (editingActive) setReasonOpen(true)
    else void doSave({ status: 'active' })
  })
  const saveDraft = form.handleSubmit(() => void doSave({ status: 'draft' }))

  useShortcut('ctrl+enter', () => void saveActive(), { allowInInputs: true })
  useShortcut('ctrl+s', () => void saveDraft(), { allowInInputs: true, enabled: canDraft })

  const saveButtons = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canDraft && (
        <Button
          type="button"
          variant="outline"
          disabled={pending || !online}
          onClick={() => void saveDraft()}
        >
          Save draft
        </Button>
      )}
      <Button type="button" disabled={!canSaveActive} onClick={() => void saveActive()}>
        {editingActive ? 'Save changes' : `Save ${typeLabel}`}
      </Button>
    </div>
  )

  return (
    <div className={cn('grid gap-4', phone && 'pb-20')}>
      <div
        className={cn(
          'flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-l-4 px-3 py-2',
          isCash ? 'border-l-cash bg-surface' : 'border-l-account bg-account-tint',
        )}
      >
        <h1 className={cn('text-xl font-semibold', !isCash && 'text-account')}>
          {bill?.bill_no
            ? `${editingActive ? 'Edit' : ''} ${typeLabel} ${bill.bill_no}`.trim()
            : bill
              ? `Draft ${typeLabel.toLowerCase()}`
              : `New ${typeLabel}`}
        </h1>
        <span className="text-sm text-ink-muted">
          {isCash
            ? 'Reduces stock at each line’s location and posts to the customer’s ledger.'
            : 'GST invoice paid into the bank. Does not change stock.'}
        </span>
      </div>

      {draft.restorable && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-md border bg-info-tint px-3 py-2 text-sm"
        >
          <Info className="size-4 text-info" aria-hidden />
          Unsaved changes from {dateTime(draft.restorable.savedAt)} were kept on this device.
          <Button size="sm" variant="outline" onClick={draft.restore}>
            Restore them
          </Button>
          <Button size="sm" variant="ghost" onClick={draft.discard}>
            Discard
          </Button>
        </div>
      )}
      {editingActive && (
        <p className="rounded-md border border-warning/40 bg-warning-tint px-3 py-2 text-sm">
          Editing a saved bill reverses its stock and ledger entries and applies them again. The
          current version ({bill.version}) is kept in the bill’s history.
          {bill.einvoice.status === 'generated' &&
            ' The IRN will be cancelled and a new one generated.'}
        </p>
      )}
      {conflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-danger-tint px-3 py-2"
        >
          Someone else changed this bill while you were editing. Your changes are still on screen;
          reload to see theirs.
          <Button size="sm" variant="outline" onClick={() => (setConflict(false), onReload?.())}>
            Reload the bill
          </Button>
        </div>
      )}
      <FormAlert message={alert} />
      {shortage && (
        <ShortagePanel
          {...shortage}
          onTakeFrom={(row, locationId) => {
            form.setValue(`lines.${row}.location_id`, String(locationId))
            setShortage((s) => (s ? { ...s, lines: s.lines.filter((l) => l.row !== row) } : s))
          }}
        />
      )}

      {/* Totals sit beside the lines only on wide screens; below that the line grid gets the full width. */}
      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-4">
          <section className="rounded-lg border bg-surface p-4">
            <BillHeader form={form} shopState={shopState} readOnlyCustomer={!!bill?.source_bill} />
          </section>
          <div className="grid gap-1">
            <BillLines
              form={form}
              calc={calc.result}
              calcIndex={calc.lineIndex}
              shortages={shortRows}
              defaultLocationId={defaultLocationId}
            />
            {form.formState.errors.lines?.root?.message && (
              <p className="text-sm text-danger">{form.formState.errors.lines.root.message}</p>
            )}
            {form.formState.errors.lines?.message && (
              <p className="text-sm text-danger">{form.formState.errors.lines.message}</p>
            )}
          </div>
          <section className="grid gap-3 rounded-lg border bg-surface p-4">
            <ChargesSection form={form} defaultGst={defaultChargeGst} />
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Field label="Bill discount ₹" error={form.formState.errors.bill_discount?.message}>
                <Controller
                  control={form.control}
                  name="bill_discount"
                  render={({ field }) => (
                    <DecimalInput
                      ref={field.ref}
                      decimals={2}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field label="Notes (printed on the bill)">
                <Textarea rows={1} {...form.register('notes')} />
              </Field>
            </div>
          </section>
        </div>

        <aside className="grid items-start gap-4 lg:grid-cols-3 2xl:sticky 2xl:top-16 2xl:grid-cols-1">
          <TotalsPanel calc={calc.result} updating={calc.updating} error={calc.error} />
          {!bill?.source_bill && (
            <section aria-label="Payments" className="grid gap-2 rounded-lg border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Payment now</h2>
                {calc.current &&
                  calc.result?.totals?.balance_due &&
                  !isZero(calc.result.totals.balance_due) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        form.setValue('payments', [
                          ...values.payments,
                          {
                            ...emptyPayment(isCash ? 'cash' : 'upi'),
                            amount: calc.result!.totals!.balance_due!,
                          },
                        ])
                      }
                    >
                      Paid in full
                    </Button>
                  )}
              </div>
              {canDraft && values.payments.length > 0 && (
                <p className="text-xs text-ink-muted">
                  Payments are recorded when the bill is saved; a draft keeps none.
                </p>
              )}
              <Controller
                control={form.control}
                name="payments"
                render={({ field }) => (
                  <PaymentSplitEditor
                    value={field.value}
                    onChange={field.onChange}
                    modes={isCash ? ALL_MODES : BANK_MODES}
                    errors={form.formState.errors.payments as never}
                  />
                )}
              />
              {!isCash && (
                <p className="text-xs text-ink-muted">
                  Account bills are paid by UPI, cheque or bank transfer.
                </p>
              )}
            </section>
          )}
          <EffectsSummary values={values} calc={calc.result} />
        </aside>
      </div>

      {!phone && (
        // Below 2xl the totals panel scrolls away, so the total and Save stay pinned to the bottom.
        <div className="sticky bottom-0 z-20 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t bg-surface px-6 py-2 2xl:static 2xl:mx-0 2xl:justify-end 2xl:border-0 2xl:bg-transparent 2xl:p-0">
          <p className="flex items-baseline gap-4 2xl:hidden">
            <span>
              <span className="text-sm text-ink-muted">Grand total </span>
              <span className="text-lg font-semibold">
                ₹ <Money value={calc.result?.totals?.grand_total ?? '0'} />
              </span>
            </span>
            {calc.result?.totals?.balance_due && (
              <span className="text-sm text-ink-muted">
                Balance due <Money value={calc.result.totals.balance_due} className="text-ink" />
              </span>
            )}
          </p>
          <div className="grid justify-items-end gap-1">
            {saveButtons}
            <p className="text-xs text-ink-muted">
              {!online
                ? 'Offline – saving is paused.'
                : calc.updating
                  ? 'Updating totals…'
                  : 'Ctrl+Enter to save' + (canDraft ? ' · Ctrl+S for a draft' : '')}
            </p>
          </div>
        </div>
      )}
      {phone && (
        <div className="fixed inset-x-0 bottom-14 z-30 flex items-center justify-between gap-3 border-t bg-surface px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Grand total</p>
            <p className="text-lg font-semibold">
              ₹ <Money value={calc.result?.totals?.grand_total ?? '0'} />
            </p>
          </div>
          {saveButtons}
        </div>
      )}

      <ReasonDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="Save changes to this bill?"
        effect="The stock and ledger entries are reversed and applied again with the new lines. The old version stays in the history."
        confirmLabel="Save changes"
        pending={pending}
        onConfirm={(reason) => {
          setReasonOpen(false)
          void doSave({ status: 'active', reason })
        }}
      />
      <ConfirmDialog
        open={!!creditConfirm}
        onOpenChange={(o) => !o && setCreditConfirm(null)}
        title="Over the credit limit"
        effect={
          <p>
            {creditConfirm?.message} As the owner you can save it anyway; this is recorded in the
            audit log.
          </p>
        }
        confirmLabel="Save over the limit"
        pending={pending}
        onConfirm={() => {
          const p = creditConfirm!.pending
          setCreditConfirm(null)
          void doSave(p, true)
        }}
      />
    </div>
  )
}
