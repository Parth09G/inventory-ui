import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { unreadNotificationsQuery, useMarkAllRead, useMarkRead } from '@/features/notifications/api'
import { dateTime } from '@/lib/format'

export function NotificationBell() {
  const { data } = useQuery(unreadNotificationsQuery())
  const markAll = useMarkAllRead()
  const markOne = useMarkRead()
  const count = data?.meta.total ?? 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications, ${count} unread`}
        >
          <Bell className="size-4" strokeWidth={1.75} />
          {count > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-4 rounded-sm bg-danger px-1 text-[11px] leading-4 font-medium text-white tabular">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <Link to="/notifications" className="font-medium hover:underline">
            Notifications
          </Link>
          {count > 0 && (
            <button
              type="button"
              className="text-sm text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              Mark all read
            </button>
          )}
        </div>
        {count === 0 ? (
          <p className="px-3 py-6 text-center text-ink-muted">No unread notifications.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {data?.data.map((n) => (
              <li key={n.id} className="grid gap-0.5 px-3 py-2">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-ink-muted">{n.body}</p>}
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>{dateTime(n.created_at)}</span>
                  <button
                    type="button"
                    className="text-steel underline decoration-steel/40 underline-offset-2 hover:decoration-steel"
                    onClick={() => markOne.mutate(n.id)}
                  >
                    Mark read
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
