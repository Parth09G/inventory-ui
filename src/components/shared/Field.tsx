import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FieldContext } from './field-context'

type Props = {
  label: ReactNode
  error?: string
  hint?: ReactNode
  className?: string
  /** One input; it is labelled through FieldContext, however deeply it is wrapped. */
  children: ReactNode
}

/** Label + input + hint/error, wired for accessibility (design P11). */
export function Field({ label, error, hint, className, children }: Props) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className={cn('grid content-start gap-1', className)}>
      <Label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </Label>
      <FieldContext.Provider
        value={{ id, describedBy: error || hint ? descId : undefined, invalid: !!error }}
      >
        {children}
      </FieldContext.Provider>
      {error ? (
        <p id={descId} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
