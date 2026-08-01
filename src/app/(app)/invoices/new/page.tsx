import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { createInvoiceAction } from "@/app/actions";
import { PageHeader } from "@/components/app-shell";
import { db } from "@/db";
import { clients, invoiceTimeEntries, projects, timeEntries } from "@/db/schema";
import { formatDuration, formatMoney, roundBillableMinutes } from "@/lib/money";

export default async function NewInvoice({searchParams}:{searchParams:Promise<{clientId?:string,error?:string}>}) {
  const query=await searchParams; const clientId=Number(query.clientId||0);
  const clientRows=await db.select().from(clients).where(eq(clients.archived,false)).orderBy(clients.name);
  const entries=clientId?await db.select({entry:timeEntries,project:projects}).from(timeEntries).innerJoin(projects,eq(timeEntries.projectId,projects.id)).leftJoin(invoiceTimeEntries,eq(timeEntries.id,invoiceTimeEntries.timeEntryId)).where(and(eq(projects.clientId,clientId),eq(timeEntries.billable,true),sql`${timeEntries.endedAt} is not null`,isNull(invoiceTimeEntries.timeEntryId))).orderBy(asc(timeEntries.startedAt)):[];
  const today=new Date().toISOString().slice(0,10);
  return <><PageHeader eyebrow="Billing" title="Create invoice"/><div className="content" style={{maxWidth:1050}}>
    {query.error&&<div className="alert">{query.error}</div>}
    <form method="get" className="card card-pad form-row" style={{marginBottom:18}}><div className="field"><label>Client</label><select className="input" name="clientId" defaultValue={clientId||""} required><option value="" disabled>Choose a client</option>{clientRows.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div><button className="btn btn-secondary" style={{alignSelf:"end",justifySelf:"start"}}>Load unbilled time</button></form>
    {clientId&&<form action={createInvoiceAction} className="grid"><input type="hidden" name="clientId" value={clientId}/>
      <section className="card"><div className="card-pad" style={{borderBottom:"1px solid var(--line)"}}><div className="eyebrow">Unbilled time</div><h2 style={{marginTop:5}}>Select entries</h2></div>{entries.length?<div className="table-wrap"><table><thead><tr><th></th><th>Work</th><th>Date</th><th>Actual</th><th>Billable</th></tr></thead><tbody>{entries.map(({entry,project})=>{const mins=roundBillableMinutes(entry.durationSeconds??0);return <tr key={entry.id}><td><input type="checkbox" name="entryId" value={entry.id} defaultChecked aria-label={`Select ${project.name}`}/></td><td><b>{project.name}</b><div className="small muted">{entry.notes||"No description"}</div></td><td>{entry.startedAt.toLocaleDateString()}</td><td>{formatDuration(entry.durationSeconds??0)}</td><td>{mins/60} hr · {formatMoney(Math.round(mins*project.hourlyRate/60))}</td></tr>})}</tbody></table></div>:<div className="empty">This client has no finished, unbilled time.</div>}</section>
      {entries.length>0&&<><section className="card card-pad grid"><div className="grid grid-3"><div className="field"><label>Issue date</label><input className="input" type="date" name="issueDate" defaultValue={today}/></div><div className="field"><label>PDF detail</label><select className="input" name="detailMode" defaultValue="grouped"><option value="grouped">Grouped by project</option><option value="detailed">Every dated entry</option></select></div><div className="field"><label>Optional fixed amount</label><input className="input" type="number" step="0.01" min="0" name="fixedAmount" placeholder="0.00"/></div></div><div className="field"><label>Fixed item description</label><input className="input" name="fixedDescription" placeholder="Hosting, materials, or fixed-fee work"/></div><div className="field"><label>Client-facing note</label><textarea className="input" name="notes" placeholder="Thank you for your business."/></div></section><button className="btn btn-primary" style={{justifySelf:"end"}}>Create draft invoice</button></>}
    </form>}
  </div></>;
}
