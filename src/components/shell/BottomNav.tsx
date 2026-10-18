import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { hasPermission, useMe } from '@/lib/permissions'
import { NAV } from './nav'

const itemClass =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-ink-muted data-[status=active]:text-ink data-[status=active]:font-medium'

/** Phone navigation: key destinations + "More" sheet with everything else (ui-plan §3.2). */
export function BottomNav() {
  const me = useMe()
  const [open, setOpen] = useState(false)
  const visible = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.perm || hasPermission(me, i.perm)),
  }))
  const primary = visible.flatMap((g) => g.items).filter((i) => i.phone)
  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        {primary.map((item) => (
          <Link
            key={String(item.to)}
            to={item.to}
            activeOptions={{ exact: item.to === '/' }}
            className={itemClass}
          >
            <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
            {item.label}
          </Link>
        ))}
        <button type="button" className={itemClass} onClick={() => setOpen(true)}>
          <Menu className="size-5" strokeWidth={1.75} aria-hidden />
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>All pages</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 px-4 pb-6">
            {visible.map((g, gi) =>
              g.items.length ? (
                <div key={gi}>
                  {g.label && (
                    <p className="mb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">
                      {g.label}
                    </p>
                  )}
                  <ul className="grid grid-cols-2 gap-1">
                    {g.items.map((item) => (
                      <li key={String(item.to)}>
                        <Link
                          to={item.to}
                          onClick={() => setOpen(false)}
                          className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-surface-sunken"
                        >
                          <item.icon className="size-4" strokeWidth={1.75} aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
