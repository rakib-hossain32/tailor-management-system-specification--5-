import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * TailorPro — single-tenant for now, every business table carries a stable
 * primary key so multi-tenant (shop_id) scoping can be added later without
 * rewriting the data model.
 */

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone").notNull().unique(),
    email: text("email"),
    passwordHash: text("password_hash"),
    role: text("role").notNull().default("reception"), // owner | manager | reception | master
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [index("users_role_idx").on(t.role)],
);

/* -------------------------------------------------------------- customers */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone").notNull().unique(),
    altPhone: text("alt_phone"),
    email: text("email"),
    address: text("address"),
    birthDate: date("birth_date"),
    gender: text("gender"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    smsOptIn: boolean("sms_opt_in").notNull().default(true),
    portalEnabled: boolean("portal_enabled").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (t) => [index("customers_name_idx").on(t.name)],
);

export const measurementProfiles = pgTable(
  "measurement_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    displayName: text("display_name").notNull(),
    relation: text("relation"),
    gender: text("gender"),
    birthDate: date("birth_date"),
    bodyNotes: text("body_notes"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [index("profiles_customer_idx").on(t.customerId)],
);

/* ---------------------------------------------------------- garment types */

export const garmentTypes = pgTable(
  "garment_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    nameBn: text("name_bn").notNull(),
    nameEn: text("name_en").notNull(),
    category: text("category").notNull().default("gents"), // gents | ladies | kids | unisex
    measurementSchema: jsonb("measurement_schema").notNull(),
    styleSchema: jsonb("style_schema").notNull().default({ options: [] }),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull().default("0"),
    defaultDeliveryDays: integer("default_delivery_days").notNull().default(7),
    defaultFabricEstimate: numeric("default_fabric_estimate", { precision: 6, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    schemaVersion: integer("schema_version").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index("garment_types_active_idx").on(t.isActive)],
);

/* --------------------------------------------------- measurement sets (v) */

export const measurementSets = pgTable(
  "measurement_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => measurementProfiles.id),
    garmentTypeId: uuid("garment_type_id")
      .notNull()
      .references(() => garmentTypes.id),
    version: integer("version").notNull(),
    values: jsonb("values").notNull().default({}),
    styles: jsonb("styles").notNull().default({}),
    unitEntered: text("unit_entered").notNull().default("inch"), // inch | cm
    source: text("source").notNull().default("in_store"),
    verified: boolean("verified").notNull().default(false),
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    measuredBy: uuid("measured_by"),
    measuredAt: timestamp("measured_at", { withTimezone: true }).defaultNow().notNull(),
    basedOnSetId: uuid("based_on_set_id"),
    changeNote: text("change_note"),
    notes: text("notes"),
    schemaVersion: integer("schema_version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("msets_profile_idx").on(t.profileId),
    index("msets_garment_idx").on(t.garmentTypeId),
    uniqueIndex("msets_profile_garment_version_uq").on(t.profileId, t.garmentTypeId, t.version),
  ],
);

/* ----------------------------------------------------------------- orders */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNo: text("order_no").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    type: text("type").notNull().default("new"), // new | alteration | repair | bulk
    status: text("status").notNull().default("draft"),
    priority: text("priority").notNull().default("normal"), // normal | urgent
    orderDate: date("order_date").notNull().defaultNow(),
    trialDate: date("trial_date"),
    deliveryDate: date("delivery_date").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    dueAmount: numeric("due_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    source: text("source").notNull().default("walk_in"), // walk_in | online | phone | appointment
    notes: text("notes"),
    trackingToken: text("tracking_token")
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    cancelledReason: text("cancelled_reason"),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_delivery_idx").on(t.deliveryDate),
    index("orders_customer_idx").on(t.customerId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    garmentTypeId: uuid("garment_type_id")
      .notNull()
      .references(() => garmentTypes.id),
    profileId: uuid("profile_id").references(() => measurementProfiles.id),
    measurementSetId: uuid("measurement_set_id").references(() => measurementSets.id),
    styleOverrides: jsonb("style_overrides").notNull().default({}),
    fabricSource: text("fabric_source").notNull().default("shop"), // shop | customer
    fabricQty: numeric("fabric_qty", { precision: 6, scale: 2 }),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    designNotes: text("design_notes"),
    status: text("status").notNull().default("confirmed"),
    createdAt,
    updatedAt,
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note"),
    changedBy: text("changed_by"),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("osh_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: text("method").notNull().default("cash"), // cash | bkash | nagad | rocket | card | bank
    txnId: text("txn_id"),
    senderNo: text("sender_no"),
    kind: text("kind").notNull().default("installment"), // advance | installment | final | refund
    receivedBy: text("received_by"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    receiptNo: text("receipt_no"),
    idempotencyKey: text("idempotency_key"),
    reversedOff: uuid("reversed_off"),
    createdAt,
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_customer_idx").on(t.customerId),
    uniqueIndex("payments_order_idempotency_uq").on(t.orderId, t.idempotencyKey),
  ],
);

/* ------------------------------------------------------- workers & tasks */

export const workers = pgTable(
  "workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone"),
    role: text("role").notNull().default("stitching"), // cutting | stitching | finishing
    skillTags: text("skill_tags").array().notNull().default(sql`'{}'`),
    payType: text("pay_type").notNull().default("piece_rate"),
    monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    joinedOn: date("joined_on"),
    createdAt,
    updatedAt,
  },
  (t) => [index("workers_role_idx").on(t.role), uniqueIndex("workers_user_id_uq").on(t.userId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    stage: text("stage").notNull(), // cutting | stitching | finishing | buttoning | alteration
    workerId: uuid("worker_id").references(() => workers.id),
    status: text("status").notNull().default("assigned"), // assigned | in_progress | done | qc_passed | rework
    pieceRate: numeric("piece_rate", { precision: 12, scale: 2 }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    qcNote: text("qc_note"),
    createdAt,
    updatedAt,
  },
  (t) => [index("tasks_worker_idx").on(t.workerId), index("tasks_status_idx").on(t.status)],
);

/* --------------------------------------------------- finance & inventory */

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull().defaultNow(),
  method: text("method").notNull().default("cash"),
  note: text("note"),
  enteredBy: text("entered_by"),
  createdAt,
});

export const fabrics = pgTable(
  "fabrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull().default("cotton"),
    color: text("color"),
    unit: text("unit").notNull().default("yard"), // yard | meter
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
    sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull().default("0"),
    stockQty: numeric("stock_qty", { precision: 10, scale: 2 }).notNull().default("0"),
    reorderLevel: numeric("reorder_level", { precision: 10, scale: 2 }).notNull().default("10"),
    supplier: text("supplier"),
    createdAt,
    updatedAt,
  },
  (t) => [index("fabrics_low_idx").on(t.stockQty)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").references(() => customers.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    purpose: text("purpose").notNull().default("নতুন মাপ"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("booked"), // booked | confirmed | done | no_show | cancelled
    locationType: text("location_type").notNull().default("shop"),
    address: text("address"),
    notes: text("notes"),
    createdAt,
    updatedAt,
  },
  (t) => [index("appts_start_idx").on(t.startsAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull().default("sms"), // sms | whatsapp | inapp
    recipient: text("recipient").notNull(),
    templateCode: text("template_code").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("queued"), // queued | sent | failed | delivered
    providerRef: text("provider_ref"),
    relatedOrderId: uuid("related_order_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [index("notif_order_idx").on(t.relatedOrderId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt,
});

/* ------------------------------------------------------------ type exports */

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type MeasurementProfile = typeof measurementProfiles.$inferSelect;
export type GarmentType = typeof garmentTypes.$inferSelect;
export type MeasurementSet = typeof measurementSets.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Worker = typeof workers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Fabric = typeof fabrics.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
