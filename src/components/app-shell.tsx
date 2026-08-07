import Link from "next/link";
import { BarChart3, BriefcaseBusiness, Clock3, FileText, LogOut, Receipt, Settings, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/actions";

const links = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/time", label: "Time", icon: Clock3 },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: BriefcaseBusiness },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; email: string } }) {
  return <div className="shell">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><span className="brand-mark">H</span> Hourglass</Link>
      <nav className="nav">{links.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={17}/>{label}</Link>)}</nav>
      <div className="sidebar-foot">
        <div className="small" style={{fontWeight: 700}}>{user.name}</div><div className="small" style={{color:"#95b4a7", margin:"3px 0 13px"}}>{user.email}</div>
        <form action={logoutAction}><button className="btn" style={{background:"#215242", color:"white", width:"100%"}}><LogOut size={15}/> Sign out</button></form>
      </div>
    </aside>
    <main className="main">{children}</main>
    <nav className="mobile-nav">{links.slice(0,6).map(({href,label,icon:Icon}) => <Link href={href} key={href}><Icon size={19}/><span>{label}</span></Link>)}</nav>
  </div>;
}

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <header className="topbar"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{action}</header>;
}
