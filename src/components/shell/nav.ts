import type { LinkProps } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  Boxes,
  FolderTree,
  IndianRupee,
  LayoutDashboard,
  ReceiptText,
  Ruler,
  SlidersHorizontal,
  Truck,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react'

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
    label: 'Sell',
    items: [
      { to: '/bills', label: 'Bills', icon: ReceiptText, phone: true },
      { to: '/payments', label: 'Payments', icon: IndianRupee },
      { to: '/returns', label: 'Returns', icon: Undo2 },
    ],
  },
  {
    label: 'Stock',
    items: [
      { to: '/inventory', label: 'Inventory', icon: Boxes, phone: true },
      { to: '/purchases', label: 'Purchases', icon: Truck },
      { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
      { to: '/adjustments', label: 'Adjustments', icon: SlidersHorizontal },
      { to: '/catalogue/categories', label: 'Categories', icon: FolderTree },
      { to: '/catalogue/units', label: 'Units', icon: Ruler },
    ],
  },
  { label: 'Parties', items: [{ to: '/parties', label: 'Parties', icon: Users }] },
]
