import { Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

type Props = { phone: boolean; onSearch: () => void; onShowShortcuts: () => void }

export function TopBar({ phone, onSearch, onShowShortcuts }: Props) {
  const canBill = useCan('bill.create')
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-surface px-2 sm:px-4">
      {phone && <span className="px-2 text-sm font-semibold tracking-wide uppercase">Billing</span>}
      {phone ? (
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={onSearch}
          aria-label="Search"
        >
          <Search className="size-4" strokeWidth={1.75} />
        </Button>
      ) : (
        <button
          type="button"
          onClick={onSearch}
          className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-rule bg-paper px-2.5 text-ink-faint hover:border-rule-strong"
        >
          <Search className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="flex-1 text-left">Search items, parties, bills…</span>
          <kbd className="rounded-sm border bg-surface px-1 code text-xs text-ink-muted">
            Ctrl K
          </kbd>
        </button>
      )}
      <div className={phone ? 'flex items-center' : 'ml-auto flex items-center gap-1'}>
        {canBill && !phone && (
          <Button asChild size="sm" className="mr-2">
            <Link to="/bills/new" search={{ type: 'cash' }} title="New Cash bill (Alt+N)">
              <Plus className="size-4" /> New bill
            </Link>
          </Button>
        )}
        <NotificationBell />
        <UserMenu onShowShortcuts={onShowShortcuts} />
      </div>
    </header>
  )
}
