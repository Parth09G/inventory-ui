import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { components } from './schema'

type Problem = components['schemas']['Problem']
export type ProblemCode = Problem['code'] | 'NETWORK'
export type FieldError = { field?: string; message?: string }

/** A failed API call: RFC 9457 problem details, or a network failure (D-21). */
export class ApiProblem extends Error {
  readonly status: number
  readonly code: ProblemCode
  readonly errors: FieldError[]
  readonly requestId?: string
  /** The full problem body, for code-specific fields such as `short_lines`. */
  readonly body: Record<string, unknown>

  constructor(
    status: number,
    body: Partial<Problem> & Record<string, unknown>,
    requestId?: string,
  ) {
    super(body.detail ?? body.title ?? `Request failed (${status})`)
    this.name = 'ApiProblem'
    this.status = status
    this.code = (body.code as ProblemCode | undefined) ?? (status === 0 ? 'NETWORK' : 'INTERNAL')
    this.errors = body.errors ?? []
    this.requestId = body.request_id ?? requestId
    this.body = body
  }

  is(code: ProblemCode): boolean {
    return this.code === code
  }
}

export function isProblem(err: unknown, code?: ProblemCode): err is ApiProblem {
  return err instanceof ApiProblem && (code === undefined || err.code === code)
}

/** "lines[1].rate" → "lines.1.rate" (react-hook-form path). */
export function toFormPath(field: string): string {
  return field.replace(/\[(\d+)\]/g, '.$1')
}

/**
 * Puts server field errors on the matching form fields and focuses the first one.
 * Returns the errors no field matched, for a summary message.
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  errors: FieldError[],
  knownFields?: (path: string) => boolean,
): FieldError[] {
  const unmatched: FieldError[] = []
  let first = true
  for (const e of errors) {
    if (!e.field) {
      unmatched.push(e)
      continue
    }
    const path = toFormPath(e.field)
    if (knownFields && !knownFields(path)) {
      unmatched.push(e)
      continue
    }
    setError(
      path as Path<T>,
      { type: 'server', message: e.message ?? 'Invalid' },
      { shouldFocus: first },
    )
    first = false
  }
  return unmatched
}

/** One-line message for toasts and error states. */
export function problemMessage(err: unknown): string {
  if (!(err instanceof ApiProblem)) return 'Something unexpected happened.'
  switch (err.code) {
    case 'NETWORK':
      return 'Could not reach the server. Check the internet connection.'
    case 'RATE_LIMITED':
      return 'Too many requests – try again in a moment.'
    case 'FORBIDDEN':
      return 'You do not have permission to do this.'
    case 'NOT_FOUND':
      return 'This record does not exist.'
    case 'INTERNAL':
      return 'The server had a problem.'
    default:
      return err.message
  }
}
