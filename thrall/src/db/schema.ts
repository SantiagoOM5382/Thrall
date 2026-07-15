import { text, integer, sqliteTable, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

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
  code: text('code').notNull(),
  displayName: text('display_name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  codeIdx: uniqueIndex('pay_methods_code_idx').on(t.code),
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
