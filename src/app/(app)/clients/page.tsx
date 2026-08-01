import { eq } from "drizzle-orm";
import { Archive, Plus } from "lucide-react";
import { archiveClientAction, createClientAction, updateClientAction } from "@/app/actions";
import { PageHeader } from "@/components/app-shell";
import { db } from "@/db";
import { clients } from "@/db/schema";

export default async function ClientsPage() {
  const rows = await db.select().from(clients).where(eq(clients.archived, false)).orderBy(clients.name);
  return <><PageHeader eyebrow="Relationships" title="Clients"/><div className="content">
    <div className="grid grid-2">
      <section><div className="section-head"><div><div className="eyebrow">Directory</div><h2>{rows.length} active client{rows.length===1?"":"s"}</h2></div></div>
        <div className="card">{rows.length?rows.map((client)=><div key={client.id} style={{padding:18,borderBottom:"1px solid var(--line)"}}><div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center"}}><div><b>{client.name}</b><div className="small muted" style={{marginTop:4}}>{client.contactName||"No contact"}{client.email?` · ${client.email}`:""}</div></div><form action={archiveClientAction}><input type="hidden" name="id" value={client.id}/><button className="btn btn-ghost" aria-label={`Archive ${client.name}`}><Archive size={14}/></button></form></div><details style={{marginTop:9}}><summary className="small" style={{cursor:"pointer",color:"var(--accent)",fontWeight:700}}>Edit client</summary><form action={updateClientAction} className="grid" style={{paddingTop:12}}><input type="hidden" name="id" value={client.id}/><div className="form-row"><input className="input" name="name" defaultValue={client.name} required/><input className="input" name="contactName" defaultValue={client.contactName} placeholder="Contact name"/></div><input className="input" name="email" type="email" defaultValue={client.email} placeholder="Email"/><textarea className="input" name="address" defaultValue={client.address} placeholder="Address"/><textarea className="input" name="notes" defaultValue={client.notes} placeholder="Private notes"/><div className="grid grid-3"><input className="input" name="currency" maxLength={3} defaultValue={client.currency??""} placeholder="Currency"/><input className="input" name="taxRate" type="number" step="0.01" defaultValue={client.taxBps==null?"":client.taxBps/100} placeholder="Tax %"/><input className="input" name="paymentTermsDays" type="number" defaultValue={client.paymentTermsDays??""} placeholder="Terms"/></div><button className="btn btn-secondary" style={{justifySelf:"start"}}>Save client</button></form></details></div>):<div className="empty">Add the first client you bill.</div>}</div>
      </section>
      <section><div className="section-head"><div><div className="eyebrow">New</div><h2>Add a client</h2></div></div>
        <form action={createClientAction} className="card card-pad grid">
          <div className="field"><label>Company or client name</label><input className="input" name="name" required placeholder="Northstar Studio"/></div>
          <div className="form-row"><div className="field"><label>Contact name</label><input className="input" name="contactName"/></div><div className="field"><label>Email</label><input className="input" type="email" name="email"/></div></div>
          <div className="field"><label>Billing address</label><textarea className="input" name="address"/></div>
          <div className="grid grid-3"><div className="field"><label>Currency override</label><input className="input" name="currency" maxLength={3} placeholder="Use default"/></div><div className="field"><label>Tax override (%)</label><input className="input" name="taxRate" type="number" step="0.01" min="0" placeholder="Use default"/></div><div className="field"><label>Terms override</label><input className="input" name="paymentTermsDays" type="number" min="0" placeholder="Days"/></div></div>
          <div className="field"><label>Private notes</label><textarea className="input" name="notes"/></div>
          <button className="btn btn-primary" style={{justifySelf:"start"}}><Plus size={15}/> Add client</button>
        </form>
      </section>
    </div>
  </div></>;
}
