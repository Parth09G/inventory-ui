import type { ComponentProps } from 'react'
import type { components } from '@/lib/api/schema'
import { NativeSelect } from './NativeSelect'

export type GstRate = components['schemas']['GstRate']
export const GST_RATES: GstRate[] = ['0', '0.25', '3', '5', '12', '18', '28', '40']

export function GstRateSelect({
  placeholder,
  ...props
}: ComponentProps<'select'> & { placeholder?: string }) {
  return (
    <NativeSelect {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {GST_RATES.map((r) => (
        <option key={r} value={r}>
          {r}%
        </option>
      ))}
    </NativeSelect>
  )
}
