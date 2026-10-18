import { z } from 'zod'
import { GSTIN_RE, MONEY_RE, trimZeros } from '@/lib/format'
import type { Party, PartyInput } from './api'

export const partySchema = z
  .object({
    kind: z.enum(['customer', 'supplier', 'both']),
    name: z.string().trim().min(1, 'Enter a name'),
    // People type "98450 12345" or "+91-98450-12345"; store plain digits.
    mobile: z
      .string()
      .transform((s) => s.replace(/[\s-]/g, '').replace(/^(\+?91)(?=\d{10}$)/, ''))
      .pipe(z.string().regex(/^$|^\d{10}$/, 'Enter a 10-digit mobile number')),
    alt_phone: z.string().trim(),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(new RegExp(`^$|${GSTIN_RE.source}`), 'Enter a valid 15-character GSTIN'),
    state_code: z.string(),
    billing_address: z.string().trim(),
    pincode: z
      .string()
      .trim()
      .regex(/^$|^\d{6}$/, 'PIN codes have 6 digits'),
    credit_limit: z
      .string()
      .trim()
      .regex(new RegExp(`^$|${MONEY_RE.source}`), 'Enter an amount'),
    opening_amount: z
      .string()
      .trim()
      .regex(new RegExp(`^$|${MONEY_RE.source}`), 'Enter an amount'),
    /** dr: the party owes the shop; cr: the shop owes the party. */
    opening_side: z.enum(['dr', 'cr']),
    opening_date: z.string(),
    notes: z.string().trim(),
    sites: z.array(
      z.object({
        label: z.string().trim().min(1, 'Enter a site name'),
        address: z.string().trim().min(1, 'Enter the address'),
      }),
    ),
  })
  .refine((v) => !v.gstin || !v.state_code || v.gstin.slice(0, 2) === v.state_code, {
    path: ['state_code'],
    message: 'The state does not match the GSTIN (first two digits)',
  })
export type PartyValues = z.infer<typeof partySchema>

export function emptyParty(kind: Party['kind'] = 'customer'): PartyValues {
  return {
    kind,
    name: '',
    mobile: '',
    alt_phone: '',
    gstin: '',
    state_code: '',
    billing_address: '',
    pincode: '',
    credit_limit: '',
    opening_amount: '',
    opening_side: kind === 'supplier' ? 'cr' : 'dr',
    opening_date: '',
    notes: '',
    sites: [],
  }
}

export function fromParty(p: Party): PartyValues {
  const ob = p.opening_balance ?? '0'
  const neg = ob.startsWith('-')
  return {
    kind: p.kind,
    name: p.name,
    mobile: p.mobile ?? '',
    alt_phone: p.alt_phone ?? '',
    gstin: p.gstin ?? '',
    state_code: p.state_code ?? '',
    billing_address: p.billing_address ?? '',
    pincode: p.pincode ?? '',
    credit_limit: trimZeros(p.credit_limit),
    opening_amount: /^-?0*(\.0*)?$/.test(ob) ? '' : trimZeros(neg ? ob.slice(1) : ob),
    opening_side: neg ? 'cr' : 'dr',
    opening_date: '',
    notes: p.notes ?? '',
    sites: (p.sites ?? []).map((s) => ({ label: s.label ?? '', address: s.address ?? '' })),
  }
}

/** Opening balance is signed: debit (+) = receivable, credit (−) = payable. */
export function toPartyInput(v: PartyValues): PartyInput {
  const amount = v.opening_amount
  return {
    kind: v.kind,
    name: v.name,
    mobile: v.mobile || undefined,
    alt_phone: v.alt_phone || undefined,
    gstin: v.gstin || undefined,
    state_code: v.state_code || undefined,
    billing_address: v.billing_address || undefined,
    pincode: v.pincode || undefined,
    credit_limit: v.credit_limit || undefined,
    opening_balance: amount ? (v.opening_side === 'cr' ? `-${amount}` : amount) : '0',
    opening_date: v.opening_date || undefined,
    notes: v.notes || undefined,
    sites: v.sites,
  }
}

/** WhatsApp link for a 10-digit Indian mobile (wa.me needs the country code). */
export function whatsappLink(mobile: string | null | undefined, text: string): string | null {
  const digits = (mobile ?? '').replace(/\D/g, '')
  const number =
    digits.length === 10
      ? `91${digits}`
      : digits.length === 12 && digits.startsWith('91')
        ? digits
        : null
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null
}
