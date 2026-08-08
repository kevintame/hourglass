import { eq } from "drizzle-orm";
import { Archive } from "lucide-react";
import { archiveProjectAction, createProjectAction, updateProjectAction } from "@/app/actions";
import { AddModal } from "@/components/add-modal";
import { PageHeader } from "@/components/app-shell";
import { ToastForm } from "@/components/toast";
import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { formatMoney } from "@/lib/money";

export default async function ProjectsPage() {
  const activeClients=await db.select().from(clients).where(eq(clients.archived,false)).orderBy(clients.name);
  const rows=await db.select({project:projects,client:clients}).from(projects).innerJoin(clients,eq(projects.clientId,clients.id)).where(eq(projects.archived,false)).orderBy(clients.name,projects.name);
  const newProjectForm=<ToastForm action={createProjectAction} successMessage="Project added" className="grid">
    <div className="field"><label>Client</label><select className="input" name="clientId" required defaultValue=""><option value="" disabled>Choose a client</option>{activeClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="form-row"><div className="field"><label>Project name</label><input className="input" name="name" required placeholder="Website refresh"/></div><div className="field"><label>Code</label><input className="input" name="code" placeholder="NS-001"/></div></div>
    <div className="field"><label>Hourly rate</label><input className="input" name="hourlyRate" type="number" min="0" step="0.01" required placeholder="150.00"/></div>
    <label className="small"><input type="checkbox" name="billable" defaultChecked/> Time is billable by default</label>
    <button className="btn btn-primary" style={{justifySelf:"end"}}>Create project</button>
  </ToastForm>;
  return <><PageHeader eyebrow="Work" title="Projects" action={<AddModal title="Create a project" triggerLabel="Add project" disabled={!activeClients.length}>{newProjectForm}</AddModal>}/><div className="content">
    {!activeClients.length&&<div className="alert">Add a client before creating a project.</div>}
    <section><div className="section-head"><div><div className="eyebrow">Active</div><h2>Project roster</h2></div></div><div className="card">{rows.length?rows.map(({project,client})=><div key={project.id} style={{padding:18,borderBottom:"1px solid var(--line)"}}><div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center"}}><div><b>{project.name}</b><div className="small muted" style={{marginTop:4}}>{client.name}{project.code?` · ${project.code}`:""} · {formatMoney(project.hourlyRate)}/hr</div></div><form action={archiveProjectAction}><input type="hidden" name="id" value={project.id}/><button className="btn btn-ghost" aria-label={`Archive ${project.name}`}><Archive size={14}/></button></form></div><details style={{marginTop:9}}><summary className="small" style={{cursor:"pointer",color:"var(--accent)",fontWeight:700}}>Edit project</summary><ToastForm action={updateProjectAction} successMessage="Project saved" className="grid" style={{paddingTop:12}}><input type="hidden" name="id" value={project.id}/><input className="input" name="name" defaultValue={project.name} required/><div className="form-row"><input className="input" name="code" defaultValue={project.code} placeholder="Code"/><input className="input" name="hourlyRate" type="number" min="0" step="0.01" defaultValue={(project.hourlyRate/100).toFixed(2)} required/></div><label className="small"><input type="checkbox" name="billable" defaultChecked={project.billable}/> Billable by default</label><button className="btn btn-secondary" style={{justifySelf:"start"}}>Save project</button></ToastForm></details></div>):<div className="empty">{activeClients.length?"Add your first project.":"Create a client, then add a project."}</div>}</div></section>
  </div></>;
}
