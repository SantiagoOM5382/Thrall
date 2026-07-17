import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { purchases, products, brandSubscriptions, brandWallets, walletTransactions } from '../db/schema'
import { verifyWebhookSignature, computeNewPaidUntil } from '../lib/wompi'
import { newId } from '../lib/ulid'

export const webhooksRoutes = new Hono()

type WompiStatus = 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'
const TERMINAL: ReadonlySet<string> = new Set(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'])

webhooksRoutes.post('/wompi', async (c) => {
  const secret = process.env.WOMPI_EVENTS_SECRET
  if (!secret) return c.json({ error: 'wompi_not_configured' }, 500)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad_json' }, 400)
  }

  if (!verifyWebhookSignature(body, secret)) {
    return c.json({ error: 'invalid_signature' }, 401)
  }

  if (body.event !== 'transaction.updated') {
    return c.json({ ok: true, ignored: 'unhandled_event' })
  }

  const tx = body?.data?.transaction
  if (!tx?.reference || !tx?.status) {
    return c.json({ ok: true, ignored: 'malformed_payload' })
  }

  const purchase = await db.query.purchases.findFirst({
    where: eq(purchases.wompiReference, tx.reference),
  })
  if (!purchase) {
    return c.json({ ok: true, ignored: 'unknown_reference' })
  }

  if (TERMINAL.has(purchase.status)) {
    return c.json({ ok: true, ignored: 'already_processed' })
  }

  const status = tx.status as WompiStatus
  if (status === 'PENDING') {
    return c.json({ ok: true, ignored: 'still_pending' })
  }

  await db.transaction(async (tx2) => {
    const now = Date.now()
    await tx2.update(purchases)
      .set({
        status,
        wompiTransactionId: tx.id,
        paidAt: status === 'APPROVED' ? now : null,
        updatedAt: now,
      })
      .where(eq(purchases.id, purchase.id))

    if (status === 'APPROVED') {
      const product = await tx2.query.products.findFirst({
        where: eq(products.id, purchase.productId),
      })
      if (!product) return

      if (product.type === 'SUBSCRIPTION' && product.durationDays != null) {
        const sub = await tx2.query.brandSubscriptions.findFirst({
          where: eq(brandSubscriptions.brandId, purchase.brandId),
        })
        const newPaidUntil = computeNewPaidUntil(
          { paidUntil: sub?.paidUntil ?? null },
          { durationDays: product.durationDays },
          now,
        )
        if (sub) {
          await tx2.update(brandSubscriptions)
            .set({
              tier: 'paid', status: 'active',
              paidUntil: newPaidUntil, trialEndsAt: null,
              updatedAt: now,
            })
            .where(eq(brandSubscriptions.id, sub.id))
        }
      } else if (product.type === 'TOKEN_PACK' && product.tokensGranted != null) {
        const wallet = await tx2.query.brandWallets.findFirst({
          where: eq(brandWallets.brandId, purchase.brandId),
        })
        const currentBalance = wallet?.tokensBalance ?? 0
        const newBalance = currentBalance + product.tokensGranted

        if (wallet) {
          await tx2.update(brandWallets)
            .set({ tokensBalance: newBalance, updatedAt: now })
            .where(eq(brandWallets.id, wallet.id))
        } else {
          await tx2.insert(brandWallets).values({
            id: newId(), brandId: purchase.brandId, tokensBalance: newBalance,
            createdAt: now, updatedAt: now,
          })
        }

        await tx2.insert(walletTransactions).values({
          id: newId(),
          brandId: purchase.brandId,
          type: 'CREDIT_PURCHASE',
          amount: product.tokensGranted,
          balanceAfter: newBalance,
          purchaseId: purchase.id,
          description: `Compra ${product.displayName}`,
          createdAt: now,
        })
      }
    }
  })

  return c.json({ ok: true })
})
