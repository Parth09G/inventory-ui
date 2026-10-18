import { useId, type ReactElement, type ReactNode } from 'react'
import { cloneElement } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = {
  label: ReactNode
  error?: string
  hint?: ReactNode
  className?: string
  /** A single input element; it gets the id and aria attributes. */
  children: ReactElement<Record<string, unknown>>
}

/** Label + input + hint/error, wired for accessibility (design P11). */
export function Field({ label, error, hint, className, children }: Props) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className={cn('grid gap-1', className)}>
      <Label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? descId : undefined,
      })}
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
