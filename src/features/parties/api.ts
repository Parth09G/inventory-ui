import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'

type S = components['schemas']
export type Party = S['Party']
export type PartyInput = S['PartyInput']
export type LedgerEntry = S['LedgerEntry']
export type PartiesParams = NonNullable<operations['listParties']['parameters']['query']>

export const partiesQuery = (params: PartiesParams) =>
  queryOptions({
    queryKey: ['parties', 'list', params],
    queryFn: () =>
      call(
        api.GET('/parties', { params: { query: compact({ page_size: PAGE_SIZE, ...params }) } }),
      ),
    placeholderData: keepPreviousData,
  })

export const partyQuery = (id: number) =>
  queryOptions({
    queryKey: ['parties', id],
    queryFn: () => call(api.GET('/parties/{id}', { params: { path: { id } } })),
  })

export const ledgerQuery = (id: number, range: { from?: string; to?: string }) =>
  queryOptions({
    queryKey: ['parties', id, 'ledger', range],
    queryFn: () =>
      call(api.GET('/parties/{id}/ledger', { params: { path: { id }, query: compact(range) } })),
    placeholderData: keepPreviousData,
  })

export function useSaveParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: PartyInput }) =>
      id
        ? call(api.PATCH('/parties/{id}', { params: { path: { id } }, body }))
        : call(api.POST('/parties', { body })),
    onSuccess: (party) => {
      qc.setQueryData(partyQuery(party.id).queryKey, party)
      void qc.invalidateQueries({ queryKey: ['parties'] })
    },
  })
}

export function useDeactivateParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      call(api.POST('/parties/{id}/deactivate', { params: { path: { id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }),
  })
}

export function useStatement() {
  return useMutation({
    mutationFn: ({ id, from, to }: { id: number; from?: string; to?: string }) =>
      call(
        api.GET('/parties/{id}/statement', {
          params: { path: { id }, query: compact({ from, to }) },
        }),
      ),
  })
}

export const KIND_LABEL: Record<Party['kind'], string> = {
  customer: 'Customer',
  supplier: 'Dealer',
  both: 'Customer and dealer',
}
