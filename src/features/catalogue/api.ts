import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

type S = components['schemas']
export type Unit = S['Unit']
export type UnitInput = S['UnitInput']
export type Category = S['Category']
export type CategoryInput = S['CategoryInput']
export type CategoryAttribute = S['CategoryAttribute']
export type CategoryAttributeInput = S['CategoryAttributeInput']

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ['categories'],
    queryFn: () => call(api.GET('/categories')),
    staleTime: 10 * 60_000,
  })

export const categoryQuery = (id: number) =>
  queryOptions({
    queryKey: ['categories', id],
    queryFn: () => call(api.GET('/categories/{id}', { params: { path: { id } } })),
  })

export function useSaveUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: UnitInput }) =>
      id
        ? call(api.PATCH('/units/{id}', { params: { path: { id } }, body }))
        : call(api.POST('/units', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: CategoryInput }) =>
      id
        ? call(api.PATCH('/categories/{id}', { params: { path: { id } }, body }))
        : call(api.POST('/categories', { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['units'] })
    },
  })
}

export function useDeactivateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      call(api.POST('/categories/{id}/deactivate', { params: { path: { id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useSaveAttribute(categoryId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ attrId, body }: { attrId?: number; body: CategoryAttributeInput }) =>
      attrId
        ? call(
            api.PATCH('/categories/{id}/attributes/{attrId}', {
              params: { path: { id: categoryId, attrId } },
              body,
            }),
          )
        : call(
            api.POST('/categories/{id}/attributes', { params: { path: { id: categoryId } }, body }),
          ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteAttribute(categoryId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attrId: number) =>
      call(
        api.DELETE('/categories/{id}/attributes/{attrId}', {
          params: { path: { id: categoryId, attrId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
