import { createFileRoute } from '@tanstack/react-router'
import { requirePerm } from '@/app/auth'
import { StockCountPage } from '@/features/stock/StockCountPage'

export const Route = createFileRoute('/_app/stock-counts/new')({
  beforeLoad: ({ context }) => requirePerm(context, 'stock.count'),
  component: StockCountPage,
})
