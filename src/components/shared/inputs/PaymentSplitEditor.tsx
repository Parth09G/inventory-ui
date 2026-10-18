import { Plus, X } from 'lucide-react'
import type { FieldErrors } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { components } from '@/lib/api/schema'
import { DateInput } from './DateInput'
import { DecimalInput } from './DecimalInput'
import { NativeSelect } from './NativeSelect'

export type PaymentMode = components['schemas']['PaymentSplitInput']['mode']
export type PaymentRow = {
  mode: PaymentMode
  amount: string
  reference: string
  cheque_no: string
  cheque_date: string
  bank_name: string
}

export const MODE_LABEL: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  cheque: 'Cheque',
  bank_transfer: 'Bank transfer',
}
export const ALL_MODES: PaymentMode[] = ['cash', 'upi', 'cheque', 'bank_transfer']
/** Account bills are paid into the bank only (FR-AB-06, O-03). */
export const BANK_MODES: PaymentMode[] = ['upi', 'cheque', 'bank_transfer']

const REF_LABEL: Partial<Record<PaymentMode, string>> = {
  upi: 'UPI reference',
  bank_transfer: 'UTR',
}

export function emptyPayment(mode: PaymentMode): PaymentRow {
  return { mode, amount: '', reference: '', cheque_no: '', cheque_date: '', bank_name: '' }
}

export function toPaymentInput(p: PaymentRow): components['schemas']['PaymentSplitInput'] {
  return {
    mode: p.mode,
    amount: p.amount,
    reference: p.reference || undefined,
    cheque_no: p.mode === 'cheque' ? p.cheque_no || undefined : undefined,
    cheque_date: p.mode === 'cheque' ? p.cheque_date || undefined : undefined,
    bank_name: p.mode === 'cheque' ? p.bank_name || undefined : undefined,
  }
}

type Props = {
  value: PaymentRow[]
  onChange: (rows: PaymentRow[]) => void
  modes: PaymentMode[]
  errors?: FieldErrors<PaymentRow>[] | undefined
  disabled?: boolean
  /** Exactly one payment (receipts): no add or remove. */
  single?: boolean
}

/** One or more payments by mode (FR-BL-07). Cheque fields appear only for cheques. */
export function PaymentSplitEditor({ value, onChange, modes, errors, disabled, single }: Props) {
  const set = (i: number, patch: Partial<PaymentRow>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="grid gap-2">
      {value.map((r, i) => {
        const e = errors?.[i]
        return (
          <fieldset
            key={i}
            className="grid gap-2 rounded-md border bg-paper p-2"
            aria-label={`Payment ${i + 1}`}
          >
            <div className="flex items-start gap-2">
              <NativeSelect
                aria-label={`Payment ${i + 1} mode`}
                className="w-36"
                value={r.mode}
                disabled={disabled}
                aria-invalid={!!e?.mode}
                onChange={(ev) => set(i, { mode: ev.target.value as PaymentMode })}
              >
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
                {!modes.includes(r.mode) && <option value={r.mode}>{MODE_LABEL[r.mode]}</option>}
              </NativeSelect>
              <DecimalInput
                aria-label={`Payment ${i + 1} amount`}
                decimals={2}
                placeholder="0.00"
                value={r.amount}
                disabled={disabled}
                aria-invalid={!!e?.amount}
                onChange={(amount) => set(i, { amount })}
              />
              {!single && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove payment ${i + 1}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            {REF_LABEL[r.mode] && (
              <Input
                aria-label={`Payment ${i + 1} ${REF_LABEL[r.mode]}`}
                placeholder={REF_LABEL[r.mode]}
                value={r.reference}
                disabled={disabled}
                onChange={(ev) => set(i, { reference: ev.target.value })}
              />
            )}
            {r.mode === 'cheque' && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label={`Payment ${i + 1} cheque number`}
                  placeholder="Cheque no."
                  inputMode="numeric"
                  value={r.cheque_no}
                  disabled={disabled}
                  onChange={(ev) => set(i, { cheque_no: ev.target.value })}
                />
                <DateInput
                  aria-label={`Payment ${i + 1} cheque date`}
                  value={r.cheque_date}
                  disabled={disabled}
                  onChange={(cheque_date) => set(i, { cheque_date })}
                />
                <Input
                  aria-label={`Payment ${i + 1} bank`}
                  placeholder="Bank"
                  className="col-span-2"
                  value={r.bank_name}
                  disabled={disabled}
                  onChange={(ev) => set(i, { bank_name: ev.target.value })}
                />
              </div>
            )}
            {(e?.mode?.message || e?.amount?.message || e?.cheque_no?.message) && (
              <p className="text-sm text-danger">
                {e?.mode?.message ?? e?.amount?.message ?? e?.cheque_no?.message}
              </p>
            )}
          </fieldset>
        )
      })}
      {!single && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange([...value, emptyPayment(modes[0]!)])}
          >
            <Plus className="size-4" /> Add payment
          </Button>
        </div>
      )}
    </div>
  )
}
