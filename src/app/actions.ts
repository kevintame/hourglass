"use server";

import { hash, verify } from "argon2";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { headers } from "next/headers";
import { fromZonedTime } from "date-fns-tz";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients, expenses, invoiceExpenses, invoiceLines, invoices, invoiceTimeEntries, loginAttempts, projects, settings, timeEntries, users } from "@/db/schema";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { uploadDirectory } from "@/lib/config";
import { calculateInvoiceAmounts, parseMoney, roundBillableMinutes } from "@/lib/money";
import { deleteReceipt, saveReceipt } from "@/lib/receipts";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const int = (form: FormData, key: string) => Number.parseInt(text(form, key), 10);
const expenseCategories = ["airfare", "lodging", "meals", "ground_transport", "mileage", "supplies", "other"] as const;
type ExpenseCategory = (typeof expenseCategories)[number];

function expenseError(message: string) {
  redirect(`/expenses?error=${encodeURIComponent(message)}`);
}

export async function setupAction(form: FormData) {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) redirect("/login");
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  if (!name || !email.includes("@") || password.length < 12) redirect("/setup?error=Please+use+a+valid+email+and+a+12-character+password");
  const [user] = await db.insert(users).values({ name, email, passwordHash: await hash(password, { type: 2 }) }).returning({ id: users.id });
  await db.insert(settings).values({ id: 1, businessName: `${name}'s Studio`, ownerName: name, email }).onConflictDoNothing();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function loginAction(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const forwarded=(await headers()).get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown"; const attemptKey=`${forwarded}:${email}`;
  const cutoff=new Date(Date.now()-15*60*1000); const [attempts]=await db.select({count:sql<number>`count(*)::int`}).from(loginAttempts).where(and(eq(loginAttempts.attemptKey,attemptKey),sql`${loginAttempts.attemptedAt} >= ${cutoff}`));
  if((attempts?.count??0)>=5) redirect("/login?error=Too+many+attempts.+Try+again+in+15+minutes");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verify(user.passwordHash, password))) {await db.insert(loginAttempts).values({attemptKey}); redirect("/login?error=Email+or+password+is+incorrect");}
  await db.delete(loginAttempts).where(eq(loginAttempts.attemptKey,attemptKey));
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function startTimerAction(form: FormData) {
  const user = await requireUser();
  const projectId = int(form, "projectId");
  if (!projectId) return;
  const [active] = await db.select({ id: timeEntries.id }).from(timeEntries).where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt))).limit(1);
  if (active) await db.update(timeEntries).set({ endedAt: new Date(), durationSeconds: sql`greatest(1, extract(epoch from (now() - ${timeEntries.startedAt}))::integer)`, updatedAt: new Date() }).where(eq(timeEntries.id, active.id));
  await db.insert(timeEntries).values({ userId: user.id, projectId, notes: text(form, "notes"), startedAt: new Date(), billable: form.get("billable") !== null });
  revalidatePath("/time"); revalidatePath("/dashboard");
}

export async function stopTimerAction() {
  const user = await requireUser();
  await db.update(timeEntries).set({ endedAt: new Date(), durationSeconds: sql`greatest(1, extract(epoch from (now() - ${timeEntries.startedAt}))::integer)`, updatedAt: new Date() }).where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt)));
  revalidatePath("/time"); revalidatePath("/dashboard");
}

export async function addTimeAction(form: FormData) {
  const user = await requireUser();
  const projectId = int(form, "projectId");
  const [business]=await db.select({timezone:settings.timezone}).from(settings).where(eq(settings.id,1)).limit(1);
  const startedAt = fromZonedTime(text(form, "startedAt"),business?.timezone??"America/Denver");
  const hours = Number(text(form, "hours") || 0);
  const minutes = Number(text(form, "minutes") || 0);
  const durationSeconds = Math.round(hours * 3600 + minutes * 60);
  if (!projectId || Number.isNaN(startedAt.getTime()) || durationSeconds <= 0) redirect("/time?error=Enter+a+project,+date,+and+duration");
  const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
  const overlap = await db.select({ id: timeEntries.id }).from(timeEntries).where(and(eq(timeEntries.userId, user.id), sql`${timeEntries.startedAt} < ${endedAt}`, sql`coalesce(${timeEntries.endedAt}, now()) > ${startedAt}`)).limit(1);
  if (overlap.length) redirect("/time?error=That+entry+overlaps+existing+time");
  await db.insert(timeEntries).values({ userId: user.id, projectId, startedAt, endedAt, durationSeconds, notes: text(form, "notes"), billable: form.get("billable") !== null });
  revalidatePath("/time"); revalidatePath("/dashboard");
}

export async function updateTimeAction(form: FormData) {
  const user=await requireUser(); const id=text(form,"id"); const projectId=int(form,"projectId");
  const locked=await db.select().from(invoiceTimeEntries).where(eq(invoiceTimeEntries.timeEntryId,id)).limit(1); if(locked.length)return;
  const [business]=await db.select({timezone:settings.timezone}).from(settings).where(eq(settings.id,1)).limit(1);
  const startedAt=fromZonedTime(text(form,"startedAt"),business?.timezone??"America/Denver"); const durationSeconds=Math.round(Number(text(form,"durationMinutes"))*60); const endedAt=new Date(startedAt.getTime()+durationSeconds*1000);
  if(!id||!projectId||Number.isNaN(startedAt.getTime())||durationSeconds<=0)redirect("/time?error=Enter+a+valid+date+and+duration");
  const overlap=await db.select({id:timeEntries.id}).from(timeEntries).where(and(eq(timeEntries.userId,user.id),sql`${timeEntries.id} <> ${id}`,sql`${timeEntries.startedAt} < ${endedAt}`,sql`coalesce(${timeEntries.endedAt},now()) > ${startedAt}`)).limit(1);
  if(overlap.length)redirect("/time?error=That+entry+overlaps+existing+time");
  await db.update(timeEntries).set({projectId,startedAt,endedAt,durationSeconds,notes:text(form,"notes"),billable:form.get("billable")!==null,updatedAt:new Date()}).where(and(eq(timeEntries.id,id),eq(timeEntries.userId,user.id)));
  revalidatePath("/time");revalidatePath("/dashboard");
}

export async function deleteTimeAction(form: FormData) {
  await requireUser();
  const id = text(form, "id");
  if (!id) return;
  const billed = await db.select().from(invoiceTimeEntries).where(eq(invoiceTimeEntries.timeEntryId, id)).limit(1);
  if (!billed.length) await db.delete(timeEntries).where(eq(timeEntries.id, id));
  revalidatePath("/time"); revalidatePath("/dashboard");
}

export async function createClientAction(form: FormData) {
  await requireUser();
  const name = text(form, "name");
  if (!name) return;
  const currency=text(form,"currency").toUpperCase(); const tax=text(form,"taxRate"); const terms=text(form,"paymentTermsDays");
  await db.insert(clients).values({ name, contactName: text(form, "contactName"), email: text(form, "email"), address: text(form, "address"), notes: text(form, "notes"), currency:currency||null, taxBps:tax?Math.round(Number(tax)*100):null, paymentTermsDays:terms?Number(terms):null });
  revalidatePath("/clients");
}

export async function archiveClientAction(form: FormData) {
  await requireUser();
  await db.update(clients).set({ archived: true }).where(eq(clients.id, int(form, "id")));
  revalidatePath("/clients");
}

export async function updateClientAction(form:FormData){
  await requireUser();const id=int(form,"id");const currency=text(form,"currency").toUpperCase();const tax=text(form,"taxRate");const terms=text(form,"paymentTermsDays");
  await db.update(clients).set({name:text(form,"name"),contactName:text(form,"contactName"),email:text(form,"email"),address:text(form,"address"),notes:text(form,"notes"),currency:currency||null,taxBps:tax?Math.round(Number(tax)*100):null,paymentTermsDays:terms?Number(terms):null}).where(eq(clients.id,id));revalidatePath("/clients");
}

export async function createProjectAction(form: FormData) {
  await requireUser();
  const name = text(form, "name");
  const clientId = int(form, "clientId");
  if (!name || !clientId) return;
  await db.insert(projects).values({ name, clientId, code: text(form, "code"), hourlyRate: parseMoney(form.get("hourlyRate")), billable: form.get("billable") !== null });
  revalidatePath("/projects");
}

export async function archiveProjectAction(form: FormData) {
  await requireUser();
  await db.update(projects).set({ archived: true }).where(eq(projects.id, int(form, "id")));
  revalidatePath("/projects"); revalidatePath("/time");
}

export async function updateProjectAction(form:FormData){await requireUser();const id=int(form,"id");await db.update(projects).set({name:text(form,"name"),code:text(form,"code"),hourlyRate:parseMoney(form.get("hourlyRate")),billable:form.get("billable")!==null}).where(eq(projects.id,id));revalidatePath("/projects");revalidatePath("/time");}

async function expenseValues(form: FormData) {
  const clientId = int(form, "clientId");
  const projectId = int(form, "projectId") || null;
  const expenseDate = text(form, "expenseDate");
  const category = text(form, "category") as ExpenseCategory;
  const description = text(form, "description");
  const amount = parseMoney(form.get("amount"));
  if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || !expenseCategories.includes(category) || !description || amount <= 0) expenseError("Enter a client, date, category, description, and positive amount");
  const [[client], [business]] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, clientId)).limit(1),
    db.select({ currency: settings.currency }).from(settings).where(eq(settings.id, 1)).limit(1),
  ]);
  if (!client || !business) expenseError("Client or business settings could not be found");
  if (projectId) {
    const [project] = await db.select({ clientId: projects.clientId }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project || project.clientId !== clientId) expenseError("Selected project does not belong to this client");
  }
  return {
    clientId,
    projectId,
    expenseDate,
    category,
    vendor: text(form, "vendor").slice(0, 160),
    description,
    amount,
    currency: (client.currency ?? business.currency).toUpperCase().slice(0, 3),
    taxable: form.get("taxable") !== null,
  };
}

export async function createExpenseAction(form: FormData) {
  await requireUser();
  const values = await expenseValues(form);
  const receipt = form.get("receipt");
  let savedReceipt: Awaited<ReturnType<typeof saveReceipt>> | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    try { savedReceipt = await saveReceipt(receipt); }
    catch (error) { expenseError(error instanceof Error ? error.message : "Receipt could not be saved"); }
  }
  try {
    await db.insert(expenses).values({
      ...values,
      receiptFilename: savedReceipt?.filename ?? null,
      receiptOriginalName: savedReceipt?.originalName ?? null,
      receiptMimeType: savedReceipt?.mimeType ?? null,
    });
  } catch (error) {
    await deleteReceipt(savedReceipt?.filename);
    throw error;
  }
  revalidatePath("/expenses");
  revalidatePath("/invoices/new");
}

export async function updateExpenseAction(form: FormData) {
  await requireUser();
  const id = int(form, "id");
  const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!existing) expenseError("Expense could not be found");
  const billed = await db.select({ invoiceId: invoiceExpenses.invoiceId }).from(invoiceExpenses).where(eq(invoiceExpenses.expenseId, id)).limit(1);
  if (billed.length) expenseError("Billed expenses cannot be edited");
  const values = await expenseValues(form);
  const receipt = form.get("receipt");
  const removeExisting = form.get("removeReceipt") !== null;
  let savedReceipt: Awaited<ReturnType<typeof saveReceipt>> | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    try { savedReceipt = await saveReceipt(receipt); }
    catch (error) { expenseError(error instanceof Error ? error.message : "Receipt could not be saved"); }
  }
  const receiptValues = savedReceipt
    ? { receiptFilename: savedReceipt.filename, receiptOriginalName: savedReceipt.originalName, receiptMimeType: savedReceipt.mimeType }
    : removeExisting
      ? { receiptFilename: null, receiptOriginalName: null, receiptMimeType: null }
      : {};
  try {
    await db.update(expenses).set({ ...values, ...receiptValues, updatedAt: new Date() }).where(eq(expenses.id, id));
  } catch (error) {
    await deleteReceipt(savedReceipt?.filename);
    throw error;
  }
  if ((savedReceipt || removeExisting) && existing.receiptFilename) await deleteReceipt(existing.receiptFilename);
  revalidatePath("/expenses");
  revalidatePath("/invoices/new");
}

export async function deleteExpenseAction(form: FormData) {
  await requireUser();
  const id = int(form, "id");
  const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!existing) return;
  const billed = await db.select({ invoiceId: invoiceExpenses.invoiceId }).from(invoiceExpenses).where(eq(invoiceExpenses.expenseId, id)).limit(1);
  if (billed.length) expenseError("Billed expenses cannot be deleted");
  await db.delete(expenses).where(eq(expenses.id, id));
  await deleteReceipt(existing.receiptFilename);
  revalidatePath("/expenses");
  revalidatePath("/invoices/new");
}

export async function saveSettingsAction(form: FormData) {
  await requireUser();
  const [existing]=await db.select().from(settings).where(eq(settings.id,1)).limit(1);
  let logoPath=existing?.logoPath??null; const logo=form.get("logo");
  if(logo instanceof File&&logo.size>0){
    if(logo.size>2_000_000||!["image/png","image/jpeg"].includes(logo.type)) redirect("/settings?error=Logo+must+be+a+PNG+or+JPEG+under+2MB");
    const uploadDir=uploadDirectory(); await mkdir(uploadDir,{recursive:true});
    const filename=`logo-${randomUUID()}.${logo.type==="image/png"?"png":"jpg"}`; await writeFile(path.join(uploadDir,filename),Buffer.from(await logo.arrayBuffer())); logoPath=path.join(uploadDir,filename);
  }
  const values = {
    businessName: text(form, "businessName"), ownerName: text(form, "ownerName"), email: text(form, "email"), phone: text(form, "phone"), address: text(form, "address"),
    timezone: text(form, "timezone") || "America/Denver", currency: (text(form, "currency") || "USD").toUpperCase().slice(0, 3),
    taxBps: Math.round(Number(text(form, "taxRate") || 0) * 100), paymentTermsDays: int(form, "paymentTermsDays") || 30,
    invoicePrefix: (text(form, "invoicePrefix") || "INV").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12), paymentInstructions: text(form, "paymentInstructions"), logoPath, updatedAt: new Date(),
  };
  await db.insert(settings).values({ id: 1, ...values }).onConflictDoUpdate({ target: settings.id, set: values });
  revalidatePath("/settings"); revalidatePath("/invoices");
}

export async function createInvoiceAction(form: FormData) {
  await requireUser();
  const clientId = int(form, "clientId");
  const selectedTimeIds = [...new Set(form.getAll("entryId").map(String).filter(Boolean))];
  const selectedExpenseIds = [...new Set(form.getAll("expenseId").map(Number).filter(Number.isInteger))];
  if (!clientId || (!selectedTimeIds.length && !selectedExpenseIds.length)) redirect(`/invoices/new?clientId=${clientId || ""}&error=Select+at+least+one+time+entry+or+expense`);
  let newId: number;
  try {
    newId = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(68472819)`);
      const [business] = await tx.select().from(settings).where(eq(settings.id, 1)).limit(1);
      const [client] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!business || !client) throw new Error("Missing business or client");
      const currency = client.currency ?? business.currency;
      const timeRows = selectedTimeIds.length ? await tx.select({ entry: timeEntries, project: projects })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .leftJoin(invoiceTimeEntries, eq(timeEntries.id, invoiceTimeEntries.timeEntryId))
        .where(and(inArray(timeEntries.id, selectedTimeIds), eq(projects.clientId, clientId), sql`${timeEntries.endedAt} is not null`, eq(timeEntries.billable, true), isNull(invoiceTimeEntries.timeEntryId)))
        .orderBy(asc(timeEntries.startedAt)) : [];
      const expenseRows = selectedExpenseIds.length ? await tx.select({ expense: expenses })
        .from(expenses)
        .leftJoin(invoiceExpenses, eq(expenses.id, invoiceExpenses.expenseId))
        .where(and(inArray(expenses.id, selectedExpenseIds), eq(expenses.clientId, clientId), eq(expenses.currency, currency), isNull(invoiceExpenses.expenseId)))
        .orderBy(asc(expenses.expenseDate), asc(expenses.id)) : [];
      if (timeRows.length !== selectedTimeIds.length || expenseRows.length !== selectedExpenseIds.length) throw new Error("One or more selected items are no longer billable");
      const year = new Date().getFullYear();
      const prefix = business.invoicePrefix || "INV";
      const recent = await tx.select({ number: invoices.number }).from(invoices).where(sql`${invoices.number} like ${`${prefix}-${year}-%`}`).orderBy(desc(invoices.number)).limit(1);
      const seq = recent[0] ? Number(recent[0].number.split("-").at(-1)) + 1 : 1;
      const number = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
      const issueDate = text(form, "issueDate") || new Date().toISOString().slice(0, 10);
      const terms = client.paymentTermsDays ?? business.paymentTermsDays;
      const due = new Date(`${issueDate}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + terms);
      const taxBps = client.taxBps ?? business.taxBps;
      const mode = text(form, "detailMode") === "detailed" ? "detailed" as const : "grouped" as const;
      const builtLines: Array<{ projectId: number | null; kind: "time" | "expense" | "fixed"; description: string; quantity: number; unitAmount: number; amount: number; taxable: boolean; sortOrder: number }> = [];
      if (mode === "detailed") {
        timeRows.forEach(({ entry, project }) => {
          const mins = roundBillableMinutes(entry.durationSeconds ?? 0);
          builtLines.push({ projectId: project.id, kind: "time", description: `${project.name} · ${entry.startedAt.toISOString().slice(0, 10)}${entry.notes ? ` · ${entry.notes}` : ""}`, quantity: mins, unitAmount: project.hourlyRate, amount: Math.round(mins * project.hourlyRate / 60), taxable: true, sortOrder: builtLines.length });
        });
      } else {
        const grouped = new Map<number, { project: typeof timeRows[number]["project"]; mins: number }>();
        timeRows.forEach(({ entry, project }) => { const current = grouped.get(project.id) ?? { project, mins: 0 }; current.mins += roundBillableMinutes(entry.durationSeconds ?? 0); grouped.set(project.id, current); });
        Array.from(grouped.values()).forEach(({ project, mins }) => builtLines.push({ projectId: project.id, kind: "time", description: project.name, quantity: mins, unitAmount: project.hourlyRate, amount: Math.round(mins * project.hourlyRate / 60), taxable: true, sortOrder: builtLines.length }));
      }
      const expenseLabels: Record<ExpenseCategory, string> = { airfare: "Airfare", lodging: "Lodging", meals: "Meals", ground_transport: "Ground transport", mileage: "Mileage", supplies: "Supplies", other: "Other" };
      expenseRows.forEach(({ expense }) => builtLines.push({
        projectId: expense.projectId,
        kind: "expense",
        description: `${expense.expenseDate} · ${expenseLabels[expense.category]}${expense.vendor ? ` · ${expense.vendor}` : ""} · ${expense.description}`,
        quantity: 100,
        unitAmount: expense.amount,
        amount: expense.amount,
        taxable: expense.taxable,
        sortOrder: builtLines.length,
      }));
      const fixedDescription = text(form, "fixedDescription");
      const fixedAmount = parseMoney(form.get("fixedAmount"));
      if (fixedDescription && fixedAmount > 0) builtLines.push({ projectId: null, kind: "fixed", description: fixedDescription, quantity: 100, unitAmount: fixedAmount, amount: fixedAmount, taxable: true, sortOrder: builtLines.length });
      const amounts = calculateInvoiceAmounts(builtLines, taxBps);
      const [invoice] = await tx.insert(invoices).values({ number, clientId, issueDate, dueDate: due.toISOString().slice(0, 10), currency, taxBps, detailMode: mode, subtotal: amounts.subtotal, taxAmount: amounts.taxAmount, total: amounts.total, notes: text(form, "notes"), businessSnapshot: business, clientSnapshot: client }).returning({ id: invoices.id });
      await tx.insert(invoiceLines).values(builtLines.map((line) => ({ ...line, invoiceId: invoice.id })));
      if (timeRows.length) await tx.insert(invoiceTimeEntries).values(timeRows.map(({ entry }) => ({ invoiceId: invoice.id, timeEntryId: entry.id, roundedMinutes: roundBillableMinutes(entry.durationSeconds ?? 0) })));
      if (expenseRows.length) await tx.insert(invoiceExpenses).values(expenseRows.map(({ expense }) => ({ invoiceId: invoice.id, expenseId: expense.id })));
      return invoice.id;
    });
  } catch (error) {
    console.error("Could not create invoice", error);
    redirect(`/invoices/new?clientId=${clientId}&error=Selected+items+could+not+be+invoiced.+Reload+and+try+again`);
  }
  redirect(`/invoices/${newId}`);
}

export async function changeInvoiceStatusAction(form: FormData) {
  await requireUser();
  const id = int(form, "id");
  const status = text(form, "status");
  if (!["draft", "sent", "paid", "void"].includes(status)) return;
  await db.update(invoices).set({ status: status as "draft" | "sent" | "paid" | "void", sentAt: status === "sent" ? new Date() : undefined, paidAt: status === "paid" ? new Date() : undefined, updatedAt: new Date() }).where(eq(invoices.id, id));
  revalidatePath(`/invoices/${id}`); revalidatePath("/invoices"); revalidatePath("/dashboard");
}

export async function discardDraftInvoiceAction(form:FormData){await requireUser();const id=int(form,"id");await db.delete(invoices).where(and(eq(invoices.id,id),eq(invoices.status,"draft")));revalidatePath("/invoices");revalidatePath("/time");redirect("/invoices");}
