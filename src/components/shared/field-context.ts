import { createContext, useContext } from 'react'

type FieldContextValue = { id: string; describedBy?: string; invalid?: boolean }

/**
 * Set by <Field> so the input inside it gets the label's id and the hint/error
 * description, even when it is wrapped (react-hook-form Controller, pickers).
 */
export const FieldContext = createContext<FieldContextValue | null>(null)

type ControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling'
}

/** Fills id / aria-describedby / aria-invalid from the surrounding Field, unless set explicitly. */
export function useFieldControl<P extends ControlProps>(props: P): P {
  const field = useContext(FieldContext)
  if (!field) return props
  return {
    ...props,
    id: props.id ?? field.id,
    'aria-describedby': props['aria-describedby'] ?? field.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
  }
}
