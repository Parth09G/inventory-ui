import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, type LinkProps } from '@tanstack/react-router'
import { Pagination } from '@/components/shared/Pagination'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge, type Tone } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, call } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMarkAllRead, useMarkRead } from './api'

type Notification = components['schemas']['Notification']
const route = getRouteApi('/_app/notifications')

const KIND: Record<Notification['kind'], [string, Tone]> = {
  stock_short: ['Bill blocked: stock', 'danger'],
  low_stock: ['Low stock', 'warning'],
  return_pending: ['Return to approve', 'warning'],
  einv_failed: ['E-invoice failed', 'danger'],
  backup_failed: ['Backup failed', 'danger'],
  other: ['Notice', 'neutral'],
}

/** Where a notification leads (FR-NT-01). */
function target(n: Notification): LinkProps | null {
  if (n.ref_id && n.ref_type === 'bill') return { to: '/bills/$id', params: { id: n.ref_id } }
  if (n.ref_id && (n.ref_type === 'credit_note' || n.ref_type === 'return'))
    return { to: '/returns/$id', params: { id: n.ref_id } }
  if (n.ref_id && n.ref_type === 'payment') return { to: '/payments/$id', params: { id: n.ref_id } }
  if (n.ref_id && n.ref_type === 'purchase')
    return { to: '/purchases/$id', params: { id: n.ref_id } }
  if (n.item_id) return { to: '/items/$id', params: { id: n.item_id } }
  return null
}

/** All notifications (ui-plan #5). Shortage alerts are for the owner to act on; Admins see them read-only. */
export function NotificationsPage() {
  const { unread, page } = route.useSearch()
  const navigate = route.useNavigate()
  const list = useQuery({
    queryKey: ['notifications', 'list', { unread, page }],
    queryFn: () =>
      call(
        api.GET('/notifications', {
          params: { query: { unread_only: unread || undefined, page, page_size: 50 } },
        }),
      ),
  })
  const markAll = useMarkAllRead()
  const markOne = useMarkRead()
  return (
    <div className="grid max-w-3xl gap-3">
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="outline" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      />
      <Tabs
        value={unread ? 'unread' : 'all'}
        onValueChange={(t) =>
          void navigate({ search: { unread: t === 'unread' || undefined }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data?.data.length === 0 ? (
        <EmptyState>{unread ? 'No unread notifications.' : 'No notifications yet.'}</EmptyState>
      ) : (
        <ul aria-label="Notifications" className="grid divide-y rounded-lg border bg-surface">
          {list.data?.data.map((n) => {
            const [label, tone] = KIND[n.kind]
            const to = target(n)
            return (
              <li
                key={n.id}
                className={cn('grid gap-1 px-4 py-3', !n.is_read && 'bg-steel-tint/40')}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Badge tone={tone}>{label}</Badge>
                    {!n.is_read && <span className="text-xs font-medium text-steel">Unread</span>}
                  </span>
                  <span className="text-xs text-ink-muted">{dateTime(n.created_at)}</span>
                </div>
                {to ? (
                  <Link
                    {...to}
                    onClick={() => !n.is_read && markOne.mutate(n.id)}
                    className="font-medium hover:underline"
                  >
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium">{n.title}</p>
                )}
                {n.body && <p className="text-sm text-ink-muted">{n.body}</p>}
                {!n.is_read && (
                  <button
                    type="button"
                    className="justify-self-start text-sm text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
                    onClick={() => markOne.mutate(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Pagination
        meta={list.data?.meta}
        onPage={(p) => void navigate({ search: (prev) => ({ ...prev, page: p }) })}
      />
    </div>
  )
}
