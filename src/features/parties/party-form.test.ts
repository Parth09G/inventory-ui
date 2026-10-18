import { describe, expect, it } from 'vitest'
import { emptyParty, fromParty, partySchema, toPartyInput, whatsappLink } from './party-form'

describe('party form', () => {
  it('signs the opening balance: we owe them = credit (negative)', () => {
    const v = { ...emptyParty('supplier'), name: 'Jindal Traders', opening_amount: '25000' }
    expect(v.opening_side).toBe('cr')
    expect(toPartyInput(v).opening_balance).toBe('-25000')
    expect(toPartyInput({ ...v, opening_side: 'dr' }).opening_balance).toBe('25000')
    expect(toPartyInput({ ...v, opening_amount: '' }).opening_balance).toBe('0')
  })
  it('reads a payable opening balance back', () => {
    const v = fromParty({
      id: 1,
      kind: 'supplier',
      name: 'X',
      balance: '0',
      is_active: true,
      opening_balance: '-25000.00',
    })
    expect([v.opening_amount, v.opening_side]).toEqual(['25000', 'cr'])
  })
  it('checks GSTIN format and that the state matches it', () => {
    const bad = partySchema.safeParse({
      ...emptyParty(),
      name: 'Ravi',
      gstin: '29ABCDE1234F1Z',
      state_code: '29',
    })
    expect(bad.error?.issues[0]?.message).toBe('Enter a valid 15-character GSTIN')
    const mismatch = partySchema.safeParse({
      ...emptyParty(),
      name: 'Ravi',
      gstin: '29abcde1234f1z5',
      state_code: '33',
    })
    expect(mismatch.error?.issues[0]?.message).toBe(
      'The state does not match the GSTIN (first two digits)',
    )
    const ok = partySchema.parse({
      ...emptyParty(),
      name: 'Ravi',
      gstin: '29abcde1234f1z5',
      state_code: '29',
    })
    expect(ok.gstin).toBe('29ABCDE1234F1Z5')
  })
  it('normalises mobile numbers people type with spaces or +91', () => {
    const parse = (mobile: string) => partySchema.safeParse({ ...emptyParty(), name: 'X', mobile })
    expect(parse('98450 12345').data?.mobile).toBe('9845012345')
    expect(parse('+91-98450-12345').data?.mobile).toBe('9845012345')
    expect(parse('12345').success).toBe(false)
  })
  it('builds WhatsApp links for Indian mobiles only', () => {
    expect(whatsappLink('98450 12345', 'Hi')).toBe('https://wa.me/919845012345?text=Hi')
    expect(whatsappLink('+91 98450 12345', 'a b')).toBe('https://wa.me/919845012345?text=a%20b')
    expect(whatsappLink('12345', 'x')).toBeNull()
  })
})
