import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { applyFieldErrors, isProblem, problemMessage } from './problem'

/**
 * Routes a failed save into the form (design P6): field errors onto their inputs,
 * DUPLICATE onto `duplicateField`, everything else returned as a form-level message.
 */
export function formError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  opts: { duplicateField?: Path<T>; duplicateMessage?: string } = {},
): string | null {
  if (isProblem(err, 'VALIDATION_FAILED')) {
    const rest = applyFieldErrors(setError, err.errors)
    return rest.length ? rest.map((e) => e.message).join(' ') : null
  }
  if (isProblem(err, 'DUPLICATE') && opts.duplicateField) {
    setError(
      opts.duplicateField,
      { type: 'server', message: opts.duplicateMessage ?? err.message },
      { shouldFocus: true },
    )
    return null
  }
  return problemMessage(err)
}
