import { createClient } from '@libsql/client'
import { createHash } from 'node:crypto'
import { ulid } from 'ulidx'
import 'dotenv/config'

const THRALL_URL = process.env.THRALL_PUBLIC_URL ?? 'https://thrall-delta.vercel.app'
const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET
if (!EVENTS_SECRET) { console.error('WOMPI_EVENTS_SECRET not set in .env'); process.exit(1) }

const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

console.log('Endpoint:', `${THRALL_URL}/api/webhooks/wompi`)

// Pick any existing brand + admin user to attach the test purchase to
const brandRow = await c.execute(`SELECT id FROM brands WHERE is_active = 1 LIMIT 1`)
const brandId = brandRow.rows[0].id
const userRow = await c.execute({ sql: `SELECT id FROM users WHERE brand_id = ? AND role IN ('admin','dev') LIMIT 1`, args: [brandId] })
const userId = userRow.rows[0].id
console.log('Attaching test purchase to brand', brandId, 'user', userId)

const productId = 'prod_sub_monthly'  // Mensual, $60k
const amountCop = 60000
const amountCents = amountCop * 100
const reference = 'smoke-' + ulid()
const purchaseId = ulid()
const now = Date.now()

await c.execute({
  sql: `INSERT INTO purchases (id, brand_id, product_id, user_id, amount_cop, status, wompi_reference, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
  args: [purchaseId, brandId, productId, userId, amountCop, reference, now, now],
})
console.log('Seeded PENDING purchase', reference)

// Build signed Wompi-style payload
const timestamp = Math.floor(Date.now() / 1000)
const txId = 'smoke-tx-' + ulid()
const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
const data = {
  transaction: {
    id: txId,
    reference,
    status: 'APPROVED',
    amount_in_cents: amountCents,
    currency: 'COP',
  },
}
const concat = `${txId}APPROVED${amountCents}${timestamp}${EVENTS_SECRET}`
const checksum = createHash('sha256').update(concat).digest('hex')

const payload = {
  event: 'transaction.updated',
  data,
  sent_at: new Date().toISOString(),
  timestamp,
  signature: { properties, checksum },
  environment: 'test',
}

// Fire
const res = await fetch(`${THRALL_URL}/api/webhooks/wompi`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
const body = await res.json().catch(() => ({}))
console.log('Webhook response:', res.status, body)

// Verify DB effects
const after = await c.execute({ sql: `SELECT status, paid_at, wompi_transaction_id FROM purchases WHERE id = ?`, args: [purchaseId] })
console.log('Purchase after:', after.rows[0])

const sub = await c.execute({ sql: `SELECT tier, status, paid_until FROM brand_subscriptions WHERE brand_id = ?`, args: [brandId] })
console.log('Subscription state:', sub.rows[0])

// Cleanup so we don't leave test rows in prod
await c.execute({ sql: `DELETE FROM purchases WHERE id = ?`, args: [purchaseId] })
console.log('Test purchase deleted.')

process.exit(0)
