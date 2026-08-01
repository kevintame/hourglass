CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_key" varchar(420) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_attempts_key_time_idx" ON "login_attempts" USING btree ("attempt_key","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "single_owner" ON "users" USING btree ((true));--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tax_valid" CHECK ("clients"."tax_bps" is null or "clients"."tax_bps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_terms_valid" CHECK ("clients"."payment_terms_days" is null or "clients"."payment_terms_days" >= 0);--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_values_valid" CHECK ("invoice_lines"."quantity" > 0 and "invoice_lines"."unit_amount" >= 0 and "invoice_lines"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amounts_valid" CHECK ("invoices"."subtotal" >= 0 and "invoices"."tax_amount" >= 0 and "invoices"."total" = "invoices"."subtotal" + "invoices"."tax_amount");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tax_valid" CHECK ("invoices"."tax_bps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dates_valid" CHECK ("invoices"."due_date" >= "invoices"."issue_date");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_rate_valid" CHECK ("projects"."hourly_rate" >= 0);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_tax_valid" CHECK ("settings"."tax_bps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_terms_valid" CHECK ("settings"."payment_terms_days" >= 0);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_valid_range" CHECK (("time_entries"."ended_at" is null and "time_entries"."duration_seconds" is null) or ("time_entries"."ended_at" > "time_entries"."started_at" and "time_entries"."duration_seconds" > 0));