import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  if (!(await db.select({id: users.id}).from(users).limit(1)).length) redirect("/setup");
  const { error } = await searchParams;
  return <main className="auth-page"><section className="card auth-card">
    <div className="auth-logo">H</div><div className="eyebrow">Welcome back</div><h1 style={{marginBottom:8}}>Your work, accounted for.</h1><p className="muted" style={{marginTop:0}}>Sign in to track time and prepare invoices.</p>
    {error && <div className="alert">{error}</div>}
    <form action={loginAction} className="grid" style={{marginTop:24}}>
      <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required autoFocus/></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required/></div>
      <button className="btn btn-primary" style={{marginTop:5}}>Sign in</button>
    </form><p className="small muted" style={{marginTop:22}}>Private, self-hosted, and stored on your own server.</p>
  </section></main>;
}
