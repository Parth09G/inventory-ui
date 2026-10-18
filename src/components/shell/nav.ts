import type { LinkProps } from '@tanstack/react-router'
import { FolderTree, LayoutDashboard, Ruler, type LucideIcon } from 'lucide-react'

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
      { to: '/catalogue/categories', label: 'Categories', icon: FolderTree },
      { to: '/catalogue/units', label: 'Units', icon: Ruler },
    ],
  },
]
