import { queryOptions } from '@tanstack/react-query'
import { api, call } from './client'

// Reference data changes rarely; cache for 10 minutes (ui-plan §1.2).
const REF = 10 * 60_000

export const locationsQuery = () =>
  queryOptions({
    queryKey: ['locations'],
    queryFn: () => call(api.GET('/locations')),
    staleTime: REF,
  })

export const unitsQuery = () =>
  queryOptions({ queryKey: ['units'], queryFn: () => call(api.GET('/units')), staleTime: REF })

export const statesQuery = () =>
  queryOptions({
    queryKey: ['states'],
    queryFn: () => call(api.GET('/lookups/states')),
    staleTime: Infinity,
  })

export const settingsQuery = () =>
  queryOptions({
    queryKey: ['settings'],
    queryFn: () => call(api.GET('/settings')),
    staleTime: REF,
  })
