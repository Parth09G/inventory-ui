import { z } from 'zod'

export const PAGE_SIZE = 50

/** Search params shared by every register: filters live in the URL (D-04, design P7). */
export const listSearch = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
})

/** Drops empty values so the URL stays clean and the API gets no blank filters. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ) as Partial<T>
}
