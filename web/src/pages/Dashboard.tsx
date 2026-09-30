import * as React from "react"
import { Mail, Plus, User, Stamp } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { SiteIcon, TopBar } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { useApp } from "@/hooks/useApp"
import { api, type HomeData, type HomeGroup, type NextUp, type ProjectSummary } from "@/lib/api"
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
  const work = projects.filter((p) => p.kind !== "audit"), audits = projects.filter((p) => p.kind === "audit")

  return (
    <div className="flex h-full flex-col">
      <TopBar><span className="px-1.5 text-[14px]">Home</span><span className="flex-1" /><Button size="sm" onClick={() => newProject()}><Plus />New project</Button></TopBar>
      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="flex max-w-5xl flex-col gap-9 px-12 pt-10 pb-12">
          <div>
            <div className="text-[13px] text-muted-foreground">{today}</div>
            <h1 className="mt-1 text-[32px] leading-tight font-medium">{work.length ? `${work.length} ${work.length === 1 ? "project" : "projects"} in progress` : "Welcome to Groundwork"}</h1>
            {data && work.length > 0 && <p className="mt-1.5 text-[14px] text-muted-foreground">{summaryLine(data)}</p>}
          </div>
          <Setup />
          {!work.length ? (
            <div className="rounded-lg bg-muted/50 px-6 py-8 text-center">
              <p className="text-[14px] text-muted-foreground">A project follows a website checklist from kickoff to launch. An audit just scans a site and checks it.</p>
              <div className="mt-4 flex justify-center gap-2"><Button onClick={() => newProject()}><Plus />New project</Button><Button variant="outline" onClick={() => newProject({ audit: true })}>Audit a site</Button></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                {s?.overdue ? <Stat n={s.overdue} label="of yours late" tone="bad" sub={`${s.dueThisWeek} more due this week`} /> : <Stat n={s?.dueThisWeek ?? 0} label="due this week" sub={s?.toAsk ? `${s.toAsk} to ask the client for` : undefined} />}
                <Stat n={s?.waiting ?? 0} label="waiting on clients" tone={s?.late ? "bad" : undefined} sub={s?.late ? `${s.late} client ${s.late === 1 ? "item" : "items"} late` : "none late"} />
                <Stat n={s?.signoffs ?? 0} label={s?.signoffs === 1 ? "sign-off to record" : "sign-offs to record"} />
                <Stat n={s?.nextLaunch ? fmtDay(s.nextLaunch.date) : "None"} label="next launch" sub={s?.nextLaunch?.name || "no launch date set"} />
              </div>
              <section>
                <h2 className="mb-1.5 flex items-baseline gap-2 text-[14px] font-medium">This week<span className="text-[13px] font-normal text-muted-foreground">late, due in the next 7 days, and time to ask</span></h2>
                {data?.groups.length ? <div className="grid gap-4">{data.groups.map((g) => <WeekGroup key={g.projectId} g={g} />)}</div> : <p className="py-3 text-[14px] text-muted-foreground">Nothing due this week.</p>}
              </section>
              <section>
                <h2 className="mb-1.5 flex items-baseline gap-2 text-[14px] font-medium">Projects<span className="text-[13px] font-normal text-muted-foreground">by launch date</span></h2>
                <div className="-mx-2">{(data?.projects || projects).filter((p) => p.kind !== "audit").map((p) => <ProjectCard key={p.id} p={p} />)}</div>
              </section>
            </>
          )}
          {audits.length > 0 && (
            <section>
              <h2 className="mb-1.5 flex items-baseline gap-2 text-[14px] font-medium">Audits<span className="text-[13px] font-normal text-muted-foreground">sites scanned without a checklist</span></h2>
              <div className="-mx-2">
                {audits.map((p) => (
                  <button key={p.id} onClick={() => go(routes.project(p.id))} className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-muted/50">
                    <SiteIcon runId={p.iconRun || undefined} name={p.name} className="size-[18px] rounded text-[9px]" /><span className="text-[13.5px]">{p.name}</span><span className="text-[12.5px] text-muted-foreground">{p.host}</span>
                  </button>
                ))}
              </div>
            </section>
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
    [!!(status.engines.claude?.loggedIn || status.engines.codex?.loggedIn), "Sign in to Claude Code or Codex (optional)", "Only the heading and SEO plans use AI, on your own Claude or ChatGPT subscription. Checklists, scans and checks work without it.", () => go(routes.settings())],
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
  if (d.stats.late) bits.push(d.stats.late === 1 ? "one client item is late" : `${d.stats.late} client items are late`)
  if (d.stats.overdue) bits.push(d.stats.overdue === 1 ? "one of your items is late" : `${d.stats.overdue} of your items are late`)
  if (d.stats.toAsk) bits.push(d.stats.toAsk === 1 ? "it’s time to ask a client for one item" : `it’s time to ask clients for ${d.stats.toAsk} items`)
  if (!bits.length) return d.stats.dueThisWeek ? `${d.stats.dueThisWeek} ${d.stats.dueThisWeek === 1 ? "item is" : "items are"} due this week.` : "Nothing is late."
  const t = bits.length > 1 ? bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] : bits[0]!
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

/** One project's week: a header with the project, then its most urgent rows. */
function WeekGroup({ g }: { g: HomeGroup }) {
  return (
    <div>
      <button onClick={() => go(routes.project(g.projectId))} className="-mx-2 flex h-8 items-center gap-2 rounded-md px-2 text-left hover:bg-muted/50">
        <SiteIcon runId={g.iconRun || undefined} name={g.projectName} className="size-[18px] rounded text-[9px]" /><span className="text-[13.5px] font-medium">{g.projectName}</span>
        {g.late > 0 && <span className="text-[12.5px] text-destructive">{g.late} late</span>}
      </button>
      <div className="-mx-2">{g.rows.map((n) => <NextRow key={n.key} n={n} />)}</div>
      {g.more > 0 && <button onClick={() => go(routes.project(g.projectId))} className="-mx-2 h-8 rounded-md px-2 text-[12.5px] text-muted-foreground hover:bg-muted/50 hover:text-foreground">{g.more} more in {g.projectName}</button>}
    </div>
  )
}

const KIND: Record<NextUp["kind"], (n: NextUp) => React.ReactNode> = {
  item: (n) => <span>{n.phaseName}{n.leftover ? ", left open when it was signed off" : ""}</span>,
  client: (n) => <span className="inline-flex items-center gap-1"><User className="size-3" />{n.asked ? "From the client" : "From the client, not asked yet"}</span>,
  ask: () => <span className="inline-flex items-center gap-1"><Mail className="size-3" />Time to ask the client</span>,
  signoff: (n) => <span className="inline-flex items-center gap-1"><Stamp className="size-3" />{n.ready ? "Everything’s done" : `${n.phaseName} phase`}</span>,
}

// Two lines, so the title gets the full width: what to do, then what kind of work it is.
function NextRow({ n }: { n: NextUp }) {
  const open = () => go(n.kind === "client" || n.kind === "ask" ? routes.project(n.projectId, "client") : routes.project(n.projectId))
  const due = n.kind === "signoff" && n.ready ? "Ready" : n.kind === "ask" ? (n.due ? `due ${fmtDay(n.due)}` : "") : dueLabel({ due: n.due, late: n.late, status: "todo" })
  return (
    <button onClick={open} className="grid min-h-[46px] w-full grid-cols-[minmax(0,1fr)_96px] items-center gap-3.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/50">
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-[13.5px]">{n.title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">{KIND[n.kind](n)}</span>
      </span>
      <span className={cn("text-right text-[12.5px] whitespace-nowrap", n.late ? "text-destructive" : n.kind === "signoff" && n.ready ? "text-foreground" : "text-muted-foreground")}>{due}</span>
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
      {p.behind.items >= 3 && p.behind.days >= 7 && <span className="grid grid-cols-[6px_minmax(0,1fr)] items-baseline gap-2 text-[12.5px]"><span className="size-1.5 translate-y-[-1px] rounded-full bg-brand" /><span>Slipped about {p.behind.days} days <span className="text-muted-foreground">· open it to move the dates</span></span></span>}
    </button>
  )
}
