import { describe, it, expect } from 'vitest'
import {
  computeIntegritySignature,
  buildCheckoutUrl,
  verifyWebhookSignature,
  computeNewPaidUntil,
} from '../../src/lib/wompi'
import { createHash } from 'node:crypto'

describe('computeIntegritySignature', () => {
  it('matches sha256(reference + amountInCents + currency + secret) hex', () => {
    const sig = computeIntegritySignature('ref-123', 8500000, 'COP', 'my_secret')
    const expected = createHash('sha256').update('ref-1238500000COPmy_secret').digest('hex')
    expect(sig).toBe(expected)
  })
})

describe('buildCheckoutUrl', () => {
  it('includes all required query params and integrity signature', () => {
    const url = buildCheckoutUrl({
      publicKey: 'pub_test_XYZ',
      integritySecret: 'sec',
      reference: 'ref-1',
      amountInCents: 8500000,
      currency: 'COP',
      redirectUrl: 'https://sylvanas.example.com/dashboard/subscribe/success',
    })
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://checkout.wompi.co/p/')
    expect(u.searchParams.get('public-key')).toBe('pub_test_XYZ')
    expect(u.searchParams.get('currency')).toBe('COP')
    expect(u.searchParams.get('amount-in-cents')).toBe('8500000')
    expect(u.searchParams.get('reference')).toBe('ref-1')
    expect(u.searchParams.get('redirect-url')).toBe('https://sylvanas.example.com/dashboard/subscribe/success')
    expect(u.searchParams.get('signature:integrity')).toBe(
      computeIntegritySignature('ref-1', 8500000, 'COP', 'sec'),
    )
  })
})

describe('verifyWebhookSignature', () => {
  const secret = 'events_secret'
  const payload = {
    data: {
      transaction: { id: 'tx1', status: 'APPROVED', amount_in_cents: 8500000 },
    },
    timestamp: 1721000000,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: '', // filled below
    },
  }
  // Concat values in order: 'tx1' + 'APPROVED' + '8500000' + '1721000000' + secret
  const good = createHash('sha256')
    .update('tx1APPROVED8500000' + '1721000000' + secret)
    .digest('hex')

  it('accepts a valid signature', () => {
    const p = { ...payload, signature: { ...payload.signature, checksum: good } }
    expect(verifyWebhookSignature(p, secret)).toBe(true)
  })

  it('rejects a tampered amount', () => {
    const tampered = {
      ...payload,
      data: { transaction: { ...payload.data.transaction, amount_in_cents: 1 } },
      signature: { ...payload.signature, checksum: good },
    }
    expect(verifyWebhookSignature(tampered, secret)).toBe(false)
  })

  it('rejects when a property path is missing', () => {
    const missing = {
      ...payload,
      data: { transaction: { id: 'tx1' } }, // no status/amount
      signature: { ...payload.signature, checksum: good },
    }
    expect(verifyWebhookSignature(missing, secret)).toBe(false)
  })
})

describe('computeNewPaidUntil', () => {
  const day = 86_400_000
  const now = 1_000_000_000_000

  it('extends by durationDays when current paidUntil is in the future', () => {
    const current = { paidUntil: now + 20 * day }
    const result = computeNewPaidUntil(current, { durationDays: 30 }, now)
    expect(result).toBe(now + 20 * day + 30 * day)
  })

  it('starts from now when current paidUntil is in the past', () => {
    const current = { paidUntil: now - 5 * day }
    const result = computeNewPaidUntil(current, { durationDays: 30 }, now)
    expect(result).toBe(now + 30 * day)
  })

  it('starts from now when current paidUntil is null', () => {
    const result = computeNewPaidUntil({ paidUntil: null }, { durationDays: 180 }, now)
    expect(result).toBe(now + 180 * day)
  })
})
