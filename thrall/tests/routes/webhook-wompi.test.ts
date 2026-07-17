import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { db } from '../../src/db/client'
import { purchases, brandSubscriptions, brandWallets, walletTransactions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser } from '../helpers'
import { newId } from '../../src/lib/ulid'

process.env.WOMPI_EVENTS_SECRET ??= 'events_secret_test'
const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET!

function buildPayload(opts: {
  reference: string
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'
  amountInCents?: number
  transactionId?: string
}) {
  const txId = opts.transactionId ?? 'tx-' + newId()
  const amount = opts.amountInCents ?? 8500000
  const timestamp = Math.floor(Date.now() / 1000)
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
  const data = { transaction: { id: txId, reference: opts.reference, status: opts.status, amount_in_cents: amount } }
  const raw = `${txId}${opts.status}${amount}${timestamp}${EVENTS_SECRET}`
  const checksum = createHash('sha256').update(raw).digest('hex')
  return {
    event: 'transaction.updated',
    data,
    sent_at: new Date().toISOString(),
    timestamp,
    signature: { properties, checksum },
    environment: 'test',
  }
}

async function post(body: object) {
  return app.request('/api/webhooks/wompi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function seedPending(brandId: string, userId: string, ref: string, productId = 'prod_sub_monthly') {
  const now = Date.now()
  await db.insert(purchases).values({
    id: newId(), brandId, productId, userId, amountCop: 85000,
    status: 'PENDING', wompiReference: ref,
    createdAt: now, updatedAt: now,
  })
}

describe('POST /api/webhooks/wompi', () => {
  it('rejects invalid signature with 401', async () => {
    const body = buildPayload({ reference: 'ref-x', status: 'APPROVED' })
    body.signature.checksum = 'deadbeef'
    const res = await post(body)
    expect(res.status).toBe(401)
  })

  it('returns 200 for unknown reference', async () => {
    const body = buildPayload({ reference: 'ref-unknown', status: 'APPROVED' })
    const res = await post(body)
    expect(res.status).toBe(200)
  })

  it('activates paid subscription on APPROVED for a FREE-expired brand', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-a-' + newId()
    await seedPending(brand, u.id, ref)
    const body = buildPayload({ reference: ref, status: 'APPROVED' })
    const res = await post(body)
    expect(res.status).toBe(200)

    const p = await db.query.purchases.findFirst({ where: eq(purchases.wompiReference, ref) })
    expect(p?.status).toBe('APPROVED')
    expect(p?.paidAt).toBeGreaterThan(0)

    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub?.tier).toBe('paid')
    expect(sub?.status).toBe('active')
    expect(sub?.paidUntil).toBeGreaterThan(Date.now() + 29 * 86_400_000)
    expect(sub?.paidUntil).toBeLessThan(Date.now() + 31 * 86_400_000)
    expect(sub?.trialEndsAt).toBeNull()
  })

  it('is idempotent — duplicate APPROVED does not double-extend paidUntil', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-idem-' + newId()
    await seedPending(brand, u.id, ref)
    const body1 = buildPayload({ reference: ref, status: 'APPROVED' })
    await post(body1)
    const sub1 = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    const paidUntil1 = sub1!.paidUntil!

    const body2 = buildPayload({ reference: ref, status: 'APPROVED' })
    await post(body2)
    const sub2 = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub2!.paidUntil).toBe(paidUntil1)
  })

  it('extends existing paidUntil when brand is already paid-active', async () => {
    const day = 86_400_000
    const now = Date.now()
    const brand = await createTestBrand({
      tier: 'paid', status: 'active', isGrandfathered: 0, paidUntil: now + 20 * day,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-ext-' + newId()
    await seedPending(brand, u.id, ref)
    const body = buildPayload({ reference: ref, status: 'APPROVED' })
    await post(body)
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub!.paidUntil).toBeGreaterThan(now + 49 * day)
    expect(sub!.paidUntil).toBeLessThan(now + 51 * day)
  })

  it('DECLINED updates purchase but not brand_subscriptions', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-dec-' + newId()
    await seedPending(brand, u.id, ref)
    const body = buildPayload({ reference: ref, status: 'DECLINED' })
    await post(body)
    const p = await db.query.purchases.findFirst({ where: eq(purchases.wompiReference, ref) })
    expect(p?.status).toBe('DECLINED')
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub?.tier).toBe('free')
    expect(sub?.paidUntil).toBeNull()
  })
})

describe('POST /api/webhooks/wompi — TOKEN_PACK', () => {
  it('credits the wallet on APPROVED, creating it if missing', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-tok-' + newId()
    await seedPending(brand, u.id, ref, 'prod_tokens_100')
    const body = buildPayload({ reference: ref, status: 'APPROVED', amountInCents: 1000000 })
    const res = await post(body)
    expect(res.status).toBe(200)

    const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, brand) })
    expect(wallet?.tokensBalance).toBe(100)

    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.brandId, brand))
    expect(txs).toHaveLength(1)
    expect(txs[0].type).toBe('CREDIT_PURCHASE')
    expect(txs[0].amount).toBe(100)
    expect(txs[0].balanceAfter).toBe(100)

    // Subscription state must be untouched by a token purchase.
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub?.tier).toBe('free')
  })

  it('adds to an existing balance instead of overwriting it', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 40, createdAt: now, updatedAt: now })
    const ref = 'ref-tok2-' + newId()
    await seedPending(brand, u.id, ref, 'prod_tokens_500')
    const body = buildPayload({ reference: ref, status: 'APPROVED', amountInCents: 4000000 })
    await post(body)
    const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, brand) })
    expect(wallet?.tokensBalance).toBe(540)
  })
})
