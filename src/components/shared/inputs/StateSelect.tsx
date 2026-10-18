import { useQuery } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import { statesQuery } from '@/lib/api/reference'
import { NativeSelect } from './NativeSelect'

/** GST states (GET /lookups/states), shown as "29 · Karnataka". */
export function StateSelect(props: ComponentProps<'select'>) {
  const states = useQuery(statesQuery())
  return (
    <NativeSelect {...props}>
      <option value="">Choose a state</option>
      {states.data?.map((s) => (
        <option key={s.code} value={s.code}>
          {s.code} · {s.name}
        </option>
      ))}
    </NativeSelect>
  )
}
