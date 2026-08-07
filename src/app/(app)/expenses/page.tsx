import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from "@/app/actions";
import { AddModal } from "@/components/add-modal";
import { PageHeader } from "@/components/app-shell";
import { db } from "@/db";
import { clients, expenses, invoiceExpenses, invoices, projects, settings } from "@/db/schema";
import { formatMoney } from "@/lib/money";

const categories = [
  ["airfare", "Airfare"], ["lodging", "Lodging"], ["meals", "Meals"],
  ["ground_transport", "Ground transport"], ["mileage", "Mileage"],
  ["supplies", "Supplies"], ["other", "Other"],
] as const;
const categoryLabel = Object.fromEntries(categories);

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const query = await searchParams;
  const view = ["unbilled", "billed", "all"].includes(query.view || "") ? query.view! : "unbilled";
  const [activeClients, activeProjects, [business], allRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.archived, false)).orderBy(asc(clients.name)),
    db.select({ project: projects, client: clients }).from(projects).innerJoin(clients, eq(projects.clientId, clients.id)).where(eq(projects.archived, false)).orderBy(asc(clients.name), asc(projects.name)),
    db.select({ currency: settings.currency }).from(settings).where(eq(settings.id, 1)).limit(1),
    db.select({ expense: expenses, client: clients, project: projects, invoiceId: invoiceExpenses.invoiceId, invoiceNumber: invoices.number })
      .from(expenses)
      .innerJoin(clients, eq(expenses.clientId, clients.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(invoiceExpenses, eq(expenses.id, invoiceExpenses.expenseId))
      .leftJoin(invoices, eq(invoiceExpenses.invoiceId, invoices.id))
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)),
  ]);
  const rows = allRows.filter((row) => view === "all" || (view === "billed" ? row.invoiceId !== null : row.invoiceId === null));
  const today = new Date().toISOString().slice(0, 10);
  const totalsByCurrency = rows.reduce((totals, row) => totals.set(row.expense.currency, (totals.get(row.expense.currency) ?? 0) + row.expense.amount), new Map<string, number>());
  const newExpenseForm=<form action={createExpenseAction} className="grid">
    <div className="form-row"><div className="field"><label>Client</label><select className="input" name="clientId" required defaultValue=""><option value="" disabled>Choose a client</option>{activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div><div className="field"><label>Project (optional)</label><select className="input" name="projectId" defaultValue=""><option value="">No project</option>{activeProjects.map(({ project, client }) => <option key={project.id} value={project.id}>{client.name} · {project.name}</option>)}</select></div></div>
    <div className="form-row"><div className="field"><label>Date</label><input className="input" type="date" name="expenseDate" defaultValue={today} required/></div><div className="field"><label>Category</label><select className="input" name="category" defaultValue="other">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    <div className="form-row"><div className="field"><label>Vendor</label><input className="input" name="vendor" placeholder="Airline, restaurant, hotel…"/></div><div className="field"><label>Amount</label><input className="input" type="number" min="0.01" step="0.01" name="amount" placeholder="0.00" required/></div></div>
    <div className="field"><label>Description</label><input className="input" name="description" placeholder="Client trip flight" required/></div>
    <label className="small"><input type="checkbox" name="taxable"/> Apply invoice tax to this expense</label>
    <div className="field"><label>Receipt (PDF, PNG, or JPEG; maximum 10 MB)</label><input className="input" type="file" name="receipt" accept="application/pdf,image/png,image/jpeg"/></div>
    <button className="btn btn-primary" style={{ justifySelf: "end" }}><Plus size={15}/> Record expense</button>
  </form>;
  return <><PageHeader eyebrow="Billing" title="Expenses" action={<AddModal title="Record an expense" triggerLabel="Add expense" disabled={!activeClients.length}>{newExpenseForm}</AddModal>}/><div className="content">
    {query.error && <div className="alert">{query.error}</div>}
    {!activeClients.length&&<div className="alert">Add a client before recording an expense.</div>}
      <section>
        <div className="section-head"><div><div className="eyebrow">Reimbursements</div><h2>{view === "all" ? "All expenses" : `${view[0].toUpperCase()}${view.slice(1)} expenses`}</h2></div><b>{totalsByCurrency.size ? [...totalsByCurrency].map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : formatMoney(0, business?.currency ?? "USD")}</b></div>
        <div style={{ display: "flex", gap: 8, marginBottom: 13, flexWrap: "wrap" }}>{["unbilled", "billed", "all"].map((item) => <Link key={item} href={`/expenses?view=${item}`} className={`btn ${view === item ? "btn-primary" : "btn-secondary"}`}>{item[0].toUpperCase() + item.slice(1)}</Link>)}</div>
        <div className="card">{rows.length ? rows.map(({ expense, client, project, invoiceId, invoiceNumber }) => {
          const billed = invoiceId !== null;
          return <div key={expense.id} style={{ padding: 18, borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}><div><b>{expense.description}</b><div className="small muted" style={{ marginTop: 4 }}>{client.name}{project ? ` · ${project.name}` : ""} · {categoryLabel[expense.category]}{expense.vendor ? ` · ${expense.vendor}` : ""}</div><div className="small muted" style={{ marginTop: 3 }}>{new Date(`${expense.expenseDate}T12:00:00`).toLocaleDateString()} · {expense.taxable ? "Taxable" : "Non-taxable"}</div></div><div style={{ textAlign: "right" }}><b>{formatMoney(expense.amount, expense.currency)}</b><div style={{ marginTop: 6 }}>{billed ? <Link className="badge sent" href={`/invoices/${invoiceId}`}>{invoiceNumber}</Link> : <span className="badge draft">Unbilled</span>}</div></div></div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>{expense.receiptFilename && <Link className="btn btn-ghost" href={`/api/expenses/${expense.id}/receipt`} target="_blank"><Receipt size={14}/> {expense.receiptOriginalName || "Receipt"}</Link>}</div>
            {!billed && <details style={{ marginTop: 9 }}><summary className="small" style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 700 }}>Edit expense</summary><form action={updateExpenseAction} className="grid" style={{ paddingTop: 12 }}><input type="hidden" name="id" value={expense.id}/>
              <div className="form-row"><div className="field"><label>Client</label><select className="input" name="clientId" defaultValue={expense.clientId} required>{activeClients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="field"><label>Project (optional)</label><select className="input" name="projectId" defaultValue={expense.projectId ?? ""}><option value="">No project</option>{activeProjects.map(({ project: item, client: owner }) => <option key={item.id} value={item.id}>{owner.name} · {item.name}</option>)}</select></div></div>
              <div className="form-row"><div className="field"><label>Date</label><input className="input" type="date" name="expenseDate" defaultValue={expense.expenseDate} required/></div><div className="field"><label>Category</label><select className="input" name="category" defaultValue={expense.category}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
              <div className="form-row"><div className="field"><label>Vendor</label><input className="input" name="vendor" defaultValue={expense.vendor}/></div><div className="field"><label>Amount ({expense.currency})</label><input className="input" type="number" min="0.01" step="0.01" name="amount" defaultValue={(expense.amount / 100).toFixed(2)} required/></div></div>
              <div className="field"><label>Description</label><input className="input" name="description" defaultValue={expense.description} required/></div>
              <label className="small"><input type="checkbox" name="taxable" defaultChecked={expense.taxable}/> Apply invoice tax to this expense</label>
              <div className="field"><label>Replace receipt</label><input className="input" type="file" name="receipt" accept="application/pdf,image/png,image/jpeg"/></div>
              {expense.receiptFilename && <label className="small"><input type="checkbox" name="removeReceipt"/> Remove existing receipt</label>}
              <div style={{ display: "flex", gap: 8 }}><button className="btn btn-secondary">Save expense</button></div>
            </form><form action={deleteExpenseAction} style={{ marginTop: 8 }}><input type="hidden" name="id" value={expense.id}/><button className="btn btn-danger"><Trash2 size={14}/> Delete expense</button></form></details>}
          </div>;
        }) : <div className="empty">No {view === "all" ? "" : `${view} `}expenses yet.</div>}</div>
      </section>
  </div></>;
}
