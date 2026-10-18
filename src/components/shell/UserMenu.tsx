import { useNavigate } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDensity, type Density } from '@/hooks/useDensity'
import { signOut } from '@/lib/auth/session'
import { useMe } from '@/lib/permissions'

const ROLE = { super_admin: 'Super Admin', admin: 'Admin' } as const

export function UserMenu({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const me = useMe()
  const navigate = useNavigate()
  const [density, setDensity] = useDensity()
  if (!me) return null
  const initials = me.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-1.5" aria-label="Account menu">
          <span className="grid size-6 place-items-center rounded-full bg-ink text-[11px] font-medium text-white">
            {initials}
          </span>
          <span className="hidden max-w-32 truncate lg:inline">{me.full_name}</span>
          <ChevronDown className="size-3.5 text-ink-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="grid font-normal">
          <span className="font-medium">{me.full_name}</span>
          <span className="text-sm text-ink-muted">
            {ROLE[me.role]} · {me.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-ink-muted">
          Table density
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density} onValueChange={(v) => setDensity(v as Density)}>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onShowShortcuts}>Keyboard shortcuts</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut()
            await navigate({ to: '/login' })
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
