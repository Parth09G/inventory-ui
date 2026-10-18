// Display formatting for decimal strings from the API (D-07). Values are never
// added or multiplied here; Intl formats the decimal string exactly.

type Dec = string | null | undefined

const TZ = 'Asia/Kolkata'

function fmt(value: string, min: number, max: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(value as Intl.StringNumericLiteral)
}

/** ₹ amounts: 1,00,000.00. The ₹ sign is opt-in; tables put it in the header. */
export function money(value: Dec, opts: { symbol?: boolean } = {}): string {
  if (value == null || value === '') return ''
  const s = fmt(value, 2, 2)
  return opts.symbol ? (s.startsWith('-') ? `−₹ ${s.slice(1)}` : `₹ ${s}`) : s.replace('-', '−')
}

/** Quantities: up to `decimals` places (unit decimals), trailing zeros trimmed. */
export function qty(value: Dec, decimals = 3): string {
  if (value == null || value === '') return ''
  return fmt(value, 0, decimals).replace('-', '−')
}

/** Rates and costs: 2 to 4 places. */
export function rate(value: Dec): string {
  if (value == null || value === '') return ''
  return fmt(value, 2, 4)
}

export function percent(value: Dec): string {
  if (value == null || value === '') return ''
  return `${fmt(value, 0, 2)}%`
}

export function isNegative(value: Dec): boolean {
  return !!value && value.trim().startsWith('-') && !isZero(value)
}

export function isZero(value: Dec): boolean {
  return !value || /^-?0*(\.0*)?$/.test(value.trim())
}

/** Ledger balance: debit (> 0) = party owes the shop → "Dr"; credit → "Cr". */
export function balance(value: Dec): { text: string; side: 'Dr' | 'Cr' | '' } {
  if (value == null || value === '' || isZero(value)) return { text: money('0'), side: '' }
  const neg = isNegative(value)
  return { text: money(neg ? value.trim().slice(1) : value), side: neg ? 'Cr' : 'Dr' }
}

/** Business date "2026-10-18" → "18-10-2026". Never goes through Date (D-20). */
export function date(value: Dec): string {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-18" → "18 Oct" for dense lists. */
export function shortDate(value: Dec): string {
  if (!value) return ''
  const [, m, d] = value.slice(0, 10).split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}

/** RFC 3339 timestamp → "18-10-2026, 3:05 pm" in IST. */
export function dateTime(value: Dec): string {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(value))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}-${get('month')}-${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`
}

/** Today's business date in IST as YYYY-MM-DD. */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

/** "1000.0000" → "1000", "62.5000" → "62.5": API decimals shown in inputs without padding. */
export function trimZeros(value: Dec): string {
  if (!value) return ''
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

// Input formats; values stay strings (D-07).
export const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/
export const QTY_RE = /^\d{1,11}(\.\d{1,3})?$/
export const RATE_RE = /^\d{1,10}(\.\d{1,4})?$/
export const PERCENT_RE = /^\d{1,3}(\.\d{1,2})?$/
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
