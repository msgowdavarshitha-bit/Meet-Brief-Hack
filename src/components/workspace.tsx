import { Link, useRouterState } from '@tanstack/react-router';
import { ArrowUpRight, CalendarDays, ChevronRight, FileText, LayoutDashboard, Plus, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function Workspace({ children, title }: { children: ReactNode; title: string }) {
  const path = useRouterState({ select: s => s.location.pathname });
  return <div className="workspace"><aside className="sidebar">
    <Link to="/" className="brand"><span className="brand-symbol"><Sparkles size={20} /></span><span>MeetBrief<span className="text-primary"> AI</span></span></Link>
    <div className="sidebar-create mt-9"><Button asChild className="w-full h-10"><Link to="/create"><Plus /> New briefing</Link></Button></div>
    <div className="nav-caption eyebrow mt-8 mb-3 px-3">Workspace</div>
    <nav className="space-y-1"><Link to="/" className={`nav-link ${path === '/' ? 'active' : ''}`}><LayoutDashboard />Dashboard</Link><Link to="/history" className={`nav-link ${path === '/history' ? 'active' : ''}`}><FileText />Briefing history</Link><Link to="/settings" className={`nav-link ${path === '/settings' ? 'active' : ''}`}><Settings />Settings</Link></nav>
    <div className="sidebar-bottom mt-auto"><div className="border-t border-border pt-5 px-3"><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={16} className="text-primary" /> Evidence, not assumptions.</div><p className="text-[11px] text-muted-foreground leading-relaxed mt-2">A clearer picture.<br />A better conversation.</p><div className="flex items-center justify-between text-[10px] text-muted-foreground mt-5"><span>Powered by Tavily + Bifrost</span><ArrowUpRight size={12} /></div></div><div className="flex items-center gap-3 border-t border-border pt-5 mt-5 px-2"><span className="rounded-full bg-brand-soft text-primary w-9 h-9 grid place-items-center font-bold text-xs">M</span><div><p className="font-semibold text-xs">My workspace</p><p className="text-[10px] text-muted-foreground mt-1">Personal workspace</p></div></div></div>
  </aside><div className="main-shell"><header className="topbar"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Workspace</span><ChevronRight size={13} /><span className="text-foreground font-semibold">{title}</span></div><div className="flex items-center gap-3"><CalendarDays size={16} className="text-muted-foreground" /><span className="text-xs text-muted-foreground hidden sm:block">Your meeting intelligence</span><div className="w-8 h-8 rounded-full bg-brand-soft text-primary grid place-items-center text-xs font-bold">M</div></div></header><main className="page-content fade-in">{children}</main></div></div>;
}

export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4 mb-7"><div><h1 className="page-heading">{title}</h1><p className="text-muted-foreground text-xs mt-2 leading-relaxed">{subtitle}</p></div>{action}</div>;
}

export function pageHead(title: string, description: string) {
  return { meta: [{ title: `${title} · MeetBrief AI` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} · MeetBrief AI` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
}