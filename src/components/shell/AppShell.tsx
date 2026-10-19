import { Outlet, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useIsPhone } from '@/hooks/useMediaQuery'
import { useShortcut } from '@/hooks/useShortcut'
import { useCan } from '@/lib/permissions'
import { BottomNav } from './BottomNav'
import { CommandPalette } from './CommandPalette'
import { OfflineBanner } from './OfflineBanner'
import { ShortcutsHelp } from './ShortcutsHelp'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { UpdatePrompt } from './UpdatePrompt'

const COLLAPSE_KEY = 'ui.sidebar.collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** Desktop: sidebar + top bar. Below 1024 px: top bar + bottom nav (D-31). */
export function AppShell() {
  const phone = useIsPhone()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useShortcut('ctrl+k', () => setPaletteOpen((o) => !o), { allowInInputs: true })
  useShortcut('?', () => setHelpOpen(true))
  const navigate = useNavigate()
  const canBill = useCan('bill.create')
  useShortcut('alt+n', () => void navigate({ to: '/bills/new', search: { type: 'cash' } }), {
    allowInInputs: true,
    enabled: canBill,
  })
  useShortcut('alt+a', () => void navigate({ to: '/bills/new', search: { type: 'account' } }), {
    allowInInputs: true,
    enabled: canBill,
  })
  const canPurchase = useCan('purchase.create')
  useShortcut('alt+p', () => void navigate({ to: '/purchases/new' }), {
    allowInInputs: true,
    enabled: canPurchase,
  })
  const canPay = useCan('payment.create')
  useShortcut(
    'alt+r',
    () => void navigate({ to: '/payments/new', search: { direction: 'received' } }),
    {
      allowInInputs: true,
      enabled: canPay,
    },
  )

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* per-viewer convenience only */
      }
      return !c
    })
  }

  return (
    <div className="flex min-h-dvh">
      {!phone && (
        <div className="print:hidden">
          <Sidebar collapsed={collapsed} onToggle={toggle} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <TopBar
          phone={phone}
          onSearch={() => setPaletteOpen(true)}
          onShowShortcuts={() => setHelpOpen(true)}
        />
        <main
          id="main"
          className={phone ? 'flex-1 px-4 pt-4 pb-24 print:p-0' : 'flex-1 px-6 py-5 print:p-0'}
        >
          <Outlet />
        </main>
      </div>
      {phone && (
        <div className="print:hidden">
          <BottomNav />
        </div>
      )}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <UpdatePrompt />
    </div>
  )
}
