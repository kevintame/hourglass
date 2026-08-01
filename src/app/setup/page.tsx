import { redirect } from "next/navigation";
import { setupAction } from "@/app/actions";
import { db } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await db.select({id: users.id}).from(users).limit(1)).length) redirect("/login");
  const { error } = await searchParams;
  return <main className="auth-page"><section className="card auth-card">
    <div className="auth-logo">H</div><div className="eyebrow">First-time setup</div><h1 style={{marginBottom:8}}>Make Hourglass yours.</h1><p className="muted" style={{marginTop:0}}>Create the single owner account for this installation.</p>
    {error && <div className="alert">{error}</div>}
    <form action={setupAction} className="grid" style={{marginTop:24}}>
      <div className="field"><label htmlFor="name">Your name</label><input className="input" id="name" name="name" required autoFocus/></div>
      <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required/></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" minLength={12} required/><span className="small muted">At least 12 characters.</span></div>
      <button className="btn btn-primary">Create workspace</button>
    </form>
  </section></main>;
}
