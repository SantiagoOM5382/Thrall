import { text, integer, sqliteTable, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  nameIdx: uniqueIndex('brands_name_lower_idx').on(sql`lower(${t.name})`),
}))

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'monitor', 'model', 'dev'] }).notNull(),
  phone: text('phone'),
  telegram: text('telegram'),
  description: text('description'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
}))

export const userImages = sqliteTable('user_images', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const payMethods = sqliteTable('pay_methods', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  code: text('code').notNull(),
  displayName: text('display_name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  brandCodeIdx: uniqueIndex('pay_methods_brand_code_idx').on(t.brandId, t.code),
}))

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  basePrice: integer('base_price').notNull(),
  payMethodId: text('pay_method_id').notNull().references(() => payMethods.id),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const serviceExtras = sqliteTable('service_extras', {
  id: text('id').primaryKey(),
  serviceId: text('service_id').notNull().references(() => services.id),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  action: text('action', { enum: ['CREATE', 'UPDATE', 'DELETE'] }).notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
})

export const brandSubscriptions = sqliteTable('brand_subscriptions', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  tier: text('tier', { enum: ['free', 'paid'] }).notNull().default('free'),
  status: text('status', { enum: ['active', 'trial', 'expired'] }).notNull().default('trial'),
  trialEndsAt: integer('trial_ends_at'),
  paidUntil: integer('paid_until'),
  isGrandfathered: integer('is_grandfathered').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  brandIdx: uniqueIndex('brand_subscriptions_brand_idx').on(t.brandId),
}))

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  type: text('type', { enum: ['SUBSCRIPTION', 'TOKEN_PACK'] }).notNull(),
  displayName: text('display_name').notNull(),
  priceCop: integer('price_cop').notNull(),
  durationDays: integer('duration_days'),
  tokensGranted: integer('tokens_granted'),
  tokenDiscountPercent: integer('token_discount_percent'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('products_code_idx').on(t.code),
}))

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  productId: text('product_id').notNull().references(() => products.id),
  userId: text('user_id').notNull().references(() => users.id),
  amountCop: integer('amount_cop').notNull(),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] }).notNull(),
  wompiReference: text('wompi_reference').notNull(),
  wompiTransactionId: text('wompi_transaction_id'),
  paidAt: integer('paid_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  refIdx: uniqueIndex('purchases_wompi_reference_idx').on(t.wompiReference),
  brandCreatedIdx: index('purchases_brand_created_idx').on(t.brandId, t.createdAt),
}))

export const brandWallets = sqliteTable('brand_wallets', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  tokensBalance: integer('tokens_balance').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  brandIdx: uniqueIndex('brand_wallets_brand_idx').on(t.brandId),
}))

export const topServices = sqliteTable('top_services', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  displayName: text('display_name').notNull(),
  tokensCost: integer('tokens_cost').notNull(),
  durationHours: integer('duration_hours').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('top_services_code_idx').on(t.code),
}))

export const profileBoosts = sqliteTable('profile_boosts', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  brandId: text('brand_id').notNull().references(() => brands.id),
  purchasedBy: text('purchased_by').notNull().references(() => users.id),
  topServiceId: text('top_service_id').notNull().references(() => topServices.id),
  tokensSpent: integer('tokens_spent').notNull(),
  startsAt: integer('starts_at').notNull(),
  endsAt: integer('ends_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  modelEndsIdx: index('profile_boosts_model_ends_idx').on(t.modelId, t.endsAt),
  brandCreatedIdx: index('profile_boosts_brand_created_idx').on(t.brandId, t.createdAt),
}))

export const walletTransactions = sqliteTable('wallet_transactions', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  type: text('type', { enum: ['CREDIT_PURCHASE', 'DEBIT_BOOST'] }).notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  purchaseId: text('purchase_id').references(() => purchases.id),
  profileBoostId: text('profile_boost_id').references(() => profileBoosts.id),
  description: text('description').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  brandCreatedIdx: index('wallet_transactions_brand_created_idx').on(t.brandId, t.createdAt),
}))

export const fines = sqliteTable('fines', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const loans = sqliteTable('loans', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  payMethodId: text('pay_method_id').notNull().references(() => payMethods.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
})
