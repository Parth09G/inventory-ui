import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { calculateBill } from '../api'
import { toCalcInput, type BillFormValues } from '../bill-form'

/**
 * Live totals from POST /bills/calculate (D-09): debounced 300 ms, stale requests
 * aborted, previous totals kept while a new one runs. `current` says whether the
 * shown totals match the form, which is when Save may send expected_total.
 */
export function useBillCalculation(values: BillFormValues) {
  const input = toCalcInput(values)
  // The line map travels with the request, so warnings land on the rows that were sent.
  const json = input ? JSON.stringify(input) : ''
  const debounced = useDebouncedValue(json, 300)
  const q = useQuery({
    queryKey: ['bills', 'calculate', debounced],
    queryFn: async ({ signal }) => {
      const sent = JSON.parse(debounced) as NonNullable<ReturnType<typeof toCalcInput>>
      return {
        json: debounced,
        lineIndex: sent.lineIndex,
        result: await calculateBill(sent.body, signal),
      }
    },
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  })
  const data = json && q.data ? q.data : undefined
  return {
    result: data?.result,
    /** Form row of each line in `result` (result line n ↔ form row lineIndex[n]). */
    lineIndex: data?.lineIndex ?? [],
    current: !!data && data.json === json && !q.isFetching && !q.isError,
    updating: !!json && (json !== debounced || q.isFetching),
    error: json && json === debounced && !q.isFetching ? q.error : null,
  }
}
