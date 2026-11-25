ALTER TABLE "appointments" ADD COLUMN "garments" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
DROP VIEW "public"."appointment_details";--> statement-breakpoint
CREATE VIEW "public"."appointment_details" AS (select a.*, p.name, coalesce(p.phone, '') as phone, c.id as customer_id from appointments a join people p on p.id = a.person_id left join customers c on c.person_id = a.person_id);
