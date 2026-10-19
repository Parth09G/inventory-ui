/** First day of the Indian financial year (1 April) containing `today` (YYYY-MM-DD). */
export function fyStart(today: string): string {
  const [y, m] = today.split('-').map(Number) as [number, number]
  return `${m >= 4 ? y : y - 1}-04-01`
}

export function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`
}
