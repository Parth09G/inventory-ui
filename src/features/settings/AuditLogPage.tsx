import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { FilterBar, SearchInput } from '@/components/shared/FilterBar'
import { DateRange } from '@/components/shared/inputs/DateRange'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { api, call } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compact } from '@/lib/list'
import { dateTime } from '@/lib/format'

type Entry = components['schemas']['AuditEntry']
const route = getRouteApi('/_app/audit-log')

/** Fields whose value changed between before and after. */
function changedKeys(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  return [...keys].filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
}

/** Append-only audit log (FR-AL-01, ui-plan #41). */
export function AuditLogPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true })
  const log = useQuery({
    queryKey: ['audit', search],
    queryFn: () =>
      call(api.GET('/audit-log', { params: { query: compact({ ...search, page_size: 50 }) } })),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="grid gap-3">
      <PageHeader
        title="Audit log"
        meta="Sign-ins, creates, edits (before and after), cancellations, approvals, exports and settings changes."
      />
      <FilterBar
        active={!!(search.entity || search.action || search.from || search.to)}
        onClear={() =>
          set({ entity: undefined, action: undefined, from: undefined, to: undefined })
        }
      >
        <SearchInput
          value={search.entity}
          onChange={(entity) => set({ entity })}
          placeholder="bill, item, party…"
          label="Entity"
        />
        <SearchInput
          value={search.action}
          onChange={(action) => set({ action })}
          placeholder="create, edit, cancel…"
          label="Action"
        />
        <DateRange from={search.from} to={search.to} onChange={(r) => set(r)} />
      </FilterBar>
      {log.error ? (
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      ) : log.data?.data.length === 0 ? (
        <EmptyState>No entries match.</EmptyState>
      ) : (
        <ul aria-label="Audit entries" className="grid divide-y rounded-lg border bg-surface">
          {log.data?.data.map((e: Entry) => {
            const before = e.before as Record<string, unknown> | null | undefined
            const after = e.after as Record<string, unknown> | null | undefined
            const changed = changedKeys(before, after)
            return (
              <li key={e.id} className="px-4 py-2.5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-medium">{e.user_name ?? 'System'}</span>
                    <span>{e.action}</span>
                    <span className="code text-ink-muted">
                      {e.entity}
                      {e.entity_id ? ` #${e.entity_id}` : ''}
                    </span>
                    <span className="ml-auto text-sm text-ink-muted tabular">
                      {dateTime(e.created_at)}
                    </span>
                  </summary>
                  <div className="mt-2 grid gap-1 text-sm">
                    {changed.length === 0 ? (
                      <p className="text-ink-muted">No field changes recorded.</p>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
                            <th className="pb-1 font-medium">Field</th>
                            <th className="pb-1 font-medium">Before</th>
                            <th className="pb-1 font-medium">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changed.map((k) => (
                            <tr key={k} className="border-t align-top">
                              <td className="py-1 pr-3 code">{k}</td>
                              <td className="py-1 pr-3 break-all text-danger">
                                {before?.[k] === undefined ? '—' : JSON.stringify(before[k])}
                              </td>
                              <td className="py-1 break-all text-success">
                                {after?.[k] === undefined ? '—' : JSON.stringify(after[k])}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {e.ip_address && <p className="text-xs text-ink-muted">From {e.ip_address}</p>}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
      <Pagination
        meta={log.data?.meta}
        onPage={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
      />
    </div>
  )
}
