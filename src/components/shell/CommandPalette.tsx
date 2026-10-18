import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api, call } from '@/lib/api/client'
import { money, qty } from '@/lib/format'
import { hasPermission, useMe } from '@/lib/permissions'
import { NAV } from './nav'

/** Ctrl+K: global search (GET /search) plus page commands (ui-plan §3.2). */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const navigate = useNavigate()
  const me = useMe()
  const [q, setQ] = useState('')
  const term = useDebouncedValue(q.trim(), 200)
  const search = useQuery({
    queryKey: ['search', term],
    queryFn: () => call(api.GET('/search', { params: { query: { q: term } } })),
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  })
  const pages = NAV.flatMap((g) => g.items).filter((i) => !i.perm || hasPermission(me, i.perm))
  const go = (fn: () => void) => {
    onOpenChange(false)
    setQ('')
    fn()
  }
  const r = search.data
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search items, parties and bills"
    >
      {/* Server-side search: cmdk must not filter the results again. */}
      <CommandInput
        placeholder="Search items, parties, bills, or go to a page…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>
          {term.length >= 2 && search.isFetching ? 'Searching…' : 'No matches.'}
        </CommandEmpty>
        {!!r?.items?.length && (
          <CommandGroup heading="Items">
            {r.items.map((i) => (
              <CommandItem
                key={`i${i.id}`}
                value={`item-${i.id}-${i.name}`}
                onSelect={() => go(() => {})}
              >
                <span className="flex-1 truncate">{i.name}</span>
                <span className="text-sm text-ink-muted tabular">
                  {qty(i.stock_total)} in stock
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!!r?.parties?.length && (
          <CommandGroup heading="Parties">
            {r.parties.map((p) => (
              <CommandItem
                key={`p${p.id}`}
                value={`party-${p.id}-${p.name}`}
                onSelect={() => go(() => {})}
              >
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-sm text-ink-muted tabular">{p.mobile}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!!r?.bills?.length && (
          <CommandGroup heading="Bills">
            {r.bills.map((b) => (
              <CommandItem
                key={`b${b.id}`}
                value={`bill-${b.id}-${b.bill_no}`}
                onSelect={() => go(() => {})}
              >
                <span className="code">{b.bill_no}</span>
                <span className="flex-1 truncate text-ink-muted">{b.customer_name}</span>
                <span className="tabular">{money(b.grand_total)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Go to">
          {pages.map((p) => (
            <CommandItem
              key={String(p.to)}
              value={`page-${p.label}`}
              onSelect={() => go(() => void navigate({ to: p.to }))}
            >
              <p.icon className="size-4" strokeWidth={1.75} />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
