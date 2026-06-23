"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/index.ts
var index_exports = {};
__export(index_exports, {
  config: () => config,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_vercel = require("hono/vercel");

// src/app.ts
var import_config = require("dotenv/config");
var import_hono8 = require("hono");
var import_cors = require("hono/cors");

// src/routes/auth.ts
var import_hono = require("hono");
var import_zod_validator = require("@hono/zod-validator");
var import_zod = require("zod");
var import_drizzle_orm = require("drizzle-orm");

// src/db/client.ts
var import_client = require("@libsql/client");
var import_libsql = require("drizzle-orm/libsql");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  brandSubscriptions: () => brandSubscriptions,
  brands: () => brands,
  payMethods: () => payMethods,
  serviceExtras: () => serviceExtras,
  services: () => services,
  userImages: () => userImages,
  users: () => users
});
var import_sqlite_core = require("drizzle-orm/sqlite-core");
var brands = (0, import_sqlite_core.sqliteTable)("brands", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  name: (0, import_sqlite_core.text)("name").notNull(),
  isActive: (0, import_sqlite_core.integer)("is_active").notNull().default(1),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull()
});
var users = (0, import_sqlite_core.sqliteTable)("users", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  brandId: (0, import_sqlite_core.text)("brand_id").notNull().references(() => brands.id),
  name: (0, import_sqlite_core.text)("name").notNull(),
  email: (0, import_sqlite_core.text)("email").notNull(),
  password: (0, import_sqlite_core.text)("password").notNull(),
  role: (0, import_sqlite_core.text)("role", { enum: ["admin", "monitor", "model"] }).notNull(),
  phone: (0, import_sqlite_core.text)("phone"),
  telegram: (0, import_sqlite_core.text)("telegram"),
  description: (0, import_sqlite_core.text)("description"),
  isActive: (0, import_sqlite_core.integer)("is_active").notNull().default(1),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull(),
  deletedAt: (0, import_sqlite_core.integer)("deleted_at")
}, (t) => ({
  emailIdx: (0, import_sqlite_core.uniqueIndex)("users_email_idx").on(t.email)
}));
var userImages = (0, import_sqlite_core.sqliteTable)("user_images", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  userId: (0, import_sqlite_core.text)("user_id").notNull().references(() => users.id),
  url: (0, import_sqlite_core.text)("url").notNull(),
  sortOrder: (0, import_sqlite_core.integer)("sort_order").notNull().default(0),
  isActive: (0, import_sqlite_core.integer)("is_active").notNull().default(1),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull(),
  deletedAt: (0, import_sqlite_core.integer)("deleted_at")
});
var payMethods = (0, import_sqlite_core.sqliteTable)("pay_methods", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  code: (0, import_sqlite_core.text)("code").notNull(),
  displayName: (0, import_sqlite_core.text)("display_name").notNull(),
  isActive: (0, import_sqlite_core.integer)("is_active").notNull().default(1),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull(),
  deletedAt: (0, import_sqlite_core.integer)("deleted_at")
}, (t) => ({
  codeIdx: (0, import_sqlite_core.uniqueIndex)("pay_methods_code_idx").on(t.code)
}));
var services = (0, import_sqlite_core.sqliteTable)("services", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  modelId: (0, import_sqlite_core.text)("model_id").notNull().references(() => users.id),
  createdBy: (0, import_sqlite_core.text)("created_by").notNull().references(() => users.id),
  startTime: (0, import_sqlite_core.integer)("start_time").notNull(),
  endTime: (0, import_sqlite_core.integer)("end_time").notNull(),
  basePrice: (0, import_sqlite_core.integer)("base_price").notNull(),
  payMethodId: (0, import_sqlite_core.text)("pay_method_id").notNull().references(() => payMethods.id),
  note: (0, import_sqlite_core.text)("note"),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull(),
  deletedAt: (0, import_sqlite_core.integer)("deleted_at")
});
var serviceExtras = (0, import_sqlite_core.sqliteTable)("service_extras", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  serviceId: (0, import_sqlite_core.text)("service_id").notNull().references(() => services.id),
  description: (0, import_sqlite_core.text)("description").notNull(),
  amount: (0, import_sqlite_core.integer)("amount").notNull(),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull()
});
var auditLogs = (0, import_sqlite_core.sqliteTable)("audit_logs", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  userId: (0, import_sqlite_core.text)("user_id").notNull().references(() => users.id),
  action: (0, import_sqlite_core.text)("action", { enum: ["CREATE", "UPDATE", "DELETE"] }).notNull(),
  entity: (0, import_sqlite_core.text)("entity").notNull(),
  entityId: (0, import_sqlite_core.text)("entity_id").notNull(),
  metadata: (0, import_sqlite_core.text)("metadata"),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull()
});
var brandSubscriptions = (0, import_sqlite_core.sqliteTable)("brand_subscriptions", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  brandId: (0, import_sqlite_core.text)("brand_id").notNull().references(() => brands.id),
  plan: (0, import_sqlite_core.text)("plan").notNull().default("pilot"),
  isActive: (0, import_sqlite_core.integer)("is_active").notNull().default(1),
  paidUntil: (0, import_sqlite_core.integer)("paid_until"),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull()
});

// src/db/client.ts
var client = (0, import_client.createClient)({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
var db = (0, import_libsql.drizzle)(client, { schema: schema_exports });

// src/lib/hash.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
async function hashPassword(plain) {
  return import_bcryptjs.default.hash(plain, 10);
}
async function comparePassword(plain, hashed) {
  return import_bcryptjs.default.compare(plain, hashed);
}

// src/lib/jwt.ts
var import_jose = require("jose");
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is required");
  return new TextEncoder().encode(secret);
}
async function signToken(payload) {
  return new import_jose.SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("24h").sign(getSecret());
}
async function verifyToken(token) {
  const { payload } = await (0, import_jose.jwtVerify)(token, getSecret());
  return payload;
}

// src/middleware/auth.ts
async function authMiddleware(c, next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = header.slice(7);
  try {
    const payload = await verifyToken(token);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

// src/routes/auth.ts
var authRoutes = new import_hono.Hono();
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(1)
});
authRoutes.post("/login", (0, import_zod_validator.zValidator)("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const user = await db.query.users.findFirst({
    where: (0, import_drizzle_orm.eq)(users.email, email)
  });
  if (!user || user.isActive === 0 || user.deletedAt !== null) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const token = await signToken({
    sub: user.id,
    role: user.role,
    brandId: user.brandId,
    name: user.name
  });
  return c.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, brandId: user.brandId }
  });
});
authRoutes.get("/me", authMiddleware, (c) => {
  const user = c.get("user");
  return c.json({ id: user.sub, name: user.name, role: user.role, brandId: user.brandId });
});

// src/routes/users.ts
var import_hono2 = require("hono");
var import_zod_validator2 = require("@hono/zod-validator");
var import_zod2 = require("zod");
var import_drizzle_orm2 = require("drizzle-orm");

// src/middleware/rbac.ts
function requireRole(...roles) {
  return async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}

// src/lib/ulid.ts
var import_ulidx = require("ulidx");
function newId() {
  return (0, import_ulidx.ulid)();
}

// src/lib/audit.ts
async function logAudit(db2, params) {
  await db2.insert(auditLogs).values({
    id: newId(),
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: Date.now()
  });
}

// src/routes/users.ts
var usersRoutes = new import_hono2.Hono();
usersRoutes.use("*", authMiddleware, requireRole("admin"));
var createSchema = import_zod2.z.object({
  name: import_zod2.z.string().min(1),
  email: import_zod2.z.string().email(),
  password: import_zod2.z.string().min(6),
  role: import_zod2.z.enum(["admin", "monitor", "model"]),
  brandId: import_zod2.z.string(),
  phone: import_zod2.z.string().optional(),
  telegram: import_zod2.z.string().optional(),
  description: import_zod2.z.string().optional()
});
var updateSchema = createSchema.partial().omit({ password: true }).extend({
  password: import_zod2.z.string().min(6).optional()
});
function omitPassword(u) {
  const { password: _, ...rest } = u;
  return rest;
}
usersRoutes.get("/", async (c) => {
  const all = await db.query.users.findMany({
    where: (u, { isNull: isNull3 }) => isNull3(u.deletedAt)
  });
  return c.json(all.map(omitPassword));
});
usersRoutes.post("/", (0, import_zod_validator2.zValidator)("json", createSchema), async (c) => {
  const data = c.req.valid("json");
  const caller = c.get("user");
  const id = newId();
  const now = Date.now();
  await db.insert(users).values({
    id,
    ...data,
    password: await hashPassword(data.password),
    isActive: 1,
    createdAt: now,
    updatedAt: now
  });
  await logAudit(db, { userId: caller.sub, action: "CREATE", entity: "user", entityId: id });
  const created = await db.query.users.findFirst({ where: (0, import_drizzle_orm2.eq)(users.id, id) });
  return c.json(omitPassword(created), 201);
});
usersRoutes.get("/:id", async (c) => {
  const user = await db.query.users.findFirst({
    where: (u, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(u.id, c.req.param("id")), isNull3(u.deletedAt))
  });
  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json(omitPassword(user));
});
usersRoutes.put("/:id", (0, import_zod_validator2.zValidator)("json", updateSchema), async (c) => {
  const caller = c.get("user");
  const existing = await db.query.users.findFirst({
    where: (u, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(u.id, c.req.param("id")), isNull3(u.deletedAt))
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  const data = c.req.valid("json");
  const now = Date.now();
  const patch = { ...data, updatedAt: now };
  if (data.password) patch.password = await hashPassword(data.password);
  await db.update(users).set(patch).where((0, import_drizzle_orm2.eq)(users.id, c.req.param("id")));
  await logAudit(db, { userId: caller.sub, action: "UPDATE", entity: "user", entityId: c.req.param("id") });
  const updated = await db.query.users.findFirst({ where: (0, import_drizzle_orm2.eq)(users.id, c.req.param("id")) });
  return c.json(omitPassword(updated));
});
usersRoutes.delete("/:id", async (c) => {
  const caller = c.get("user");
  if (caller.sub === c.req.param("id")) {
    return c.json({ error: "Cannot delete own account" }, 400);
  }
  const existing = await db.query.users.findFirst({
    where: (u, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(u.id, c.req.param("id")), isNull3(u.deletedAt))
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  const now = Date.now();
  await db.update(users).set({ deletedAt: now, updatedAt: now }).where((0, import_drizzle_orm2.eq)(users.id, c.req.param("id")));
  await logAudit(db, { userId: caller.sub, action: "DELETE", entity: "user", entityId: c.req.param("id") });
  return c.json({ ok: true });
});

// src/routes/models.ts
var import_hono3 = require("hono");
var modelsRoutes = new import_hono3.Hono();
modelsRoutes.get("/", async (c) => {
  const models = await db.query.users.findMany({
    where: (u, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(u.role, "model"), eq7(u.isActive, 1), isNull3(u.deletedAt))
  });
  const result = await Promise.all(
    models.map(async (m) => {
      const images = await db.query.userImages.findMany({
        where: (img, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(img.userId, m.id), eq7(img.isActive, 1), isNull3(img.deletedAt)),
        orderBy: (img, { asc }) => [asc(img.sortOrder)]
      });
      const { password: _, ...model } = m;
      return { ...model, images: images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })) };
    })
  );
  return c.json(result);
});
modelsRoutes.get("/:id", async (c) => {
  const model = await db.query.users.findFirst({
    where: (u, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(u.id, c.req.param("id")), eq7(u.role, "model"), eq7(u.isActive, 1), isNull3(u.deletedAt))
  });
  if (!model) return c.json({ error: "Not found" }, 404);
  const images = await db.query.userImages.findMany({
    where: (img, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(img.userId, model.id), eq7(img.isActive, 1), isNull3(img.deletedAt)),
    orderBy: (img, { asc }) => [asc(img.sortOrder)]
  });
  const { password: _, ...rest } = model;
  return c.json({ ...rest, images: images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })) });
});

// src/routes/images.ts
var import_hono4 = require("hono");
var import_drizzle_orm3 = require("drizzle-orm");
var import_blob = require("@vercel/blob");
var imagesRoutes = new import_hono4.Hono();
imagesRoutes.use("*", authMiddleware);
imagesRoutes.post("/users/:userId", async (c) => {
  const caller = c.get("user");
  const { userId } = c.req.param();
  if (caller.role === "model" && caller.sub !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }
  const blob = await (0, import_blob.put)(`models/${userId}/${newId()}`, file, { access: "public" });
  const id = newId();
  const now = Date.now();
  await db.insert(userImages).values({
    id,
    userId,
    url: blob.url,
    sortOrder: 0,
    isActive: 1,
    createdAt: now,
    updatedAt: now
  });
  await logAudit(db, { userId: caller.sub, action: "CREATE", entity: "image", entityId: id });
  return c.json({ id, url: blob.url }, 201);
});
imagesRoutes.delete("/:id", async (c) => {
  const caller = c.get("user");
  if (!["admin", "monitor"].includes(caller.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const existing = await db.query.userImages.findFirst({
    where: (img, { and: and2, eq: eq7, isNull: isNullOp }) => and2(eq7(img.id, c.req.param("id")), isNullOp(img.deletedAt))
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  const now = Date.now();
  await db.update(userImages).set({ deletedAt: now, updatedAt: now, isActive: 0 }).where((0, import_drizzle_orm3.eq)(userImages.id, c.req.param("id")));
  await logAudit(db, { userId: caller.sub, action: "DELETE", entity: "image", entityId: c.req.param("id") });
  return c.json({ ok: true });
});

// src/routes/pay-methods.ts
var import_hono5 = require("hono");
var import_zod_validator3 = require("@hono/zod-validator");
var import_zod3 = require("zod");
var import_drizzle_orm4 = require("drizzle-orm");

// src/serializers/pay-method.ts
function serializePayMethod(pm, role) {
  if (role === "admin") {
    return { id: pm.id, code: pm.code, displayName: pm.displayName, isActive: pm.isActive };
  }
  return { id: pm.id, code: pm.code, isActive: pm.isActive };
}

// src/routes/pay-methods.ts
var payMethodsRoutes = new import_hono5.Hono();
payMethodsRoutes.use("*", authMiddleware);
var bodySchema = import_zod3.z.object({
  code: import_zod3.z.string().min(1).toUpperCase(),
  displayName: import_zod3.z.string().min(1)
});
payMethodsRoutes.get("/", async (c) => {
  const role = c.get("user").role;
  const all = await db.query.payMethods.findMany({
    where: (pm, { isNull: isNull3 }) => isNull3(pm.deletedAt)
  });
  return c.json(all.map((pm) => serializePayMethod(pm, role)));
});
payMethodsRoutes.post("/", requireRole("admin"), (0, import_zod_validator3.zValidator)("json", bodySchema), async (c) => {
  const caller = c.get("user");
  const data = c.req.valid("json");
  const id = newId();
  const now = Date.now();
  await db.insert(payMethods).values({ id, ...data, isActive: 1, createdAt: now, updatedAt: now });
  await logAudit(db, { userId: caller.sub, action: "CREATE", entity: "pay_method", entityId: id });
  return c.json(serializePayMethod({ id, ...data, isActive: 1 }, caller.role), 201);
});
payMethodsRoutes.put("/:id", requireRole("admin"), (0, import_zod_validator3.zValidator)("json", bodySchema.partial()), async (c) => {
  const caller = c.get("user");
  const existing = await db.query.payMethods.findFirst({
    where: (pm, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(pm.id, c.req.param("id")), isNull3(pm.deletedAt))
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  const now = Date.now();
  await db.update(payMethods).set({ ...c.req.valid("json"), updatedAt: now }).where((0, import_drizzle_orm4.eq)(payMethods.id, c.req.param("id")));
  await logAudit(db, { userId: caller.sub, action: "UPDATE", entity: "pay_method", entityId: c.req.param("id") });
  const updated = await db.query.payMethods.findFirst({ where: (0, import_drizzle_orm4.eq)(payMethods.id, c.req.param("id")) });
  return c.json(serializePayMethod(updated, caller.role));
});
payMethodsRoutes.delete("/:id", requireRole("admin"), async (c) => {
  const caller = c.get("user");
  const existing = await db.query.payMethods.findFirst({
    where: (pm, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(pm.id, c.req.param("id")), isNull3(pm.deletedAt))
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  const now = Date.now();
  await db.update(payMethods).set({ deletedAt: now, updatedAt: now }).where((0, import_drizzle_orm4.eq)(payMethods.id, c.req.param("id")));
  await logAudit(db, { userId: caller.sub, action: "DELETE", entity: "pay_method", entityId: c.req.param("id") });
  return c.json({ ok: true });
});

// src/routes/services.ts
var import_hono6 = require("hono");
var import_zod_validator4 = require("@hono/zod-validator");
var import_zod4 = require("zod");
var import_drizzle_orm5 = require("drizzle-orm");

// src/lib/timezone.ts
function getTodayRangeInBogota() {
  const now = /* @__PURE__ */ new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const start = (/* @__PURE__ */ new Date(`${dateStr}T00:00:00-05:00`)).getTime();
  const end = (/* @__PURE__ */ new Date(`${dateStr}T23:59:59.999-05:00`)).getTime();
  return { start, end };
}

// src/routes/services.ts
var servicesRoutes = new import_hono6.Hono();
servicesRoutes.use("*", authMiddleware);
var serviceBaseSchema = import_zod4.z.object({
  modelId: import_zod4.z.string(),
  startTime: import_zod4.z.number().int(),
  endTime: import_zod4.z.number().int(),
  basePrice: import_zod4.z.number().int().positive(),
  payMethodId: import_zod4.z.string(),
  note: import_zod4.z.string().optional(),
  extras: import_zod4.z.array(import_zod4.z.object({
    description: import_zod4.z.string(),
    amount: import_zod4.z.number().int().positive()
  })).default([])
});
var createSchema2 = serviceBaseSchema.refine((d) => d.endTime > d.startTime, {
  message: "endTime must be after startTime",
  path: ["endTime"]
});
async function getServiceWithExtras(id) {
  const service = await db.query.services.findFirst({
    where: (s, { and: and2, eq: eq7, isNull: isNull3 }) => and2(eq7(s.id, id), isNull3(s.deletedAt))
  });
  if (!service) return null;
  const extras = await db.query.serviceExtras.findMany({ where: (0, import_drizzle_orm5.eq)(serviceExtras.serviceId, id) });
  return { ...service, extras };
}
servicesRoutes.get("/", async (c) => {
  const caller = c.get("user");
  const { start, end } = getTodayRangeInBogota();
  if (caller.role === "admin") {
    const all = await db.query.services.findMany({
      orderBy: (s, { desc }) => [desc(s.createdAt)]
    });
    const withExtras2 = await Promise.all(all.map(
      (s) => db.query.serviceExtras.findMany({ where: (0, import_drizzle_orm5.eq)(serviceExtras.serviceId, s.id) }).then((extras) => ({ ...s, extras }))
    ));
    return c.json(withExtras2);
  }
  if (caller.role === "monitor") {
    const todayServices = await db.query.services.findMany({
      where: (s, { and: and2, between: between2, isNull: isNull3 }) => and2(between2(s.startTime, start, end), isNull3(s.deletedAt)),
      orderBy: (s, { desc }) => [desc(s.startTime)]
    });
    const withExtras2 = await Promise.all(todayServices.map(
      (s) => db.query.serviceExtras.findMany({ where: (0, import_drizzle_orm5.eq)(serviceExtras.serviceId, s.id) }).then((extras) => ({ ...s, extras }))
    ));
    return c.json(withExtras2);
  }
  const ownServices = await db.query.services.findMany({
    where: (s, { and: and2, eq: eqFn, between: between2, isNull: isNull3 }) => and2(eqFn(s.modelId, caller.sub), between2(s.startTime, start, end), isNull3(s.deletedAt)),
    orderBy: (s, { desc }) => [desc(s.startTime)]
  });
  const withExtras = await Promise.all(ownServices.map(
    (s) => db.query.serviceExtras.findMany({ where: (0, import_drizzle_orm5.eq)(serviceExtras.serviceId, s.id) }).then((extras) => ({ ...s, extras }))
  ));
  return c.json(withExtras);
});
servicesRoutes.post("/", (0, import_zod_validator4.zValidator)("json", createSchema2), async (c) => {
  const caller = c.get("user");
  if (!["admin", "monitor"].includes(caller.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const data = c.req.valid("json");
  const id = newId();
  const now = Date.now();
  await db.insert(services).values({
    id,
    modelId: data.modelId,
    createdBy: caller.sub,
    startTime: data.startTime,
    endTime: data.endTime,
    basePrice: data.basePrice,
    payMethodId: data.payMethodId,
    note: data.note ?? null,
    createdAt: now,
    updatedAt: now
  });
  for (const extra of data.extras) {
    await db.insert(serviceExtras).values({
      id: newId(),
      serviceId: id,
      description: extra.description,
      amount: extra.amount,
      createdAt: now
    });
  }
  await logAudit(db, { userId: caller.sub, action: "CREATE", entity: "service", entityId: id });
  const result = await getServiceWithExtras(id);
  return c.json(result, 201);
});
servicesRoutes.put("/:id", (0, import_zod_validator4.zValidator)("json", serviceBaseSchema.partial()), async (c) => {
  const caller = c.get("user");
  if (!["admin", "monitor"].includes(caller.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const existing = await getServiceWithExtras(c.req.param("id"));
  if (!existing) return c.json({ error: "Not found" }, 404);
  const data = c.req.valid("json");
  const now = Date.now();
  const { extras, ...serviceData } = data;
  await db.update(services).set({ ...serviceData, updatedAt: now }).where((0, import_drizzle_orm5.eq)(services.id, c.req.param("id")));
  if (extras !== void 0) {
    await db.delete(serviceExtras).where((0, import_drizzle_orm5.eq)(serviceExtras.serviceId, c.req.param("id")));
    for (const extra of extras) {
      await db.insert(serviceExtras).values({
        id: newId(),
        serviceId: c.req.param("id"),
        description: extra.description,
        amount: extra.amount,
        createdAt: now
      });
    }
  }
  await logAudit(db, { userId: caller.sub, action: "UPDATE", entity: "service", entityId: c.req.param("id") });
  return c.json(await getServiceWithExtras(c.req.param("id")));
});
servicesRoutes.delete("/:id", async (c) => {
  const caller = c.get("user");
  if (!["admin", "monitor"].includes(caller.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const existing = await getServiceWithExtras(c.req.param("id"));
  if (!existing) return c.json({ error: "Not found" }, 404);
  const now = Date.now();
  await db.update(services).set({ deletedAt: now, updatedAt: now }).where((0, import_drizzle_orm5.eq)(services.id, c.req.param("id")));
  await logAudit(db, { userId: caller.sub, action: "DELETE", entity: "service", entityId: c.req.param("id") });
  return c.json({ ok: true });
});

// src/routes/reports.ts
var import_hono7 = require("hono");
var import_drizzle_orm6 = require("drizzle-orm");

// src/lib/earnings.ts
function calcEarnings(basePrice, extraAmounts) {
  const modelBase = Math.round(basePrice * 0.6);
  const company = basePrice - modelBase;
  const modelExtras = extraAmounts.reduce((sum, n) => sum + n, 0);
  return {
    modelBase,
    company,
    modelExtras,
    modelTotal: modelBase + modelExtras
  };
}

// src/routes/reports.ts
var reportsRoutes = new import_hono7.Hono();
reportsRoutes.use("*", authMiddleware);
reportsRoutes.get("/ranking", requireRole("admin", "monitor"), async (c) => {
  const all = await db.query.services.findMany({
    where: (s, { isNull: isNull3 }) => isNull3(s.deletedAt)
  });
  const countByModel = {};
  for (const s of all) {
    if (!countByModel[s.modelId]) {
      countByModel[s.modelId] = { modelId: s.modelId, count: 0, totalBase: 0 };
    }
    countByModel[s.modelId].count++;
    countByModel[s.modelId].totalBase += s.basePrice;
  }
  const ranked = await Promise.all(
    Object.values(countByModel).sort((a, b) => b.count - a.count).map(async (entry, i) => {
      const model = await db.query.users.findFirst({ where: (0, import_drizzle_orm6.eq)(users.id, entry.modelId) });
      return {
        position: i + 1,
        modelId: entry.modelId,
        name: model?.name ?? "Unknown",
        serviceCount: entry.count,
        totalBase: entry.totalBase
      };
    })
  );
  return c.json(ranked);
});
reportsRoutes.get("/earnings", requireRole("admin"), async (c) => {
  const from = Number(c.req.query("from") ?? 0);
  const to = Number(c.req.query("to") ?? Date.now());
  const allServices = await db.query.services.findMany({
    where: (s, { and: and2, between: between2, isNull: isNull3 }) => and2(between2(s.startTime, from, to), isNull3(s.deletedAt))
  });
  let totalBase = 0;
  let companyEarnings = 0;
  let modelBaseEarnings = 0;
  let modelExtraEarnings = 0;
  for (const s of allServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: (0, import_drizzle_orm6.eq)(serviceExtras.serviceId, s.id)
    });
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount));
    totalBase += s.basePrice;
    companyEarnings += e.company;
    modelBaseEarnings += e.modelBase;
    modelExtraEarnings += e.modelExtras;
  }
  return c.json({
    totalServices: allServices.length,
    totalBase,
    companyEarnings,
    modelBaseEarnings,
    modelExtraEarnings,
    modelTotalEarnings: modelBaseEarnings + modelExtraEarnings
  });
});
reportsRoutes.get("/model-earnings/:id", requireRole("admin"), async (c) => {
  const modelId = c.req.param("id");
  const from = Number(c.req.query("from") ?? 0);
  const to = Number(c.req.query("to") ?? Date.now());
  const modelServices = await db.query.services.findMany({
    where: (s, { and: and2, eq: eqFn, between: between2, isNull: isNull3 }) => and2(eqFn(s.modelId, modelId), between2(s.startTime, from, to), isNull3(s.deletedAt)),
    orderBy: (s, { desc }) => [desc(s.startTime)]
  });
  const rows = await Promise.all(
    modelServices.map(async (s) => {
      const extras = await db.query.serviceExtras.findMany({
        where: (0, import_drizzle_orm6.eq)(serviceExtras.serviceId, s.id)
      });
      const e = calcEarnings(s.basePrice, extras.map((x) => x.amount));
      return {
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        basePrice: s.basePrice,
        extras: extras.map((x) => ({ description: x.description, amount: x.amount })),
        modelBase: e.modelBase,
        modelExtras: e.modelExtras,
        modelTotal: e.modelTotal
      };
    })
  );
  const totals = rows.reduce(
    (acc, r) => ({
      totalBase: acc.totalBase + r.basePrice,
      totalModelEarnings: acc.totalModelEarnings + r.modelTotal
    }),
    { totalBase: 0, totalModelEarnings: 0 }
  );
  return c.json({ rows, totals });
});
reportsRoutes.get("/daily", requireRole("admin", "monitor"), async (c) => {
  const { start, end } = getTodayRangeInBogota();
  const todayServices = await db.query.services.findMany({
    where: (s, { and: and2, between: between2, isNull: isNull3 }) => and2(between2(s.startTime, start, end), isNull3(s.deletedAt))
  });
  let totalBase = 0;
  let companyEarnings = 0;
  let modelEarnings = 0;
  for (const s of todayServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: (0, import_drizzle_orm6.eq)(serviceExtras.serviceId, s.id)
    });
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount));
    totalBase += s.basePrice;
    companyEarnings += e.company;
    modelEarnings += e.modelTotal;
  }
  return c.json({
    date: new Date(start).toISOString().slice(0, 10),
    totalServices: todayServices.length,
    totalBase,
    companyEarnings,
    modelEarnings
  });
});

// src/app.ts
var app = new import_hono8.Hono().basePath("/api");
app.use("*", (0, import_cors.cors)({
  origin: process.env.FRONTEND_URL ?? "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.route("/auth", authRoutes);
app.route("/users", usersRoutes);
app.route("/models", modelsRoutes);
app.route("/images", imagesRoutes);
app.route("/pay-methods", payMethodsRoutes);
app.route("/services", servicesRoutes);
app.route("/reports", reportsRoutes);
app.get("/health", (c) => c.json({ ok: true }));
var app_default = app;

// api/index.ts
var config = { runtime: "nodejs" };
var index_default = (0, import_vercel.handle)(app_default);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
