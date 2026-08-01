import Link from "next/link";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { ArrowUpRight, Clock3, FileText, Play } from "lucide-react";
import { db } from "@/db";
import { clients, invoices, invoiceTimeEntries, projects, settings, timeEntries } from "@/db/schema";
import { PageHeader } from "@/components/app-shell";
import { TimerClock } from "@/components/timer-clock";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/auth";

export default async function Dashboard() {
  const user = await requireUser();
  const [business]=await db.select({timezone:settings.timezone}).from(settings).limit(1); const timezone=business?.timezone??"America/Denver";
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  const [week] = await db.select({ total: sql<number>`coalesce(sum(${timeEntries.durationSeconds}),0)::int` }).from(timeEntries).where(and(eq(timeEntries.userId,user.id), gte(timeEntries.startedAt,weekStart)));
  const [unbilled] = await db.select({ total: sql<number>`coalesce(sum(ceil(${timeEntries.durationSeconds} / 900.0) * 15 * ${projects.hourlyRate} / 60),0)::int` }).from(timeEntries).innerJoin(projects,eq(timeEntries.projectId,projects.id)).leftJoin(invoiceTimeEntries,eq(timeEntries.id,invoiceTimeEntries.timeEntryId)).where(and(eq(timeEntries.billable,true),isNull(invoiceTimeEntries.timeEntryId),sql`${timeEntries.endedAt} is not null`));
  const [outstanding] = await db.select({ total: sql<number>`coalesce(sum(${invoices.total}),0)::int` }).from(invoices).where(eq(invoices.status,"sent"));
  const [clientCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clients).where(eq(clients.archived,false));
  const [active] = await db.select({entry:timeEntries,project:projects,client:clients}).from(timeEntries).innerJoin(projects,eq(timeEntries.projectId,projects.id)).innerJoin(clients,eq(projects.clientId,clients.id)).where(and(eq(timeEntries.userId,user.id),isNull(timeEntries.endedAt))).limit(1);
  const recent = await db.select({entry:timeEntries,project:projects,client:clients}).from(timeEntries).innerJoin(projects,eq(timeEntries.projectId,projects.id)).innerJoin(clients,eq(projects.clientId,clients.id)).where(sql`${timeEntries.endedAt} is not null`).orderBy(desc(timeEntries.startedAt)).limit(6);
  return <><PageHeader eyebrow="Workspace" title={`Good ${new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, ${user.name.split(" ")[0]}.`} action={<Link className="btn btn-primary" href="/time"><Play size={15}/> Track time</Link>}/>
  <div className="content">
    <div className="grid grid-4">
      <div className="card stat"><Clock3 size={18} color="#19624b"/><div><div className="stat-value">{formatDuration(week?.total??0)}</div><div className="small muted">Tracked this week</div></div></div>
      <div className="card stat"><ArrowUpRight size={18} color="#d96c42"/><div><div className="stat-value">{formatMoney(unbilled?.total??0)}</div><div className="small muted">Unbilled work</div></div></div>
      <div className="card stat"><FileText size={18} color="#365c8c"/><div><div className="stat-value">{formatMoney(outstanding?.total??0)}</div><div className="small muted">Awaiting payment</div></div></div>
      <div className="card stat"><span className="eyebrow">Active</span><div><div className="stat-value">{clientCount?.count??0}</div><div className="small muted">Clients</div></div></div>
    </div>
    {active && <><div className="section-head"><div><div className="eyebrow">Running now</div><h2>Current timer</h2></div><Link href="/time" className="small" style={{color:"var(--accent)",fontWeight:700}}>Open timer →</Link></div><div className="card timer-card"><div><b>{active.project.name}</b><div className="small muted">{active.client.name} · {active.entry.notes || "No description"}</div></div><TimerClock startedAt={active.entry.startedAt.toISOString()}/><span className="badge active">Running</span></div></>}
    <div className="section-head"><div><div className="eyebrow">Activity</div><h2>Recent time</h2></div><Link href="/time" className="small" style={{color:"var(--accent)",fontWeight:700}}>View all →</Link></div>
    <div className="card table-wrap">{recent.length?<table><thead><tr><th>Work</th><th>Client</th><th>Date</th><th>Duration</th></tr></thead><tbody>{recent.map(({entry,project,client})=><tr key={entry.id}><td><b>{project.name}</b><div className="small muted">{entry.notes||"—"}</div></td><td>{client.name}</td><td>{formatDateTime(entry.startedAt,timezone)}</td><td><b>{formatDuration(entry.durationSeconds??0)}</b></td></tr>)}</tbody></table>:<div className="empty">Start your first timer to see work appear here.</div>}</div>
  </div></>;
}
