/**
 * Parses what people type for a date into ISO "YYYY-MM-DD" (D-20).
 * Accepts DD-MM-YYYY, DD/MM/YY, D.M.YYYY and DDMMYYYY. Two-digit years are 20xx.
 * Returns null for anything that is not a real calendar date.
 */
export function parseDateInput(text: string): string | null {
  const s = text.trim()
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
  if (!m) {
    const digits = s.match(/^(\d{2})(\d{2})(\d{4}|\d{2})$/)
    if (!digits) return null
    m = digits
  }
  const day = Number(m[1])
  const month = Number(m[2])
  const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** "2026-10-18" → "18-10-2026" for the input box. */
export function formatDateInput(iso: string | undefined | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}
