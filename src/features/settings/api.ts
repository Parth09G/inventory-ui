import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { settingsQuery } from '@/lib/api/reference'

type S = components['schemas']
export type Settings = S['Settings']
export type TallyMapping = S['TallyMapping']
export type EInvoiceCredentials = S['EInvoiceCredentials']
export type Location = S['Location']
export type LocationInput = S['LocationInput']

export const tallyMappingQuery = () =>
  queryOptions({
    queryKey: ['settings', 'tally-mapping'],
    queryFn: () => call(api.GET('/settings/tally-mapping')),
  })

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Settings) => call(api.PUT('/settings', { body })),
    onSuccess: (s) => qc.setQueryData(settingsQuery().queryKey, s),
  })
}

export function useUploadLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) =>
      call(
        api.PUT('/settings/logo', {
          body: { file: file as unknown as string },
          bodySerializer: (b) => {
            const fd = new FormData()
            fd.append('file', b.file as unknown as File)
            return fd
          },
        }),
      ),
    onSuccess: (s) => qc.setQueryData(settingsQuery().queryKey, s),
  })
}

export function useSaveCredentials() {
  return useMutation({
    mutationFn: (body: EInvoiceCredentials) =>
      call(api.PUT('/settings/einvoice-credentials', { body })),
  })
}

export function useTestCredentials() {
  return useMutation({ mutationFn: () => call(api.POST('/settings/einvoice-credentials/test')) })
}

export function useSaveTallyMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TallyMapping) => call(api.PUT('/settings/tally-mapping', { body })),
    onSuccess: (m) => qc.setQueryData(tallyMappingQuery().queryKey, m),
  })
}

export function useSaveLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: LocationInput }) =>
      id
        ? call(api.PATCH('/locations/{id}', { params: { path: { id } }, body }))
        : call(api.POST('/locations', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })
}
