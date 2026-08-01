import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { db } from "@/db";
import { clients, invoices } from "@/db/schema";
import { formatMoney } from "@/lib/money";

export default async function InvoicesPage() {
  const rows=await db.select({invoice:invoices,client:clients}).from(invoices).innerJoin(clients,eq(invoices.clientId,clients.id)).orderBy(desc(invoices.createdAt));
  return <><PageHeader eyebrow="Billing" title="Invoices" action={<Link href="/invoices/new" className="btn btn-primary"><Plus size={15}/> New invoice</Link>}/><div className="content"><div className="card table-wrap">{rows.length?<table><thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th>Total</th></tr></thead><tbody>{rows.map(({invoice,client})=><tr key={invoice.id}><td><Link href={`/invoices/${invoice.id}`} style={{fontWeight:800,color:"var(--accent)"}}>{invoice.number}</Link></td><td>{client.name}</td><td>{new Date(`${invoice.issueDate}T12:00:00`).toLocaleDateString()}</td><td>{new Date(`${invoice.dueDate}T12:00:00`).toLocaleDateString()}</td><td><span className={`badge ${invoice.status}`}>{invoice.status}</span></td><td><b>{formatMoney(invoice.total,invoice.currency)}</b></td></tr>)}</tbody></table>:<div className="empty"><b>No invoices yet.</b><div className="small" style={{marginTop:6}}>Track billable time, then turn it into a polished PDF.</div></div>}</div></div></>;
}
