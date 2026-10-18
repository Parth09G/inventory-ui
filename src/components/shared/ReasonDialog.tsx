import { useState, type ReactNode } from 'react'
import { Field } from './Field'
import { ConfirmDialog } from './ConfirmDialog'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  effect: ReactNode
  confirmLabel: string
  onConfirm: (reason: string) => void
  pending?: boolean
  error?: string | null
  danger?: boolean
}

/** Confirm with a required reason, for actions the audit log records (design P10). */
export function ReasonDialog(p: Props) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const short = reason.trim().length < 3
  return (
    <ConfirmDialog
      {...p}
      onOpenChange={(o) => {
        if (!o) {
          setReason('')
          setTouched(false)
        }
        p.onOpenChange(o)
      }}
      onConfirm={() => {
        setTouched(true)
        if (!short) p.onConfirm(reason.trim())
      }}
    >
      <Field
        label="Reason"
        error={touched && short ? 'Give a reason (at least 3 characters)' : undefined}
        hint="Recorded in the audit log."
      >
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
    </ConfirmDialog>
  )
}
