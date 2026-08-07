CREATE TYPE "public"."expense_category" AS ENUM('airfare', 'lodging', 'meals', 'ground_transport', 'mileage', 'supplies', 'other');--> statement-breakpoint
ALTER TYPE "public"."line_kind" ADD VALUE 'expense';--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"project_id" integer,
	"expense_date" date NOT NULL,
	"category" "expense_category" NOT NULL,
	"vendor" varchar(160) DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"taxable" boolean DEFAULT false NOT NULL,
	"receipt_filename" varchar(120),
	"receipt_original_name" varchar(255),
	"receipt_mime_type" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_valid" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_expenses" (
	"invoice_id" integer NOT NULL,
	"expense_id" integer NOT NULL,
	CONSTRAINT "invoice_expenses_invoice_id_expense_id_pk" PRIMARY KEY("invoice_id","expense_id")
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "taxable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_client_date_idx" ON "expenses" USING btree ("client_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_project_idx" ON "expenses" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_billed_once" ON "invoice_expenses" USING btree ("expense_id");