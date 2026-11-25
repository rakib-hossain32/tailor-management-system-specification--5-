CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"purpose" text DEFAULT 'নতুন মাপ' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"location_type" text DEFAULT 'shop' NOT NULL,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_positive_duration" CHECK ("appointments"."ends_at" > "appointments"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"sms_opt_in" boolean DEFAULT true NOT NULL,
	"portal_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date DEFAULT now() NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"note" text,
	"actor_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "fabrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'cotton' NOT NULL,
	"color" text,
	"unit" text DEFAULT 'yard' NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sell_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(10, 2) DEFAULT '10' NOT NULL,
	"supplier" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fabrics_code_unique" UNIQUE("code"),
	CONSTRAINT "fabrics_prices_nonnegative" CHECK ("fabrics"."cost_price" >= 0 and "fabrics"."sell_price" >= 0 and "fabrics"."reorder_level" >= 0)
);
--> statement-breakpoint
CREATE TABLE "garment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"category" text DEFAULT 'gents' NOT NULL,
	"active_schema_version_id" uuid,
	"base_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"default_delivery_days" integer DEFAULT 7 NOT NULL,
	"default_fabric_estimate" numeric(6, 2),
	"is_active" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garment_types_code_unique" UNIQUE("code"),
	CONSTRAINT "garments_active_schema_required" CHECK (not "garment_types"."is_active" or "garment_types"."active_schema_version_id" is not null),
	CONSTRAINT "garments_price_nonnegative" CHECK ("garment_types"."base_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "garment_schema_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_type_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"measurement_schema" jsonb NOT NULL,
	"style_schema" jsonb DEFAULT '{"options":[]}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garment_schema_id_owner_uq" UNIQUE("id","garment_type_id"),
	CONSTRAINT "garment_schema_version_positive" CHECK ("garment_schema_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "garment_stage_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_type_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"version" integer NOT NULL,
	"piece_rate" numeric(12, 2) NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garment_stage_rate_nonnegative" CHECK ("garment_stage_rates"."piece_rate" >= 0),
	CONSTRAINT "garment_stage_rate_version_positive" CHECK ("garment_stage_rates"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "measurement_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"garment_schema_version_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"styles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unit_entered" text DEFAULT 'inch' NOT NULL,
	"source" text DEFAULT 'in_store' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"measured_by" uuid,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"based_on_set_id" uuid,
	"change_note" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_version_positive" CHECK ("measurement_sets"."version" > 0),
	CONSTRAINT "measurement_verification_complete" CHECK (("measurement_sets"."verified_at" is null) = ("measurement_sets"."verified_by" is null))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"recipient" text NOT NULL,
	"template_code" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_ref" text,
	"related_order_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_draft_assignments" (
	"draft_user_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"worker_id" uuid,
	CONSTRAINT "order_draft_assignments_draft_user_id_stage_pk" PRIMARY KEY("draft_user_id","stage")
);
--> statement-breakpoint
CREATE TABLE "order_draft_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_user_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"garment_type_id" uuid NOT NULL,
	"measurement_set_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2),
	"fabric_source" text DEFAULT 'shop' NOT NULL,
	"fabric_qty" numeric(6, 2),
	"notes" text,
	"style_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "draft_item_quantity_positive" CHECK ("order_draft_items"."quantity" > 0),
	CONSTRAINT "draft_item_price_nonnegative" CHECK ("order_draft_items"."unit_price" is null or "order_draft_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_drafts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"profile_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"actor_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"garment_type_id" uuid NOT NULL,
	"profile_id" uuid,
	"measurement_set_id" uuid,
	"style_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fabric_source" text DEFAULT 'shop' NOT NULL,
	"fabric_qty" numeric(6, 2),
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"design_notes" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_price_nonnegative" CHECK ("order_items"."unit_price" >= 0),
	CONSTRAINT "order_items_fabric_nonnegative" CHECK ("order_items"."fabric_qty" is null or "order_items"."fabric_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" text DEFAULT 'new' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"order_date" date DEFAULT now() NOT NULL,
	"trial_date" date,
	"delivery_date" date NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"source" text DEFAULT 'walk_in' NOT NULL,
	"notes" text,
	"tracking_token" text DEFAULT gen_random_uuid()::text NOT NULL,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no"),
	CONSTRAINT "orders_discount_nonnegative" CHECK ("orders"."discount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"txn_id" text,
	"sender_no" text,
	"kind" text DEFAULT 'installment' NOT NULL,
	"received_by_user_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"receipt_no" text,
	"idempotency_key" text,
	"reversal_of_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_reversal_kind" CHECK (("payments"."reversal_of_id" is not null) = ("payments"."kind" = 'refund'))
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"alt_phone" text,
	"email" text,
	"address" text,
	"birth_date" date,
	"gender" text,
	"body_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_name_nonempty" CHECK (length(trim("people"."name")) > 0),
	CONSTRAINT "people_phone_e164" CHECK ("people"."phone" is null or "people"."phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "people_alt_phone_e164" CHECK ("people"."alt_phone" is null or "people"."alt_phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "people_email_canonical" CHECK ("people"."email" is null or "people"."email" = lower(trim("people"."email")))
);
--> statement-breakpoint
CREATE TABLE "measurement_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"alias" text,
	"relation" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fabric_id" uuid NOT NULL,
	"qty_delta" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_nonzero" CHECK ("stock_movements"."qty_delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"rate_version_id" uuid NOT NULL,
	"worker_id" uuid,
	"status" text DEFAULT 'assigned' NOT NULL,
	"piece_rate_override" numeric(12, 2),
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"qc_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_rate_override_nonnegative" CHECK ("tasks"."piece_rate_override" is null or "tasks"."piece_rate_override" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'reception' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text DEFAULT 'stitching' NOT NULL,
	"skill_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"pay_type" text DEFAULT 'piece_rate' NOT NULL,
	"monthly_salary" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workers_salary_nonnegative" CHECK ("workers"."monthly_salary" is null or "workers"."monthly_salary" >= 0)
);
--> statement-breakpoint
CREATE TABLE "gallery_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"title" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"sha256" text,
	"cloudinary_public_id" text,
	"secure_url" text,
	"original_file_name" text NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"format" text,
	"alt_text" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_key_unique" UNIQUE("key"),
	CONSTRAINT "media_assets_sha256_unique" UNIQUE("sha256"),
	CONSTRAINT "media_assets_cloudinary_public_id_unique" UNIQUE("cloudinary_public_id"),
	CONSTRAINT "media_status_valid" CHECK ("media_assets"."status" in ('pending', 'ready', 'archived')),
	CONSTRAINT "media_ready_reference" CHECK ("media_assets"."status" <> 'ready' OR ("media_assets"."cloudinary_public_id" IS NOT NULL AND "media_assets"."secure_url" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "service_details" (
	"garment_type_id" uuid PRIMARY KEY NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"features" text[] DEFAULT '{}' NOT NULL,
	"media_asset_id" uuid,
	"featured" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_hours" (
	"shop_id" integer DEFAULT 1 NOT NULL,
	"weekday" integer NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"opens_at_minute" integer DEFAULT 600 NOT NULL,
	"closes_at_minute" integer DEFAULT 1260 NOT NULL,
	"slot_minutes" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "shop_hours_shop_id_weekday_pk" PRIMARY KEY("shop_id","weekday"),
	CONSTRAINT "shop_weekday_valid" CHECK ("shop_hours"."weekday" between 0 and 6),
	CONSTRAINT "shop_hours_valid" CHECK ("shop_hours"."opens_at_minute" >= 0 AND "shop_hours"."closes_at_minute" <= 1440 AND "shop_hours"."opens_at_minute" < "shop_hours"."closes_at_minute" AND "shop_hours"."slot_minutes" between 5 and 120)
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name_bn" text DEFAULT 'TailorPro' NOT NULL,
	"name_en" text DEFAULT 'TailorPro' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"facebook_url" text DEFAULT '' NOT NULL,
	"founded_year" integer,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	"currency" text DEFAULT 'BDT' NOT NULL,
	"invoice_footer" text DEFAULT '' NOT NULL,
	"logo_asset_id" uuid,
	"hero_asset_id" uuid,
	"about_asset_id" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_singleton" CHECK ("shop_settings"."id" = 1),
	CONSTRAINT "shop_founded_year_valid" CHECK ("shop_settings"."founded_year" IS NULL OR "shop_settings"."founded_year" between 1800 and 2200)
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_slug" text NOT NULL,
	"kind" text NOT NULL,
	"heading" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"media_asset_id" uuid,
	"person_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garment_types" ADD CONSTRAINT "garment_types_active_schema_version_id_garment_schema_versions_id_fk" FOREIGN KEY ("active_schema_version_id") REFERENCES "public"."garment_schema_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garment_types" ADD CONSTRAINT "garment_active_schema_owner_fk" FOREIGN KEY ("active_schema_version_id","id") REFERENCES "public"."garment_schema_versions"("id","garment_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garment_schema_versions" ADD CONSTRAINT "garment_schema_versions_garment_type_id_garment_types_id_fk" FOREIGN KEY ("garment_type_id") REFERENCES "public"."garment_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garment_schema_versions" ADD CONSTRAINT "garment_schema_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garment_stage_rates" ADD CONSTRAINT "garment_stage_rates_garment_type_id_garment_types_id_fk" FOREIGN KEY ("garment_type_id") REFERENCES "public"."garment_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garment_stage_rates" ADD CONSTRAINT "garment_stage_rates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_sets" ADD CONSTRAINT "measurement_sets_profile_id_measurement_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."measurement_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_sets" ADD CONSTRAINT "measurement_sets_garment_schema_version_id_garment_schema_versions_id_fk" FOREIGN KEY ("garment_schema_version_id") REFERENCES "public"."garment_schema_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_sets" ADD CONSTRAINT "measurement_sets_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_sets" ADD CONSTRAINT "measurement_sets_measured_by_users_id_fk" FOREIGN KEY ("measured_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_sets" ADD CONSTRAINT "measurement_sets_based_on_set_id_measurement_sets_id_fk" FOREIGN KEY ("based_on_set_id") REFERENCES "public"."measurement_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft_assignments" ADD CONSTRAINT "order_draft_assignments_draft_user_id_order_drafts_user_id_fk" FOREIGN KEY ("draft_user_id") REFERENCES "public"."order_drafts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft_assignments" ADD CONSTRAINT "order_draft_assignments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft_items" ADD CONSTRAINT "order_draft_items_draft_user_id_order_drafts_user_id_fk" FOREIGN KEY ("draft_user_id") REFERENCES "public"."order_drafts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft_items" ADD CONSTRAINT "order_draft_items_garment_type_id_garment_types_id_fk" FOREIGN KEY ("garment_type_id") REFERENCES "public"."garment_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft_items" ADD CONSTRAINT "order_draft_items_measurement_set_id_measurement_sets_id_fk" FOREIGN KEY ("measurement_set_id") REFERENCES "public"."measurement_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_profile_id_measurement_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."measurement_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_garment_type_id_garment_types_id_fk" FOREIGN KEY ("garment_type_id") REFERENCES "public"."garment_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_profile_id_measurement_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."measurement_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_measurement_set_id_measurement_sets_id_fk" FOREIGN KEY ("measurement_set_id") REFERENCES "public"."measurement_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversal_of_id_payments_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_profiles" ADD CONSTRAINT "measurement_profiles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_profiles" ADD CONSTRAINT "measurement_profiles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_rate_version_id_garment_stage_rates_id_fk" FOREIGN KEY ("rate_version_id") REFERENCES "public"."garment_stage_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_entries" ADD CONSTRAINT "gallery_entries_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_entries" ADD CONSTRAINT "gallery_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_details" ADD CONSTRAINT "service_details_garment_type_id_garment_types_id_fk" FOREIGN KEY ("garment_type_id") REFERENCES "public"."garment_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_details" ADD CONSTRAINT "service_details_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_details" ADD CONSTRAINT "service_details_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_hours" ADD CONSTRAINT "shop_hours_shop_id_shop_settings_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_logo_asset_id_media_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_hero_asset_id_media_assets_id_fk" FOREIGN KEY ("hero_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_about_asset_id_media_assets_id_fk" FOREIGN KEY ("about_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_page_slug_site_pages_slug_fk" FOREIGN KEY ("page_slug") REFERENCES "public"."site_pages"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appts_start_idx" ON "appointments" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_person_uq" ON "customers" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "garment_types_active_idx" ON "garment_types" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "garment_schema_version_uq" ON "garment_schema_versions" USING btree ("garment_type_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "garment_stage_rate_version_uq" ON "garment_stage_rates" USING btree ("garment_type_id","stage","version");--> statement-breakpoint
CREATE INDEX "msets_profile_idx" ON "measurement_sets" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "msets_schema_idx" ON "measurement_sets" USING btree ("garment_schema_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "msets_profile_schema_version_uq" ON "measurement_sets" USING btree ("profile_id","garment_schema_version_id","version");--> statement-breakpoint
CREATE INDEX "notif_order_idx" ON "notifications" USING btree ("related_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_item_position_uq" ON "order_draft_items" USING btree ("draft_user_id","position");--> statement-breakpoint
CREATE INDEX "osh_order_idx" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_delivery_idx" ON "orders" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tracking_token_uq" ON "orders" USING btree ("tracking_token");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_idempotency_uq" ON "payments" USING btree ("order_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reversal_uq" ON "payments" USING btree ("reversal_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_phone_uq" ON "people" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "people_email_uq" ON "people" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "people_name_idx" ON "people" USING btree ("name");--> statement-breakpoint
CREATE INDEX "profiles_customer_idx" ON "measurement_profiles" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_customer_person_uq" ON "measurement_profiles" USING btree ("customer_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_default_uq" ON "measurement_profiles" USING btree ("customer_id") WHERE "measurement_profiles"."is_default" and "measurement_profiles"."is_active";--> statement-breakpoint
CREATE INDEX "stock_movements_fabric_idx" ON "stock_movements" USING btree ("fabric_id");--> statement-breakpoint
CREATE INDEX "tasks_worker_idx" ON "tasks" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_person_uq" ON "users" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "workers_person_uq" ON "workers" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "workers_role_idx" ON "workers" USING btree ("role");--> statement-breakpoint
CREATE INDEX "gallery_position_idx" ON "gallery_entries" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "gallery_asset_uq" ON "gallery_entries" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "media_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "site_sections_page_idx" ON "site_sections" USING btree ("page_slug","position");--> statement-breakpoint
CREATE UNIQUE INDEX "site_sections_position_uq" ON "site_sections" USING btree ("page_slug","position");--> statement-breakpoint
CREATE VIEW "public"."appointment_details" AS (select a.*, p.name, coalesce(p.phone, '') as phone, c.id as customer_id from appointments a join people p on p.id = a.person_id left join customers c on c.person_id = a.person_id);--> statement-breakpoint
CREATE VIEW "public"."customer_details" AS (select c.*, p.name, coalesce(p.phone, '') as phone, p.alt_phone, p.email, p.address, p.birth_date, p.gender from customers c join people p on p.id = c.person_id);--> statement-breakpoint
CREATE VIEW "public"."expense_details" AS (select e.*, p.name as entered_by from expenses e left join users u on u.id = e.actor_id left join people p on p.id = u.person_id where e.is_active);--> statement-breakpoint
CREATE VIEW "public"."fabric_details" AS (select f.*, coalesce((select sum(m.qty_delta) from stock_movements m where m.fabric_id = f.id), 0)::numeric(12,2) as stock_qty from fabrics f);--> statement-breakpoint
CREATE VIEW "public"."garment_details" AS (select g.*, v.measurement_schema, v.style_schema, v.version as schema_version from garment_types g join garment_schema_versions v on v.id = g.active_schema_version_id);--> statement-breakpoint
CREATE VIEW "public"."profile_details" AS (select m.*, coalesce(nullif(m.alias, ''), case when m.relation = 'self' then 'নিজে' else p.name end) as display_name,
  p.gender, p.birth_date, p.body_notes from measurement_profiles m join people p on p.id = m.person_id);--> statement-breakpoint
CREATE VIEW "public"."measurement_details" AS (select m.*, s.garment_type_id, s.version as schema_version, (m.verified_at is not null) as verified, m.created_at as updated_at,
  not exists (select 1 from measurement_sets newer join garment_schema_versions ns on ns.id = newer.garment_schema_version_id
    where newer.profile_id = m.profile_id and ns.garment_type_id = s.garment_type_id and newer.version > m.version) as is_current
  from measurement_sets m join garment_schema_versions s on s.id = m.garment_schema_version_id);--> statement-breakpoint
CREATE VIEW "public"."order_event_details" AS (select h.*, p.name as changed_by from order_status_history h left join users u on u.id = h.actor_id left join people p on p.id = u.person_id);--> statement-breakpoint
CREATE VIEW "public"."order_summaries" AS (select o.*, line.subtotal, greatest(line.subtotal - o.discount, 0)::numeric(12,2) as total, ledger.paid_amount,
  (greatest(line.subtotal - o.discount, 0) - ledger.paid_amount)::numeric(12,2) as due_amount from orders o
  cross join lateral (select coalesce(sum(i.quantity * i.unit_price), 0)::numeric(12,2) as subtotal from order_items i where i.order_id = o.id) line
  cross join lateral (select coalesce(sum(case when p.reversal_of_id is null then p.amount else -p.amount end), 0)::numeric(12,2) as paid_amount from payments p where p.order_id = o.id) ledger);--> statement-breakpoint
CREATE VIEW "public"."payment_details" AS (select entry.*, o.customer_id, p.name as received_by, entry.reversal_of_id as reversed_off from payments entry join orders o on o.id = entry.order_id
  left join users u on u.id = entry.received_by_user_id left join people p on p.id = u.person_id);--> statement-breakpoint
CREATE VIEW "public"."task_details" AS (select t.*, r.stage, coalesce(t.piece_rate_override, r.piece_rate) as piece_rate from tasks t join garment_stage_rates r on r.id = t.rate_version_id);--> statement-breakpoint
CREATE VIEW "public"."user_details" AS (select u.*, p.name, coalesce(p.phone, '') as phone, p.email from users u join people p on p.id = u.person_id);--> statement-breakpoint
CREATE VIEW "public"."worker_details" AS (select w.*, p.name, p.phone, u.id as user_id from workers w join people p on p.id = w.person_id left join users u on u.person_id = w.person_id);