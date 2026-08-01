import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Download, Send, BadgeCheck, Ban } from "lucide-react";
import { changeInvoiceStatusAction, discardDraftInvoiceAction } from "@/app/actions";
import { PageHeader } from "@/components/app-shell";
import { db } from "@/db";
import { invoiceLines, invoices } from "@/db/schema";
import { formatMoney } from "@/lib/money";

type BusinessSnapshot={businessName:string;ownerName:string;email:string;phone:string;address:string;paymentInstructions:string};
type ClientSnapshot={name:string;contactName:string;email:string;address:string};

export default async function InvoicePage({params}:{params:Promise<{id:string}>}) {
  const id=Number((await params).id); const [invoice]=await db.select().from(invoices).where(eq(invoices.id,id)).limit(1); if(!invoice)notFound();
  const lines=await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId,id)).orderBy(asc(invoiceLines.sortOrder));
  const business=invoice.businessSnapshot as BusinessSnapshot; const client=invoice.clientSnapshot as ClientSnapshot;
  return <><PageHeader eyebrow="Invoice" title={invoice.number} action={<Link href={`/api/invoices/${id}/pdf`} className="btn btn-primary"><Download size={15}/> Download PDF</Link>}/><div className="content" style={{maxWidth:1050}}>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}><span className={`badge ${invoice.status}`} style={{marginRight:"auto"}}>{invoice.status}</span>{invoice.status==="draft"&&<><form action={changeInvoiceStatusAction}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value="sent"/><button className="btn btn-secondary"><Send size={14}/> Mark sent</button></form><form action={discardDraftInvoiceAction}><input type="hidden" name="id" value={id}/><button className="btn btn-ghost">Discard draft</button></form></>}{invoice.status!=="paid"&&invoice.status!=="void"&&<form action={changeInvoiceStatusAction}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value="paid"/><button className="btn btn-secondary"><BadgeCheck size={14}/> Mark paid</button></form>}{invoice.status!=="void"&&invoice.status!=="draft"&&<form action={changeInvoiceStatusAction}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value="void"/><button className="btn btn-ghost"><Ban size={14}/> Void</button></form>}</div>
    <article className="card" style={{padding:"clamp(24px,6vw,62px)",background:"white"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:28,flexWrap:"wrap",paddingBottom:36,borderBottom:"1px solid var(--line)"}}><div><div className="eyebrow">From</div><h2 style={{fontSize:24,marginTop:7}}>{business.businessName}</h2><div className="small muted" style={{whiteSpace:"pre-line",marginTop:8,lineHeight:1.6}}>{business.ownerName}<br/>{business.email}<br/>{business.phone}<br/>{business.address}</div></div><div style={{textAlign:"right"}}><div className="eyebrow">Invoice</div><div style={{fontSize:28,fontWeight:800,marginTop:7}}>{invoice.number}</div><div className="small muted" style={{marginTop:8}}>Issued {new Date(`${invoice.issueDate}T12:00:00`).toLocaleDateString()}<br/>Due {new Date(`${invoice.dueDate}T12:00:00`).toLocaleDateString()}</div></div></div>
      <div style={{padding:"30px 0"}}><div className="eyebrow">Bill to</div><b style={{display:"block",fontSize:17,marginTop:7}}>{client.name}</b><div className="small muted" style={{whiteSpace:"pre-line",lineHeight:1.6}}>{client.contactName}<br/>{client.email}<br/>{client.address}</div></div>
      <div className="table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>{lines.map(line=><tr key={line.id}><td>{line.description}</td><td>{line.kind==="time"?`${(line.quantity/60).toFixed(2)} hr`:(line.quantity/100).toFixed(2)}</td><td>{formatMoney(line.unitAmount,invoice.currency)}</td><td style={{textAlign:"right",fontWeight:700}}>{formatMoney(line.amount,invoice.currency)}</td></tr>)}</tbody></table></div>
      <div style={{marginLeft:"auto",width:"min(340px,100%)",paddingTop:22}}><div style={{display:"flex",justifyContent:"space-between",padding:"7px 0"}}><span className="muted">Subtotal</span><b>{formatMoney(invoice.subtotal,invoice.currency)}</b></div>{invoice.taxBps>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"7px 0"}}><span className="muted">Tax ({(invoice.taxBps/100).toFixed(2)}%)</span><b>{formatMoney(invoice.taxAmount,invoice.currency)}</b></div>}<div style={{display:"flex",justifyContent:"space-between",padding:"15px 0",marginTop:8,borderTop:"2px solid var(--ink)",fontSize:20}}><span>Total</span><b>{formatMoney(invoice.total,invoice.currency)}</b></div></div>
      {(invoice.notes||business.paymentInstructions)&&<div style={{marginTop:35,paddingTop:24,borderTop:"1px solid var(--line)"}}>{invoice.notes&&<p className="small">{invoice.notes}</p>}{business.paymentInstructions&&<><div className="eyebrow" style={{marginTop:18}}>Payment instructions</div><p className="small muted" style={{whiteSpace:"pre-line"}}>{business.paymentInstructions}</p></>}</div>}
    </article>
  </div></>;
}
