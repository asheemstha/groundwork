import * as React from "react"
import { Plus, User, Stamp } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { SiteIcon, TopBar } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { useApp } from "@/hooks/useApp"
import { api, type HomeData, type NextUp, type ProjectSummary } from "@/lib/api"
import { dueLabel, fmtDay } from "@/lib/project"
import { store } from "@/lib/store"
import { go, routes } from "@/lib/router"

/** Home: what needs doing across every project, soonest first, and where each project stands. */
export function Dashboard() {
  const { projects, runs } = useApp()
  const [data, setData] = React.useState<HomeData | null>(null)
  React.useEffect(() => { api.home().then(setData).catch(() => {}) }, [projects, runs])
  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
  const s = data?.stats

  return (
    <div className="flex h-full flex-col">
      <TopBar><span className="px-1.5 text-[14px]">Home</span><span className="flex-1" /><Button size="sm" onClick={() => newProject()}><Plus />New project</Button></TopBar>
      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="flex max-w-5xl flex-col gap-9 px-12 pt-10 pb-12">
          <div>
            <div className="text-[13px] text-muted-foreground">{today}</div>
            <h1 className="mt-1 text-[32px] leading-tight font-medium">{projects.length ? `${projects.length} ${projects.length === 1 ? "project" : "projects"} in progress` : "Welcome to Groundwork"}</h1>
            {data && projects.length > 0 && <p className="mt-1.5 text-[14px] text-muted-foreground">{summaryLine(data)}</p>}
          </div>
          <Setup />
          {!projects.length ? (
            <div className="rounded-lg bg-muted/50 px-6 py-8 text-center">
              <p className="text-[14px] text-muted-foreground">A project copies a checklist template and tracks it from kickoff to launch.</p>
              <Button className="mt-4" onClick={() => newProject()}><Plus />New project</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                {s?.overdue ? <Stat n={s.overdue} label="overdue" tone="bad" sub={`${s.dueThisWeek} more due this week`} /> : <Stat n={s?.dueThisWeek ?? 0} label="due this week" />}
                <Stat n={s?.waiting ?? 0} label="waiting on clients" tone={s?.late ? "bad" : undefined} sub={s?.late ? `${s.late} late` : "none late"} />
                <Stat n={s?.signoffs ?? 0} label={s?.signoffs === 1 ? "sign-off to record" : "sign-offs to record"} />
                <Stat n={s?.nextLaunch ? fmtDay(s.nextLaunch.date) : "None"} label="next launch" sub={s?.nextLaunch?.name || "no launch date set"} />
              </div>
              <section>
                <h2 className="mb-1.5 flex items-baseline gap-2 text-[14px] font-medium">Next up<span className="text-[13px] font-normal text-muted-foreground">across all projects, soonest first</span></h2>
                {data?.next.length ? <div className="-mx-2">{data.next.map((n) => <NextRow key={n.key} n={n} />)}</div> : <p className="py-3 text-[14px] text-muted-foreground">Nothing due. Nice.</p>}
              </section>
              <section>
                <h2 className="mb-1.5 flex items-baseline gap-2 text-[14px] font-medium">Projects<span className="text-[13px] font-normal text-muted-foreground">by launch date</span></h2>
                <div className="-mx-2">{(data?.projects || projects).map((p) => <ProjectCard key={p.id} p={p} />)}</div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** First run: what Groundwork needs before it's useful. Hides itself once done, or when dismissed. */
function Setup() {
  const { status, prefs, projects } = useApp()
  const [hidden, setHidden] = React.useState(() => store.get("setupHidden", false))
  if (!status || hidden) return null
  const steps: [boolean, string, string, () => void][] = [
    [!!(status.engines.claude?.loggedIn || status.engines.codex?.loggedIn), "Sign in to Claude Code or Codex", "The heading and SEO plans run on your own plan.", () => go(routes.settings())],
    [!!status.browser?.ok, "A browser for scans", "Chrome or Edge, found on this Mac.", () => go(routes.settings())],
    [!!prefs.appliedBy, "Add your name", "It signs client messages and exported guides.", () => go(routes.settings())],
    [projects.length > 0, "Create your first project", "From the Website project checklist, or your own.", () => newProject()],
  ]
  const done = steps.filter((x) => x[0]).length
  if (done === steps.length) return null
  return (
    <section className="rounded-lg bg-muted/50 px-5 py-4">
      <div className="flex items-center gap-2"><h2 className="text-[14px] font-medium">Set up Groundwork</h2><span className="text-[13px] text-muted-foreground tabular">{done} of {steps.length}</span><span className="flex-1" /><button onClick={() => { store.set("setupHidden", true); setHidden(true) }} className="text-[12.5px] text-muted-foreground hover:text-foreground">Hide</button></div>
      <div className="mt-2 grid">
        {steps.map(([ok, title, desc, act]) => (
          <button key={title} onClick={act} disabled={ok} className="-mx-2 grid grid-cols-[18px_minmax(0,1fr)] items-start gap-3 rounded-md px-2 py-1.5 text-left enabled:hover:bg-muted/70">
            {ok ? <svg width="18" height="18" viewBox="0 0 18 18" className="mt-px"><circle cx="9" cy="9" r="8.5" className="fill-done" /><path d="m5.5 9.2 2.3 2.3 4.7-4.7" fill="none" className="stroke-background" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <span className="mt-px size-[18px] rounded-full border-[1.5px] border-input" />}
            <span className="grid"><span className={cn("text-[14px]", ok && "text-muted-foreground line-through decoration-muted-foreground/50")}>{title}</span>{!ok && <span className="text-[12.5px] text-muted-foreground">{desc}</span>}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function summaryLine(d: HomeData) {
  const bits = []
  if (d.stats.signoffs) bits.push(d.stats.signoffs === 1 ? "One sign-off is ready to record" : `${d.stats.signoffs} sign-offs are ready to record`)
  if (d.stats.late) bits.push(d.stats.late === 1 ? "one thing from a client is late" : `${d.stats.late} things from clients are late`)
  if (d.stats.overdue) bits.push(d.stats.overdue === 1 ? "one of your items is overdue" : `${d.stats.overdue} of your items are overdue`)
  if (!bits.length) return d.stats.dueThisWeek ? `${d.stats.dueThisWeek} ${d.stats.dueThisWeek === 1 ? "item is" : "items are"} due this week.` : "Nothing is late."
  const t = bits.join(", and ")
  return t[0]!.toUpperCase() + t.slice(1) + "."
}

// A quiet metric: a small label over the number, no card around it.
function Stat({ n, label, sub, tone }: { n: React.ReactNode; label: string; sub?: string; tone?: "bad" }) {
  return (
    <div className="grid content-start gap-0.5 border-l pl-4">
      <span className={cn("text-[12.5px]", tone === "bad" ? "text-destructive" : "text-muted-foreground")}>{label}</span>
      <span className="text-[22px] leading-tight font-medium tabular">{n}</span>
      {sub && <span className="truncate text-[12.5px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

// Two lines, so the title gets the full width: what to do, then where it belongs.
function NextRow({ n }: { n: NextUp }) {
  const open = () => go(n.kind === "client" ? routes.project(n.projectId, "client") : routes.project(n.projectId))
  const due = n.kind === "signoff" ? "Ready" : dueLabel({ due: n.due, late: n.late, status: "todo" })
  return (
    <button onClick={open} className="grid min-h-[50px] w-full grid-cols-[18px_minmax(0,1fr)_84px] items-center gap-3.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/50">
      <span className="size-[17px] rounded-full border-[1.5px] border-input" />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-[13.5px]">{n.title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          <SiteIcon runId={n.iconRun || undefined} name={n.projectName} className="size-3.5 rounded-[3px] text-[8px]" /><span className="truncate">{n.projectName}</span>
          <span className="text-muted-foreground/50">·</span>
          {n.kind === "client" ? <span className="inline-flex items-center gap-1"><User className="size-3" />From the client</span> : n.kind === "signoff" ? <span className="inline-flex items-center gap-1"><Stamp className="size-3" />Sign-off</span> : <span>{n.phaseName}</span>}
        </span>
      </span>
      <span className={cn("text-right text-[12.5px] whitespace-nowrap", n.late ? "text-destructive" : n.kind === "signoff" ? "text-foreground" : "text-muted-foreground")}>{due}</span>
    </button>
  )
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs whitespace-nowrap text-muted-foreground", className)}>{children}</span>
}

/** Six segments, one per phase: grey when signed off, orange for the current one's progress. */
export function PhaseBar({ p }: { p: Pick<ProjectSummary, "phases"> }) {
  return (
    <div className="grid h-[5px] gap-[3px]" style={{ gridTemplateColumns: `repeat(${p.phases.length}, minmax(0, 1fr))` }}>
      {p.phases.map((ph, i) => (
        <span key={i} className={cn("overflow-hidden rounded-full", ph.state === "signed" ? "bg-done" : "bg-muted")}>
          {ph.state === "current" && <span className="block h-full bg-brand" style={{ width: `${ph.total ? (100 * ph.done) / ph.total : 0}%` }} />}
        </span>
      ))}
    </div>
  )
}

function ProjectCard({ p }: { p: ProjectSummary }) {
  const c = p.current
  return (
    <button onClick={() => go(routes.project(p.id))} className="flex w-full flex-col gap-2 rounded-md px-2 py-2.5 text-left hover:bg-muted/50">
      <div className="flex items-center gap-2.5"><SiteIcon runId={p.iconRun || undefined} name={p.name} className="size-[22px] rounded-md text-[10px]" /><span className="text-sm font-medium">{p.name}</span><span className="flex-1" /><span className="text-[12.5px] text-muted-foreground">{p.launch ? `Launch ${fmtDay(p.launch)}` : "No launch date"}</span></div>
      <PhaseBar p={p} />
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <span>{c ? (c.ready ? `${c.name}: all done, ready for sign-off` : `${c.name} · ${c.done} of ${c.total}`) : "All phases signed off"}</span>
        <span className="flex-1" />
        <span>Client {p.clientOpen}{p.clientLate ? <>, <span className="text-destructive">{p.clientLate} late</span></> : null}</span>
      </div>
      {p.behind.items >= 3 && p.behind.days >= 7 && <span className="grid grid-cols-[6px_minmax(0,1fr)] items-baseline gap-2 text-[12.5px]"><span className="size-1.5 translate-y-[-1px] rounded-full bg-brand" /><span>Slipped about {p.behind.days} days <span className="text-muted-foreground">· open it to shift the plan</span></span></span>}
    </button>
  )
}
