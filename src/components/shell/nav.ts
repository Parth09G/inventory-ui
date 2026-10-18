import type { LinkProps } from '@tanstack/react-router'
import { Boxes, FolderTree, LayoutDashboard, Ruler, Users, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: LinkProps['to']
  label: string
  icon: LucideIcon
  /** Permission key needed to see the item (D-10). */
  perm?: string
  /** Shown in the phone bottom bar. */
  phone?: boolean
}
export type NavGroup = { label: string | null; items: NavItem[] }

// Items are added as each feature's routes land (tasks.md).
export const NAV: NavGroup[] = [
  { label: null, items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, phone: true }] },
  {
    label: 'Stock',
    items: [
      { to: '/inventory', label: 'Inventory', icon: Boxes, phone: true },
      { to: '/catalogue/categories', label: 'Categories', icon: FolderTree },
      { to: '/catalogue/units', label: 'Units', icon: Ruler },
    ],
  },
  { label: 'Parties', items: [{ to: '/parties', label: 'Parties', icon: Users }] },
]
