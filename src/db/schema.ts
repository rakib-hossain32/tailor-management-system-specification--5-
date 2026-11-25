import { sql, type InferModelFromColumns } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, numeric, pgTable, pgView, primaryKey, text, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn, type PgColumn } from "drizzle-orm/pg-core";

/** Canonical entities are writable tables; flattened exports below are read-only views. */
const timestamps = () => ({ createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull() });
const created = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(), phone: text("phone"), altPhone: text("alt_phone"), email: text("email"),
  address: text("address"), birthDate: date("birth_date"), gender: text("gender"), bodyNotes: text("body_notes"), ...timestamps(),
}, (t) => [uniqueIndex("people_phone_uq").on(t.phone), uniqueIndex("people_email_uq").on(sql`lower(${t.email})`), index("people_name_idx").on(t.name),
  check("people_name_nonempty", sql`length(trim(${t.name})) > 0`), check("people_phone_e164", sql`${t.phone} is null or ${t.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
  check("people_alt_phone_e164", sql`${t.altPhone} is null or ${t.altPhone} ~ '^\\+[1-9][0-9]{7,14}$'`), check("people_email_canonical", sql`${t.email} is null or ${t.email} = lower(trim(${t.email}))`)]);

export const userAccounts = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(), personId: uuid("person_id").notNull().references(() => people.id), passwordHash: text("password_hash"),
  role: text("role").notNull().default("reception"), isActive: boolean("is_active").notNull().default(true), lastLoginAt: timestamp("last_login_at", { withTimezone: true }), ...timestamps(),
}, (t) => [uniqueIndex("users_person_uq").on(t.personId), index("users_role_idx").on(t.role)]);

export const customerAccounts = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(), personId: uuid("person_id").notNull().references(() => people.id), notes: text("notes"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`), smsOptIn: boolean("sms_opt_in").notNull().default(true), portalEnabled: boolean("portal_enabled").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true), ...timestamps(),
}, (t) => [uniqueIndex("customers_person_uq").on(t.personId)]);

export const workerProfiles = pgTable("workers", {
  id: uuid("id").primaryKey().defaultRandom(), personId: uuid("person_id").notNull().references(() => people.id), role: text("role").notNull().default("stitching"),
  skillTags: text("skill_tags").array().notNull().default(sql`'{}'::text[]`), payType: text("pay_type").notNull().default("piece_rate"), monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true), joinedOn: date("joined_on"), ...timestamps(),
}, (t) => [uniqueIndex("workers_person_uq").on(t.personId), index("workers_role_idx").on(t.role), check("workers_salary_nonnegative", sql`${t.monthlySalary} is null or ${t.monthlySalary} >= 0`)]);

export const profileMemberships = pgTable("measurement_profiles", {
  id: uuid("id").primaryKey().defaultRandom(), customerId: uuid("customer_id").notNull().references(() => customerAccounts.id), personId: uuid("person_id").notNull().references(() => people.id),
  alias: text("alias"), relation: text("relation"), isDefault: boolean("is_default").notNull().default(false), isActive: boolean("is_active").notNull().default(true), ...timestamps(),
}, (t) => [index("profiles_customer_idx").on(t.customerId), uniqueIndex("profiles_customer_person_uq").on(t.customerId, t.personId), uniqueIndex("profiles_default_uq").on(t.customerId).where(sql`${t.isDefault} and ${t.isActive}`)]);

export const garmentCatalog = pgTable("garment_types", {
  id: uuid("id").primaryKey().defaultRandom(), code: text("code").notNull().unique(), nameBn: text("name_bn").notNull(), nameEn: text("name_en").notNull(), category: text("category").notNull().default("gents"),
  activeSchemaVersionId: uuid("active_schema_version_id").references((): AnyPgColumn => garmentSchemaVersions.id), basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull().default("0"),
  defaultDeliveryDays: integer("default_delivery_days").notNull().default(7), defaultFabricEstimate: numeric("default_fabric_estimate", { precision: 6, scale: 2 }),
  isActive: boolean("is_active").notNull().default(false), sortOrder: integer("sort_order").notNull().default(0), ...timestamps(),
}, (t) => [index("garment_types_active_idx").on(t.isActive), check("garments_active_schema_required", sql`not ${t.isActive} or ${t.activeSchemaVersionId} is not null`),
  check("garments_price_nonnegative", sql`${t.basePrice} >= 0`), foreignKey({ name: "garment_active_schema_owner_fk", columns: [t.activeSchemaVersionId, t.id], foreignColumns: [garmentSchemaVersions.id, garmentSchemaVersions.garmentTypeId] })]);

export const garmentSchemaVersions = pgTable("garment_schema_versions", {
  id: uuid("id").primaryKey().defaultRandom(), garmentTypeId: uuid("garment_type_id").notNull().references((): AnyPgColumn => garmentCatalog.id), version: integer("version").notNull(),
  measurementSchema: jsonb("measurement_schema").notNull(), styleSchema: jsonb("style_schema").notNull().default({ options: [] }),
  createdByUserId: uuid("created_by_user_id").references(() => userAccounts.id), createdAt: created(),
}, (t) => [uniqueIndex("garment_schema_version_uq").on(t.garmentTypeId, t.version), unique("garment_schema_id_owner_uq").on(t.id, t.garmentTypeId), check("garment_schema_version_positive", sql`${t.version} > 0`)]);

/** Body values/styles are deliberate immutable historical observations, not copied person facts. */
export const measurementVersions = pgTable("measurement_sets", {
  id: uuid("id").primaryKey().defaultRandom(), profileId: uuid("profile_id").notNull().references(() => profileMemberships.id), garmentSchemaVersionId: uuid("garment_schema_version_id").notNull().references(() => garmentSchemaVersions.id),
  version: integer("version").notNull(), values: jsonb("values").notNull().default({}), styles: jsonb("styles").notNull().default({}), unitEntered: text("unit_entered").notNull().default("inch"), source: text("source").notNull().default("in_store"),
  verifiedBy: uuid("verified_by").references(() => userAccounts.id), verifiedAt: timestamp("verified_at", { withTimezone: true }), measuredBy: uuid("measured_by").references(() => userAccounts.id),
  measuredAt: timestamp("measured_at", { withTimezone: true }).defaultNow().notNull(), basedOnSetId: uuid("based_on_set_id").references((): AnyPgColumn => measurementVersions.id),
  changeNote: text("change_note"), notes: text("notes"), createdAt: created(),
}, (t) => [index("msets_profile_idx").on(t.profileId), index("msets_schema_idx").on(t.garmentSchemaVersionId), uniqueIndex("msets_profile_schema_version_uq").on(t.profileId, t.garmentSchemaVersionId, t.version),
  check("measurement_version_positive", sql`${t.version} > 0`), check("measurement_verification_complete", sql`(${t.verifiedAt} is null) = (${t.verifiedBy} is null)`)]);

export const orderRecords = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(), orderNo: text("order_no").notNull().unique(), customerId: uuid("customer_id").notNull().references(() => customerAccounts.id),
  type: text("type").notNull().default("new"), status: text("status").notNull().default("draft"), priority: text("priority").notNull().default("normal"), orderDate: date("order_date").notNull().defaultNow(),
  trialDate: date("trial_date"), deliveryDate: date("delivery_date").notNull(), discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"), source: text("source").notNull().default("walk_in"), notes: text("notes"),
  trackingToken: text("tracking_token").notNull().default(sql`gen_random_uuid()::text`), cancelledReason: text("cancelled_reason"), ...timestamps(),
}, (t) => [index("orders_status_idx").on(t.status), index("orders_delivery_idx").on(t.deliveryDate), index("orders_customer_idx").on(t.customerId), uniqueIndex("orders_tracking_token_uq").on(t.trackingToken), check("orders_discount_nonnegative", sql`${t.discount} >= 0`)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().references(() => orderRecords.id), garmentTypeId: uuid("garment_type_id").notNull().references(() => garmentCatalog.id),
  profileId: uuid("profile_id").references(() => profileMemberships.id), measurementSetId: uuid("measurement_set_id").references(() => measurementVersions.id), styleOverrides: jsonb("style_overrides").notNull().default({}),
  fabricSource: text("fabric_source").notNull().default("shop"), fabricQty: numeric("fabric_qty", { precision: 6, scale: 2 }), quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"), designNotes: text("design_notes"), status: text("status").notNull().default("confirmed"), ...timestamps(),
}, (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_quantity_positive", sql`${t.quantity} > 0`), check("order_items_price_nonnegative", sql`${t.unitPrice} >= 0`), check("order_items_fabric_nonnegative", sql`${t.fabricQty} is null or ${t.fabricQty} >= 0`)]);

export const orderEvents = pgTable("order_status_history", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().references(() => orderRecords.id), fromStatus: text("from_status"), toStatus: text("to_status").notNull(), note: text("note"),
  actorId: uuid("actor_id").references(() => userAccounts.id), changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("osh_order_idx").on(t.orderId)]);

export const paymentEntries = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().references(() => orderRecords.id), amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method").notNull().default("cash"), txnId: text("txn_id"), senderNo: text("sender_no"), kind: text("kind").notNull().default("installment"),
  receivedByUserId: uuid("received_by_user_id").references(() => userAccounts.id), receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(), receiptNo: text("receipt_no"), idempotencyKey: text("idempotency_key"),
  reversalOfId: uuid("reversal_of_id").references((): AnyPgColumn => paymentEntries.id), createdAt: created(),
}, (t) => [index("payments_order_idx").on(t.orderId), uniqueIndex("payments_order_idempotency_uq").on(t.orderId, t.idempotencyKey), uniqueIndex("payments_reversal_uq").on(t.reversalOfId),
  check("payments_amount_positive", sql`${t.amount} > 0`), check("payments_reversal_kind", sql`(${t.reversalOfId} is not null) = (${t.kind} = 'refund')`)]);

export const garmentStageRates = pgTable("garment_stage_rates", {
  id: uuid("id").primaryKey().defaultRandom(), garmentTypeId: uuid("garment_type_id").notNull().references(() => garmentCatalog.id), stage: text("stage").notNull(), version: integer("version").notNull(),
  pieceRate: numeric("piece_rate", { precision: 12, scale: 2 }).notNull(), createdByUserId: uuid("created_by_user_id").references(() => userAccounts.id), ...timestamps(),
}, (t) => [uniqueIndex("garment_stage_rate_version_uq").on(t.garmentTypeId, t.stage, t.version), check("garment_stage_rate_nonnegative", sql`${t.pieceRate} >= 0`), check("garment_stage_rate_version_positive", sql`${t.version} > 0`)]);

export const taskRecords = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(), orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id), rateVersionId: uuid("rate_version_id").notNull().references(() => garmentStageRates.id), workerId: uuid("worker_id").references(() => workerProfiles.id),
  status: text("status").notNull().default("assigned"), pieceRateOverride: numeric("piece_rate_override", { precision: 12, scale: 2 }), assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }), completedAt: timestamp("completed_at", { withTimezone: true }), qcNote: text("qc_note"), ...timestamps(),
}, (t) => [index("tasks_worker_idx").on(t.workerId), index("tasks_status_idx").on(t.status), check("tasks_rate_override_nonnegative", sql`${t.pieceRateOverride} is null or ${t.pieceRateOverride} >= 0`)]);

export const expenseRecords = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(), category: text("category").notNull(), amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), date: date("date").notNull().defaultNow(),
  method: text("method").notNull().default("cash"), note: text("note"), actorId: uuid("actor_id").references(() => userAccounts.id), isActive: boolean("is_active").notNull().default(true), ...timestamps(),
}, (t) => [check("expenses_amount_positive", sql`${t.amount} > 0`)]);

export const fabricRecords = pgTable("fabrics", {
  id: uuid("id").primaryKey().defaultRandom(), code: text("code").notNull().unique(), name: text("name").notNull(), type: text("type").notNull().default("cotton"), color: text("color"), unit: text("unit").notNull().default("yard"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"), sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull().default("0"),
  reorderLevel: numeric("reorder_level", { precision: 10, scale: 2 }).notNull().default("10"), supplier: text("supplier"), isActive: boolean("is_active").notNull().default(true), ...timestamps(),
}, (t) => [check("fabrics_prices_nonnegative", sql`${t.costPrice} >= 0 and ${t.sellPrice} >= 0 and ${t.reorderLevel} >= 0`)]);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(), fabricId: uuid("fabric_id").notNull().references(() => fabricRecords.id), qtyDelta: numeric("qty_delta", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(), actorId: uuid("actor_id").references(() => userAccounts.id), createdAt: created(),
}, (t) => [index("stock_movements_fabric_idx").on(t.fabricId), check("stock_movement_nonzero", sql`${t.qtyDelta} <> 0`)]);

export const appointmentRecords = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(), personId: uuid("person_id").notNull().references(() => people.id), purpose: text("purpose").notNull().default("নতুন মাপ"),
  garments: text("garments").array().notNull().default(sql`'{}'::text[]`),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(), endsAt: timestamp("ends_at", { withTimezone: true }).notNull(), status: text("status").notNull().default("booked"),
  locationType: text("location_type").notNull().default("shop"), address: text("address"), notes: text("notes"), ...timestamps(),
}, (t) => [index("appts_start_idx").on(t.startsAt), check("appointments_positive_duration", sql`${t.endsAt} > ${t.startsAt}`)]);

/** Notification destinations/bodies are historical delivery events. */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(), channel: text("channel").notNull().default("sms"), recipient: text("recipient").notNull(), templateCode: text("template_code").notNull(), body: text("body").notNull(),
  status: text("status").notNull().default("queued"), providerRef: text("provider_ref"), relatedOrderId: uuid("related_order_id").references(() => orderRecords.id), sentAt: timestamp("sent_at", { withTimezone: true }), createdAt: created(),
}, (t) => [index("notif_order_idx").on(t.relatedOrderId)]);

export const settings = pgTable("settings", { key: text("key").primaryKey(), value: jsonb("value").notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull() });

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(), actorId: uuid("actor_id").references(() => userAccounts.id), action: text("action").notNull(), entity: text("entity").notNull(), entityId: text("entity_id"),
  details: jsonb("details").notNull().default({}), createdAt: created(),
}, (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_actor_idx").on(t.actorId)]);

export const orderDrafts = pgTable("order_drafts", {
  userId: uuid("user_id").primaryKey().references(() => userAccounts.id), customerId: uuid("customer_id").references(() => customerAccounts.id), profileId: uuid("profile_id").references(() => profileMemberships.id),
  payload: jsonb("payload").notNull().default({}), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderDraftItems = pgTable("order_draft_items", {
  id: uuid("id").primaryKey().defaultRandom(), draftUserId: uuid("draft_user_id").notNull().references(() => orderDrafts.userId, { onDelete: "cascade" }), position: integer("position").notNull(),
  garmentTypeId: uuid("garment_type_id").notNull().references(() => garmentCatalog.id), measurementSetId: uuid("measurement_set_id").references(() => measurementVersions.id),
  quantity: integer("quantity").notNull().default(1), unitPrice: numeric("unit_price", { precision: 12, scale: 2 }), fabricSource: text("fabric_source").notNull().default("shop"), fabricQty: numeric("fabric_qty", { precision: 6, scale: 2 }),
  notes: text("notes"), styleOverrides: jsonb("style_overrides").notNull().default({}),
}, (t) => [uniqueIndex("draft_item_position_uq").on(t.draftUserId, t.position), check("draft_item_quantity_positive", sql`${t.quantity} > 0`), check("draft_item_price_nonnegative", sql`${t.unitPrice} is null or ${t.unitPrice} >= 0`)]);

export const orderDraftAssignments = pgTable("order_draft_assignments", {
  draftUserId: uuid("draft_user_id").notNull().references(() => orderDrafts.userId, { onDelete: "cascade" }), stage: text("stage").notNull(), workerId: uuid("worker_id").references(() => workerProfiles.id),
}, (t) => [primaryKey({ columns: [t.draftUserId, t.stage] })]);

/** Keep legacy select types while intentionally rejecting writes to read views. */
function readable<T extends { _: { selectedFields: Record<string, PgColumn> } }>(view: T): T & { readonly $inferSelect: InferModelFromColumns<T["_"]["selectedFields"]> } {
  return view as T & { readonly $inferSelect: InferModelFromColumns<T["_"]["selectedFields"]> };
}

export const users = readable(pgView("user_details", {
  id: uuid("id").notNull(), personId: uuid("person_id").notNull(), name: text("name").notNull(), phone: text("phone").notNull(), email: text("email"), passwordHash: text("password_hash"),
  role: text("role").notNull(), isActive: boolean("is_active").notNull(), lastLoginAt: timestamp("last_login_at", { withTimezone: true }), ...timestamps(),
}).as(sql`select u.*, p.name, coalesce(p.phone, '') as phone, p.email from users u join people p on p.id = u.person_id`));

export const customers = readable(pgView("customer_details", {
  id: uuid("id").notNull(), personId: uuid("person_id").notNull(), name: text("name").notNull(), phone: text("phone").notNull(), altPhone: text("alt_phone"), email: text("email"),
  address: text("address"), birthDate: date("birth_date"), gender: text("gender"), notes: text("notes"), tags: text("tags").array().notNull(),
  smsOptIn: boolean("sms_opt_in").notNull(), portalEnabled: boolean("portal_enabled").notNull(), isActive: boolean("is_active").notNull(), ...timestamps(),
}).as(sql`select c.*, p.name, coalesce(p.phone, '') as phone, p.alt_phone, p.email, p.address, p.birth_date, p.gender from customers c join people p on p.id = c.person_id`));

export const workers = readable(pgView("worker_details", {
  id: uuid("id").notNull(), personId: uuid("person_id").notNull(), userId: uuid("user_id"), name: text("name").notNull(), phone: text("phone"), role: text("role").notNull(),
  skillTags: text("skill_tags").array().notNull(), payType: text("pay_type").notNull(), monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").notNull(), joinedOn: date("joined_on"), ...timestamps(),
}).as(sql`select w.*, p.name, p.phone, u.id as user_id from workers w join people p on p.id = w.person_id left join users u on u.person_id = w.person_id`));

export const measurementProfiles = readable(pgView("profile_details", {
  id: uuid("id").notNull(), customerId: uuid("customer_id").notNull(), personId: uuid("person_id").notNull(), displayName: text("display_name").notNull(), relation: text("relation"),
  gender: text("gender"), birthDate: date("birth_date"), bodyNotes: text("body_notes"), isDefault: boolean("is_default").notNull(), isActive: boolean("is_active").notNull(), ...timestamps(),
}).as(sql`select m.*, coalesce(nullif(m.alias, ''), case when m.relation = 'self' then 'নিজে' else p.name end) as display_name,
  p.gender, p.birth_date, p.body_notes from measurement_profiles m join people p on p.id = m.person_id`));

export const garmentTypes = readable(pgView("garment_details", {
  id: uuid("id").notNull(), code: text("code").notNull(), nameBn: text("name_bn").notNull(), nameEn: text("name_en").notNull(), category: text("category").notNull(),
  activeSchemaVersionId: uuid("active_schema_version_id").notNull(), measurementSchema: jsonb("measurement_schema").notNull(), styleSchema: jsonb("style_schema").notNull(),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(), defaultDeliveryDays: integer("default_delivery_days").notNull(), defaultFabricEstimate: numeric("default_fabric_estimate", { precision: 6, scale: 2 }),
  isActive: boolean("is_active").notNull(), schemaVersion: integer("schema_version").notNull(), sortOrder: integer("sort_order").notNull(), ...timestamps(),
}).as(sql`select g.*, v.measurement_schema, v.style_schema, v.version as schema_version from garment_types g join garment_schema_versions v on v.id = g.active_schema_version_id`));

export const measurementSets = readable(pgView("measurement_details", {
  id: uuid("id").notNull(), profileId: uuid("profile_id").notNull(), garmentTypeId: uuid("garment_type_id").notNull(), garmentSchemaVersionId: uuid("garment_schema_version_id").notNull(),
  version: integer("version").notNull(), values: jsonb("values").notNull(), styles: jsonb("styles").notNull(), unitEntered: text("unit_entered").notNull(), source: text("source").notNull(),
  verified: boolean("verified").notNull(), verifiedBy: uuid("verified_by"), verifiedAt: timestamp("verified_at", { withTimezone: true }), measuredBy: uuid("measured_by"), measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
  basedOnSetId: uuid("based_on_set_id"), changeNote: text("change_note"), notes: text("notes"), schemaVersion: integer("schema_version").notNull(), isCurrent: boolean("is_current").notNull(), ...timestamps(),
}).as(sql`select m.*, s.garment_type_id, s.version as schema_version, (m.verified_at is not null) as verified, m.created_at as updated_at,
  not exists (select 1 from measurement_sets newer join garment_schema_versions ns on ns.id = newer.garment_schema_version_id
    where newer.profile_id = m.profile_id and ns.garment_type_id = s.garment_type_id and newer.version > m.version) as is_current
  from measurement_sets m join garment_schema_versions s on s.id = m.garment_schema_version_id`));

export const orders = readable(pgView("order_summaries", {
  id: uuid("id").notNull(), orderNo: text("order_no").notNull(), customerId: uuid("customer_id").notNull(), type: text("type").notNull(), status: text("status").notNull(), priority: text("priority").notNull(),
  orderDate: date("order_date").notNull(), trialDate: date("trial_date"), deliveryDate: date("delivery_date").notNull(), subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull(), total: numeric("total", { precision: 12, scale: 2 }).notNull(), paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull(), dueAmount: numeric("due_amount", { precision: 12, scale: 2 }).notNull(),
  source: text("source").notNull(), notes: text("notes"), trackingToken: text("tracking_token").notNull(), cancelledReason: text("cancelled_reason"), ...timestamps(),
}).as(sql`select o.*, line.subtotal, greatest(line.subtotal - o.discount, 0)::numeric(12,2) as total, ledger.paid_amount,
  (greatest(line.subtotal - o.discount, 0) - ledger.paid_amount)::numeric(12,2) as due_amount from orders o
  cross join lateral (select coalesce(sum(i.quantity * i.unit_price), 0)::numeric(12,2) as subtotal from order_items i where i.order_id = o.id) line
  cross join lateral (select coalesce(sum(case when p.reversal_of_id is null then p.amount else -p.amount end), 0)::numeric(12,2) as paid_amount from payments p where p.order_id = o.id) ledger`));

export const orderStatusHistory = readable(pgView("order_event_details", {
  id: uuid("id").notNull(), orderId: uuid("order_id").notNull(), fromStatus: text("from_status"), toStatus: text("to_status").notNull(), note: text("note"), actorId: uuid("actor_id"), changedBy: text("changed_by"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
}).as(sql`select h.*, p.name as changed_by from order_status_history h left join users u on u.id = h.actor_id left join people p on p.id = u.person_id`));

export const payments = readable(pgView("payment_details", {
  id: uuid("id").notNull(), orderId: uuid("order_id").notNull(), customerId: uuid("customer_id").notNull(), amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), method: text("method").notNull(), txnId: text("txn_id"), senderNo: text("sender_no"), kind: text("kind").notNull(),
  receivedByUserId: uuid("received_by_user_id"), receivedBy: text("received_by"), receivedAt: timestamp("received_at", { withTimezone: true }).notNull(), receiptNo: text("receipt_no"), idempotencyKey: text("idempotency_key"),
  reversalOfId: uuid("reversal_of_id"), reversedOff: uuid("reversed_off"), createdAt: created(),
}).as(sql`select entry.*, o.customer_id, p.name as received_by, entry.reversal_of_id as reversed_off from payments entry join orders o on o.id = entry.order_id
  left join users u on u.id = entry.received_by_user_id left join people p on p.id = u.person_id`));

export const expenses = readable(pgView("expense_details", {
  id: uuid("id").notNull(), category: text("category").notNull(), amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), date: date("date").notNull(), method: text("method").notNull(), note: text("note"),
  actorId: uuid("actor_id"), enteredBy: text("entered_by"), isActive: boolean("is_active").notNull(), ...timestamps(),
}).as(sql`select e.*, p.name as entered_by from expenses e left join users u on u.id = e.actor_id left join people p on p.id = u.person_id where e.is_active`));

export const fabrics = readable(pgView("fabric_details", {
  id: uuid("id").notNull(), code: text("code").notNull(), name: text("name").notNull(), type: text("type").notNull(), color: text("color"), unit: text("unit").notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(), sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull(), stockQty: numeric("stock_qty", { precision: 12, scale: 2 }).notNull(),
  reorderLevel: numeric("reorder_level", { precision: 10, scale: 2 }).notNull(), supplier: text("supplier"), isActive: boolean("is_active").notNull(), ...timestamps(),
}).as(sql`select f.*, coalesce((select sum(m.qty_delta) from stock_movements m where m.fabric_id = f.id), 0)::numeric(12,2) as stock_qty from fabrics f`));

export const appointments = readable(pgView("appointment_details", {
  id: uuid("id").notNull(), personId: uuid("person_id").notNull(), customerId: uuid("customer_id"), name: text("name").notNull(), phone: text("phone").notNull(), purpose: text("purpose").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(), endsAt: timestamp("ends_at", { withTimezone: true }).notNull(), status: text("status").notNull(), locationType: text("location_type").notNull(), address: text("address"), notes: text("notes"), ...timestamps(),
}).as(sql`select a.*, p.name, coalesce(p.phone, '') as phone, c.id as customer_id from appointments a join people p on p.id = a.person_id left join customers c on c.person_id = a.person_id`));

export const tasks = readable(pgView("task_details", {
  id: uuid("id").notNull(), orderItemId: uuid("order_item_id").notNull(), rateVersionId: uuid("rate_version_id").notNull(), stage: text("stage").notNull(), workerId: uuid("worker_id"),
  status: text("status").notNull(), pieceRate: numeric("piece_rate", { precision: 12, scale: 2 }).notNull(), pieceRateOverride: numeric("piece_rate_override", { precision: 12, scale: 2 }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(), startedAt: timestamp("started_at", { withTimezone: true }), completedAt: timestamp("completed_at", { withTimezone: true }), qcNote: text("qc_note"), ...timestamps(),
}).as(sql`select t.*, r.stage, coalesce(t.piece_rate_override, r.piece_rate) as piece_rate from tasks t join garment_stage_rates r on r.id = t.rate_version_id`));

export type Person = typeof people.$inferSelect;
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

export * from "./content-schema";
