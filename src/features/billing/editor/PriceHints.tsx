import { useQuery } from '@tanstack/react-query'
import { money, rate, shortDate } from '@/lib/format'
import { priceHintsQuery } from '../api'

/** Rate hints under the rate cell; there is no master selling price (BR-05, FR-BL-02). */
export function PriceHints({
  itemId,
  unitId,
  partyId,
  partyName,
}: {
  itemId: number
  unitId?: number
  partyId?: number
  partyName?: string
}) {
  const { data } = useQuery(priceHintsQuery(itemId, unitId, partyId))
  if (!data) return null
  const per = data.unit ? ` / ${data.unit}` : ''
  const parts: string[] = []
  if (data.last_rate_to_customer)
    parts.push(
      `Last to ${partyName ?? 'customer'}: ₹ ${money(data.last_rate_to_customer.rate)}${per} (${shortDate(data.last_rate_to_customer.date)})`,
    )
  if (data.last_purchase_rate) parts.push(`Purchase ₹ ${rate(data.last_purchase_rate)}${per}`)
  parts.push(`Avg cost ₹ ${rate(data.avg_cost)}${per}`)
  return <span data-testid="price-hints">{parts.join(' · ')}</span>
}
