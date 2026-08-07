import { boolean, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid", "void"]);
export const detailMode = pgEnum("detail_mode", ["grouped", "detailed"]);
export const lineKind = pgEnum("line_kind", ["time", "fixed", "expense"]);
export const expenseCategory = pgEnum("expense_category", ["airfare", "lodging", "meals", "ground_transport", "mileage", "supplies", "other"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, () => [uniqueIndex("single_owner").on(sql`(true)`)]);

export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  attemptKey: varchar("attempt_key", { length: 420 }).notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("login_attempts_key_time_idx").on(t.attemptKey, t.attemptedAt)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  businessName: varchar("business_name", { length: 160 }).notNull().default("My Studio"),
  ownerName: varchar("owner_name", { length: 120 }).notNull().default(""),
  email: varchar("email", { length: 320 }).notNull().default(""),
  phone: varchar("phone", { length: 50 }).notNull().default(""),
  address: text("address").notNull().default(""),
  timezone: varchar("timezone", { length: 80 }).notNull().default("America/Denver"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  taxBps: integer("tax_bps").notNull().default(0),
  paymentTermsDays: integer("payment_terms_days").notNull().default(30),
  invoicePrefix: varchar("invoice_prefix", { length: 12 }).notNull().default("INV"),
  paymentInstructions: text("payment_instructions").notNull().default(""),
  logoPath: text("logo_path"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [check("settings_singleton", sql`${t.id} = 1`), check("settings_tax_valid", sql`${t.taxBps} between 0 and 10000`), check("settings_terms_valid", sql`${t.paymentTermsDays} >= 0`)]);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  contactName: varchar("contact_name", { length: 120 }).notNull().default(""),
  email: varchar("email", { length: 320 }).notNull().default(""),
  address: text("address").notNull().default(""),
  currency: varchar("currency", { length: 3 }),
  taxBps: integer("tax_bps"),
  paymentTermsDays: integer("payment_terms_days"),
  notes: text("notes").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [check("clients_tax_valid", sql`${t.taxBps} is null or ${t.taxBps} between 0 and 10000`), check("clients_terms_valid", sql`${t.paymentTermsDays} is null or ${t.paymentTermsDays} >= 0`)]);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: varchar("name", { length: 180 }).notNull(),
  code: varchar("code", { length: 40 }).notNull().default(""),
  hourlyRate: integer("hourly_rate").notNull(),
  billable: boolean("billable").notNull().default(true),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("projects_client_idx").on(t.clientId), check("projects_rate_valid", sql`${t.hourlyRate} >= 0`)]);

export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").notNull().references(() => projects.id),
  notes: text("notes").notNull().default(""),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  billable: boolean("billable").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("time_entries_project_idx").on(t.projectId), index("time_entries_started_idx").on(t.startedAt), uniqueIndex("one_active_timer_per_user").on(t.userId).where(sql`${t.endedAt} is null`), check("time_entries_valid_range", sql`(${t.endedAt} is null and ${t.durationSeconds} is null) or (${t.endedAt} > ${t.startedAt} and ${t.durationSeconds} > 0)`) ]);

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  projectId: integer("project_id").references(() => projects.id),
  expenseDate: date("expense_date").notNull(),
  category: expenseCategory("category").notNull(),
  vendor: varchar("vendor", { length: 160 }).notNull().default(""),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  taxable: boolean("taxable").notNull().default(false),
  receiptFilename: varchar("receipt_filename", { length: 120 }),
  receiptOriginalName: varchar("receipt_original_name", { length: 255 }),
  receiptMimeType: varchar("receipt_mime_type", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("expenses_client_date_idx").on(t.clientId, t.expenseDate),
  index("expenses_project_idx").on(t.projectId),
  check("expenses_amount_valid", sql`${t.amount} > 0`),
]);

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 40 }).notNull().unique(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  status: invoiceStatus("status").notNull().default("draft"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  taxBps: integer("tax_bps").notNull().default(0),
  detailMode: detailMode("detail_mode").notNull().default("grouped"),
  subtotal: integer("subtotal").notNull().default(0),
  taxAmount: integer("tax_amount").notNull().default(0),
  total: integer("total").notNull().default(0),
  notes: text("notes").notNull().default(""),
  businessSnapshot: jsonb("business_snapshot").notNull(),
  clientSnapshot: jsonb("client_snapshot").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [check("invoices_amounts_valid", sql`${t.subtotal} >= 0 and ${t.taxAmount} >= 0 and ${t.total} = ${t.subtotal} + ${t.taxAmount}`), check("invoices_tax_valid", sql`${t.taxBps} between 0 and 10000`), check("invoices_dates_valid", sql`${t.dueDate} >= ${t.issueDate}`)]);

export const invoiceLines = pgTable("invoice_lines", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id),
  kind: lineKind("kind").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitAmount: integer("unit_amount").notNull(),
  amount: integer("amount").notNull(),
  taxable: boolean("taxable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId), check("invoice_lines_values_valid", sql`${t.quantity} > 0 and ${t.unitAmount} >= 0 and ${t.amount} >= 0`)]);

export const invoiceTimeEntries = pgTable("invoice_time_entries", {
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  timeEntryId: uuid("time_entry_id").notNull().references(() => timeEntries.id),
  roundedMinutes: integer("rounded_minutes").notNull(),
}, (t) => [primaryKey({ columns: [t.invoiceId, t.timeEntryId] }), uniqueIndex("time_entry_billed_once").on(t.timeEntryId)]);

export const invoiceExpenses = pgTable("invoice_expenses", {
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  expenseId: integer("expense_id").notNull().references(() => expenses.id),
}, (t) => [primaryKey({ columns: [t.invoiceId, t.expenseId] }), uniqueIndex("expense_billed_once").on(t.expenseId)]);
