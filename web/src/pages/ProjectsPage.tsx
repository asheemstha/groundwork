import * as React from "react"
import { cn } from "cn"
import { ArrowDown, ArrowUp, CalendarDays, Columns3, Layers, Plus, Search, Table2, Timer, TriangleAlert, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteIcon, TopBar } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { useApp } from "@/hooks/useApp"
import { type ProjectSummary } from "@/lib/api"
import { fmtDay, today } from "@/lib/project"
import { fmtMins } from "@/lib/time"
import { store } from "@/lib/store"
import { go, routes } from "@/lib/router"

const STAGES: [ProjectSummary["stage"], string][] = [["progress", "In progress"], ["care", "Launched and in care"], ["check", "Site checks"], ["closed", "Closed"]]
const stageName = (s: ProjectSummary["stage"]) => (STAGES.find(([k]) => k === s) || [s, s])[1]
type Sort = "name" | "stage" | "phase" | "client" | "launch" | "late" | "time"
type GroupBy = "stage" | "phase"

/**
 * Every project in one place, like a Notion database: a table you can sort, and a board grouped by stage or by the
 * phase each project is in.
 */
export function ProjectsPage({ view = "table" }: { view?: "table" | "board" }) {
  const { projects } = useApp()
  const [q, setQ] = React.useState("")
  const [showClosed, setShowClosed] = React.useState(() => store.get("projectsClosed", false))
  const [groupBy, setGroupBy] = React.useState<GroupBy>(() => store.get("projectsGroup", "stage"))
  const [sort, setSort] = React.useState<{ by: Sort; up: boolean }>(() => store.get("projectsSort", { by: "launch", up: true }))
  const set = <T,>(key: string, v: T, f: (v: T) => void) => { f(v); store.set(key, v) }
  const list = projects.filter((p) => (showClosed || p.stage !== "closed") && (!q.trim() || `${p.name} ${p.clientName || ""} ${p.host || ""}`.toLowerCase().includes(q.trim().toLowerCase())))
  const closed = projects.filter((p) => p.stage === "closed").length
  return (
    <div className="flex h-full flex-col">
      <TopBar><span className="px-1.5 text-[14px]">Projects</span><span className="flex-1" /><Button size="sm" onClick={() => newProject()}><Plus />New project</Button></TopBar>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-12 pt-8 pb-12">
          <h1 className="text-[36px] leading-tight font-medium">Projects</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-b pb-2">
            <ViewTab on={view === "table"} onClick={() => go(routes.projects())}><Table2 />Table</ViewTab>
            <ViewTab on={view === "board"} onClick={() => go(routes.projects("board"))}><Columns3 />Board</ViewTab>
            <span className="flex-1" />
            <label className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground focus-within:bg-muted/60 hover:bg-muted/50">
              <Search className="size-3.5" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search projects" className="w-28 bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:w-44" />
            </label>
            {view === "board" && (
              <label className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-muted/50">Group by
                <select value={groupBy} onChange={(e) => set("projectsGroup", e.target.value as GroupBy, setGroupBy)} className="bg-transparent text-foreground outline-none"><option value="stage">Stage</option><option value="phase">Phase</option></select>
              </label>
            )}
            {closed > 0 && <button onClick={() => set("projectsClosed", !showClosed, setShowClosed)} aria-pressed={showClosed} className={cn("h-7 rounded-md px-2 text-[13px] hover:bg-muted/50", showClosed ? "text-foreground" : "text-muted-foreground")}>{showClosed ? "Hide" : "Show"} closed ({closed})</button>}
          </div>
          {view === "board" ? <Board list={list} groupBy={groupBy} /> : <Table list={list} sort={sort} setSort={(s) => set("projectsSort", s, setSort)} />}
          {!list.length && <p className="py-8 text-center text-[14px] text-muted-foreground">{q ? "No project matches that." : "No projects yet."}</p>}
        </div>
      </div>
    </div>
  )
}

function ViewTab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-current={on ? "page" : undefined} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[14px] [&>svg]:size-3.5", on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>{children}</button>
}

const late = (p: ProjectSummary) => p.behind?.items || 0
const launchText = (p: ProjectSummary) => (p.launched ? `Live ${fmtDay(p.launched)}` : p.launch ? fmtDay(p.launch) : "")
const launchLate = (p: ProjectSummary) => !p.launched && !!p.launch && p.launch < today() && p.stage === "progress"

// Phase and how far it is, with a small bar in the progress colour.
function PhaseCell({ p }: { p: ProjectSummary }) {
  const c = p.current
  if (p.kind === "audit") return <span className="text-muted-foreground">No phases</span>
  if (!c) return <span className="text-muted-foreground">Every phase signed off</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate">{c.name}</span>
      <span className="h-[4px] w-10 shrink-0 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand" style={{ width: `${c.total ? (100 * c.done) / c.total : 0}%` }} /></span>
      <span className="shrink-0 text-[12px] text-muted-foreground tabular">{c.done}/{c.total}</span>
    </span>
  )
}

function Table({ list, sort, setSort }: { list: ProjectSummary[]; sort: { by: Sort; up: boolean }; setSort: (s: { by: Sort; up: boolean }) => void }) {
  const key = (p: ProjectSummary): string | number => {
    switch (sort.by) {
      case "name": return p.name.toLowerCase()
      case "stage": return STAGES.findIndex(([k]) => k === p.stage)
      case "phase": return p.current ? p.current.index * 1000 + (p.current.total ? p.current.done / p.current.total : 0) : 99999
      case "client": return (p.clientName || "~").toLowerCase()
      case "launch": return p.launched || p.launch || "9999"
      case "late": return late(p)
      case "time": return p.mins || 0
    }
  }
  const rows = list.slice().sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.up ? 1 : -1) })
  const cols = "grid-cols-[minmax(0,1.6fr)_150px_minmax(0,1.2fr)_minmax(0,1fr)_100px_64px_80px]"
  const H = ({ by, icon, children, right }: { by: Sort; icon: React.ReactNode; children: React.ReactNode; right?: boolean }) => (
    <button onClick={() => setSort({ by, up: sort.by === by ? !sort.up : by !== "late" && by !== "time" })} className={cn("flex h-8 items-center gap-1.5 truncate hover:text-foreground", right && "justify-end")}>
      {icon}{children}{sort.by === by && (sort.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  )
  return (
    <div className="mt-1 text-[14px]">
      <div className={cn("grid items-center gap-3 border-b px-2 text-[12.5px] text-muted-foreground [&_svg]:size-3.5", cols)}>
        <H by="name" icon={<span className="text-[11px] font-medium">Aa</span>}>Name</H>
        <H by="stage" icon={<Layers />}>Stage</H>
        <H by="phase" icon={<Columns3 />}>Phase</H>
        <H by="client" icon={<User />}>Client</H>
        <H by="launch" icon={<CalendarDays />}>Launch</H>
        <H by="late" icon={<TriangleAlert />} right>Late</H>
        <H by="time" icon={<Timer />} right>Time</H>
      </div>
      {rows.map((p) => (
        <button key={p.id} onClick={() => go(routes.project(p.id))} className={cn("grid h-10 w-full items-center gap-3 border-b border-border/60 px-2 text-left hover:bg-muted/40", cols)}>
          <span className="flex min-w-0 items-center gap-2"><SiteIcon runId={p.iconRun || undefined} name={p.name} color={p.color} className="size-5 shrink-0 rounded-[5px] text-[10px]" /><span className="truncate">{p.name}</span></span>
          <span><span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-[12.5px] text-foreground/80">{stageName(p.stage)}</span></span>
          <PhaseCell p={p} />
          <span className={cn("truncate", !p.clientName && "text-muted-foreground")}>{p.clientName || "Empty"}</span>
          <span className={cn("truncate", launchLate(p) ? "text-destructive" : p.launched ? "text-muted-foreground" : "")}>{launchText(p)}</span>
          <span className={cn("text-right tabular", late(p) ? "text-destructive" : "text-muted-foreground")}>{late(p) || ""}</span>
          <span className="text-right text-muted-foreground tabular">{p.mins ? fmtMins(p.mins) : ""}</span>
        </button>
      ))}
      <button onClick={() => newProject()} className="flex h-10 w-full items-center gap-2 px-2 text-left text-[14px] text-muted-foreground hover:bg-muted/40"><Plus className="size-4" />New project</button>
    </div>
  )
}

/** Columns by stage, or by the phase each project is in, with a card per project. */
function Board({ list, groupBy }: { list: ProjectSummary[]; groupBy: GroupBy }) {
  let columns: { key: string; label: string; items: ProjectSummary[] }[]
  if (groupBy === "stage") columns = STAGES.map(([k, label]) => ({ key: k, label, items: list.filter((p) => p.stage === k) })).filter((c) => c.items.length || c.key === "progress")
  else {
    // Phases in the order they come in projects (by their number), then projects with every phase signed off.
    const names: { name: string; index: number }[] = []
    for (const p of list) if (p.current && !names.some((n) => n.name === p.current!.name)) names.push({ name: p.current.name, index: p.current.index })
    names.sort((a, b) => a.index - b.index)
    columns = [
      ...names.map((n) => ({ key: n.name, label: n.name, items: list.filter((p) => p.current?.name === n.name) })),
      { key: "_done", label: "Every phase signed off", items: list.filter((p) => p.kind !== "audit" && !p.current) },
      { key: "_none", label: "No phases", items: list.filter((p) => p.kind === "audit") },
    ].filter((c) => c.items.length)
  }
  return (
    <div className="scrollbar-thin -mx-12 mt-4 flex items-start gap-3 overflow-x-auto px-12 pb-4">
      {columns.map((c, i) => (
        <section key={c.key} className="grid w-[264px] shrink-0 gap-2 rounded-xl bg-muted/40 p-2">
          <h2 className="flex h-7 items-center gap-2 px-1 text-[13px]"><span className="rounded-md bg-card px-2 py-0.5 font-medium shadow-[0_0_0_1px_var(--border)]">{c.label}</span><span className="text-muted-foreground tabular">{c.items.length}</span></h2>
          {c.items.map((p) => <Card key={p.id} p={p} />)}
          {i === 0 && <button onClick={() => newProject()} className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-[13px] text-muted-foreground hover:bg-muted"><Plus className="size-3.5" />New project</button>}
        </section>
      ))}
    </div>
  )
}

function Card({ p }: { p: ProjectSummary }) {
  return (
    <button onClick={() => go(routes.project(p.id))} className="grid gap-1.5 rounded-lg border bg-card p-3 text-left shadow-[0_1px_2px_rgba(22,23,22,0.04)] hover:shadow-[0_2px_8px_rgba(22,23,22,0.08)]">
      <span className="flex min-w-0 items-center gap-2"><SiteIcon runId={p.iconRun || undefined} name={p.name} color={p.color} className="size-5 shrink-0 rounded-[5px] text-[10px]" /><span className="truncate text-[14px] font-medium">{p.name}</span></span>
      {p.clientName && <span className="truncate text-[12.5px] text-muted-foreground">{p.clientName}</span>}
      <span className="text-[12.5px]"><PhaseCell p={p} /></span>
      <span className="flex items-center gap-3 text-[12.5px]">
        {launchText(p) && <span className={cn(launchLate(p) ? "text-destructive" : "text-muted-foreground")}>{launchText(p)}</span>}
        {late(p) > 0 && <span className="flex items-center gap-1 text-destructive"><span className="size-1.5 rounded-full bg-destructive" />{late(p)} late</span>}
      </span>
    </button>
  )
}
