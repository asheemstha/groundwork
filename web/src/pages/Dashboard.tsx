import * as React from "react"
import { Plus, User, Stamp } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { SiteIcon, TopBar } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { useApp } from "@/hooks/useApp"
import { api, type HomeData, type NextUp, type ProjectSummary } from "@/lib/api"
import { dueLabel, fmtDay } from "@/lib/project"
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
      <TopBar><span className="text-sm font-medium">Home</span><span className="flex-1" /><Button size="sm" onClick={() => newProject()}><Plus />New project</Button></TopBar>
      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-10 py-8">
          <div>
            <div className="text-[13px] text-muted-foreground">{today}</div>
            <h1 className="mt-1 text-[26px] font-medium">{projects.length ? `${projects.length} ${projects.length === 1 ? "project" : "projects"} in progress` : "No projects yet"}</h1>
            {data && <p className="mt-1.5 text-sm text-muted-foreground">{summaryLine(data)}</p>}
          </div>
          {!projects.length ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">A project copies a checklist template and tracks it from kickoff to launch.</p>
              <Button className="mt-4" onClick={() => newProject()}><Plus />New project</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {s?.overdue ? <Stat n={s.overdue} label={<><span className="text-destructive">overdue</span>, {s.dueThisWeek} more due this week</>} /> : <Stat n={s?.dueThisWeek ?? 0} label="due this week" />}
                <Stat n={s?.waiting ?? 0} label={<>waiting on clients{s?.late ? <>, <span className="text-destructive">{s.late} late</span></> : null}</>} />
                <Stat n={s?.signoffs ?? 0} label={s?.signoffs === 1 ? "sign-off ready to record" : "sign-offs ready to record"} />
                <Stat n={s?.nextLaunch ? fmtDay(s.nextLaunch.date) : "None"} label={s?.nextLaunch ? `next launch: ${s.nextLaunch.name}` : "no launch date set"} />
              </div>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
                <section className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex h-12 items-center gap-2 px-4"><h2 className="text-sm font-medium">Next up</h2><span className="text-[13px] text-muted-foreground">across all projects, soonest first</span></div>
                  {data?.next.length ? data.next.map((n) => <NextRow key={n.key} n={n} />) : <p className="border-t px-4 py-6 text-sm text-muted-foreground">Nothing due. Nice.</p>}
                </section>
                <section className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex h-12 items-center gap-2 px-4"><h2 className="text-sm font-medium">Projects</h2><span className="text-[13px] text-muted-foreground">by launch date</span></div>
                  {(data?.projects || projects).map((p) => <ProjectCard key={p.id} p={p} />)}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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

function Stat({ n, label }: { n: React.ReactNode; label: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3.5"><span className="text-2xl font-medium tabular">{n}</span><span className="text-[13px] text-muted-foreground">{label}</span></div>
}

// Two lines, so the title gets the full width: what to do, then where it belongs.
function NextRow({ n }: { n: NextUp }) {
  const open = () => go(n.kind === "client" ? routes.project(n.projectId, "client") : routes.project(n.projectId))
  const due = n.kind === "signoff" ? "Ready" : dueLabel({ due: n.due, late: n.late, status: "todo" })
  return (
    <button onClick={open} className="grid min-h-[54px] w-full grid-cols-[18px_minmax(0,1fr)_84px] items-center gap-3.5 border-t px-4 py-2 text-left hover:bg-muted/40">
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
    <button onClick={() => go(routes.project(p.id))} className="flex w-full flex-col gap-2.5 border-t px-4 py-3.5 text-left hover:bg-muted/40">
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
