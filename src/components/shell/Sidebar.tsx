import { Link } from '@tanstack/react-router'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hasPermission, useMe } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { NAV } from './nav'

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const me = useMe()
  return (
    <nav
      aria-label="Main"
      className={cn(
        'sticky top-0 flex h-dvh flex-col border-r bg-surface transition-[width] duration-150',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div className="flex h-12 items-center border-b px-4">
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-wide uppercase">Billing</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => !i.perm || hasPermission(me, i.perm))
          if (!items.length) return null
          return (
            <div key={gi} className="mb-3">
              {group.label && !collapsed && (
                <p className="px-4 pt-2 pb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">
                  {group.label}
                </p>
              )}
              <ul>
                {items.map((item) => {
                  const link = (
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.to === '/' }}
                      className={cn(
                        'relative mx-2 flex h-8 items-center gap-2.5 rounded-md px-2 text-ink-muted hover:bg-surface-sunken hover:text-ink',
                        'data-[status=active]:bg-surface-sunken data-[status=active]:font-medium data-[status=active]:text-ink',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <item.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                      {collapsed ? (
                        <span className="sr-only">{item.label}</span>
                      ) : (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  )
                  return (
                    <li key={String(item.to)}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-10 items-center gap-2 border-t px-4 text-sm text-ink-muted hover:text-ink"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        {!collapsed && 'Collapse'}
      </button>
    </nav>
  )
}
