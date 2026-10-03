import * as React from "react"
import { Bell, CalendarClock, ChevronDown, History, ListChecks, ListPlus, Mail, Plus, Radar, Receipt, Rocket, User, Stamp } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SiteIcon, TopBar } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { FirstRun } from "@/components/shell/FirstRun"
import { MyTasks } from "@/components/time/MyTasks"
import { PlayButton, useRunningOn } from "@/components/time/TimeBits"
import { timeChanged, useTimer } from "@/hooks/useTimer"
import { clockOf, fmtMins } from "@/lib/time"
import { useApp } from "@/hooks/useApp"
import { api, type HomeData, type HomeGroup, type HomeMessages, type NextUp, type ProjectSummary } from "@/lib/api"
import { dayOf, dueLabel, fmtDay, today as isoToday } from "@/lib/project"
import { store } from "@/lib/store"
import { go, routes } from "@/lib/router"
import { ago } from "@/lib/format"

type Tab = "tasks" | "week" | "late"

/**
 * Today: where things stand in four cards, then two columns. On the left, my tasks, this week's work and what's late,
 * one tab at a time; on the right, the messages to send (grouped by kind) and the projects touched last.
 */
export function Dashboard() {
  const { projects, runs, prefs } = useApp()
  const { state } = useTimer()
  const [data, setData] = React.useState<HomeData | null>(null)
  const [left, setLeft] = React.useState(0)
  const [tab, setTabState] = React.useState<Tab>(() => store.get("todayTab", "tasks") as Tab)
  const setTab = (t: Tab) => { setTabState(t); store.set("todayTab", t) }
  React.useEffect(() => { api.home().then(setData).catch(() => {}) }, [projects, runs])
  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
  const s = data?.stats
  const work = projects.filter((p) => p.kind !== "audit")
  // The count at the top is the projects still being built; launched, care and closed ones aren't in it.
  const building = work.filter((p) => (p.stage || "progress") === "progress")
  const groups = data?.groups || []
  const weekCount = groups.reduce((n, g) => n + g.rows.length + g.more, 0)
  const lateRows = groups.flatMap((g) => g.rows.filter((r) => r.late && r.kind !== "signoff").map((r) => ({ r, g })))
  const inv = invoicesOf(data)

  return (
    <div className="flex h-full flex-col">
      <TopBar><span className="px-1.5 text-[14px]">Today</span><span className="flex-1" /><Button size="sm" onClick={() => newProject()}><Plus />New project</Button></TopBar>
      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-10 pt-9 pb-12">
          {work.length > 0 && (
            <div>
              <div className="text-[13px] text-muted-foreground">{today}{building.length ? ` · ${building.length} ${building.length === 1 ? "project" : "projects"} in progress` : ""}</div>
              <h1 className="mt-1 text-[30px] leading-tight font-medium">{greeting(prefs.appliedBy)}</h1>
              {data && <p className="mt-1.5 text-[15px] text-foreground/80">{[left ? `${left} ${left === 1 ? "task" : "tasks"} left` : "", state?.today.mins ? `${fmtMins(state.today.mins)} logged` : ""].filter(Boolean).join(", ").replace(/^./, (c) => c.toUpperCase())}{left || state?.today.mins ? ". " : ""}{summaryLine(data)}</p>}
            </div>
          )}
          {!work.length ? <FirstRun /> : <Setup />}
          {work.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Glance icon={<ListChecks />} label="Yours this week" value={(s?.dueThisWeek ?? 0) + (s?.overdue ?? 0)} onClick={() => setTab(s?.overdue ? "late" : "week")}
                  sub={<>{s?.overdue ? <span className="text-destructive">{s.overdue} late</span> : "None late"}{s?.dueToday ? `, ${s.dueToday} due today` : ""}</>} />
                <Glance icon={<User />} label="Waiting on clients" value={s?.waiting ?? 0} onClick={() => setTab("week")}
                  sub={<>{s?.late ? <span className="text-destructive">{s.late} late</span> : "None late"}{s?.toAsk ? `, ${s.toAsk} to ask for` : ""}</>} />
                <Glance icon={<Receipt />} label="Invoices to send" value={inv.make} onClick={inv.first ? () => go(routes.project(inv.first!, "money")) : undefined}
                  sub={inv.unpaid ? `${inv.unpaid} waiting on payment` : "Nothing waiting on payment"} />
                <Glance icon={<Rocket />} label="Next launch" value={s?.nextLaunch ? fmtDay(s.nextLaunch.date) : "None"} onClick={s?.nextLaunch ? () => go(routes.project(s.nextLaunch!.id)) : undefined}
                  sub={s?.nextLaunch ? <span className="flex min-w-0 items-center gap-1.5"><SiteIcon runId={s.nextLaunch.iconRun || undefined} name={s.nextLaunch.name} color={s.nextLaunch.color} className="size-4 rounded text-[8px]" /><span className="truncate">{s.nextLaunch.name}, {inDays(s.nextLaunch.date)}</span></span> : "No launch date set"} />
              </div>
              <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="min-w-0">
                  <div className="mb-1 flex items-center gap-3"><Segmented value={tab} onChange={setTab} items={[["tasks", "My tasks", left], ["week", "This week", weekCount], ["late", "Late", lateRows.length]]} /><span className="flex-1" /><button onClick={() => go(routes.time())} className="text-[13px] text-muted-foreground tabular hover:text-foreground">{state?.today.mins ? `${fmtMins(state.today.mins)} logged today` : "Nothing logged today"}</button></div>
                  {/* My tasks stays mounted on the other tabs, hidden, so its count keeps the tab and the line at the top right. */}
                  <div className={cn(tab !== "tasks" && "hidden")}><MyTasks onCount={setLeft} heading={false} /></div>
                  {tab === "week" && data && (groups.length ? <div className="grid gap-4 pt-2">{groups.map((g) => <WeekGroup key={g.projectId} g={g} />)}</div> : <p className="py-3 text-[14px] text-muted-foreground">Nothing due this week.</p>)}
                  {tab === "late" && data && (lateRows.length ? <div className="-mx-2 pt-1">{lateRows.map(({ r, g }) => <NextRow key={r.key} n={r} project={g} />)}</div> : <p className="py-3 text-[14px] text-muted-foreground">Nothing is late.</p>)}
                </section>
                <aside className="grid gap-4">
                  {data && data.messages.length > 0 && <ToSend list={data.messages} />}
                  <Recent list={work.filter((p) => p.stage !== "closed")} />
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** "Good morning, Asheem", by the time of day, like Notion's Home. */
const greeting = (name?: string) => { const h = new Date().getHours(); const first = (name || "").trim().split(/\s+/)[0]; return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}${first ? `, ${first}` : ""}` }
const inDays = (d: string) => { const n = Math.round((Date.parse(d) - Date.parse(isoToday())) / 86400000); return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days` }
const invoicesOf = (d: HomeData | null) => ({ make: (d?.messages || []).reduce((n, m) => n + m.invoices.length, 0), unpaid: (d?.messages || []).reduce((n, m) => n + m.unpaid.length, 0), first: (d?.messages || []).find((m) => m.invoices.length)?.projectId })

/** One of the four cards at the top: a label, the number, and a line under it. */
function Glance({ icon, label, value, sub, onClick }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="grid min-w-0 content-start gap-1 rounded-xl border bg-card px-4 py-3.5 text-left transition-shadow enabled:hover:shadow-[0_2px_8px_rgba(22,23,22,0.07)]">
      <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground [&_svg]:size-3.5">{icon}{label}</span>
      <span className="text-[24px] leading-tight font-medium tabular">{value}</span>
      <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">{sub}</span>
    </button>
  )
}

/** Tabs as a small segmented control, each with its count. */
function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string, number][] }) {
  return (
    <div role="tablist" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
      {items.map(([k, label, n]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", value === k ? "bg-card font-medium shadow-[0_1px_2px_rgba(22,23,22,0.08)]" : "text-muted-foreground hover:text-foreground")}>
          {label}{n > 0 && <span className={cn("font-normal tabular", k === "late" ? "text-destructive" : "text-muted-foreground")}>{n}</span>}
        </button>
      ))}
    </div>
  )
}

/** The projects changed most recently, so the one you were in is a click away. */
function Recent({ list }: { list: ProjectSummary[] }) {
  const recent = list.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 4)
  if (!recent.length) return null
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2 className="flex items-center gap-1.5 px-3.5 pt-3 pb-1.5 text-[13px] font-medium text-muted-foreground"><History className="size-3.5" />Jump back in<span className="flex-1" /><button onClick={() => go(routes.projects())} className="font-normal hover:text-foreground">All projects</button></h2>
      {recent.map((p) => (
        <button key={p.id} onClick={() => go(routes.project(p.id))} className="grid h-12 w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-t px-3.5 text-left hover:bg-muted/40">
          <SiteIcon runId={p.iconRun || undefined} name={p.name} color={p.color} className="size-6 rounded-md text-[11px]" />
          <span className="grid min-w-0"><span className="truncate text-[13.5px]">{p.name}</span><span className="truncate text-[12px] text-muted-foreground">{p.current ? `${p.current.name}, ${p.current.done} of ${p.current.total}` : p.stage === "care" ? "Launched" : "Every phase signed off"}</span></span>
          {p.updated && <span className="text-[12px] text-muted-foreground">{ago(p.updated)}</span>}
        </button>
      ))}
    </section>
  )
}

/** First run: what Groundwork needs before it's useful. Hides itself once done, or when dismissed. */
function Setup() {
  const { status, prefs, projects } = useApp()
  const [hidden, setHidden] = React.useState(() => store.get("setupHidden", false))
  if (!status || hidden) return null
  const steps: [boolean, string, string, () => void][] = [
    [!!(status.engines.claude?.loggedIn || status.engines.codex?.loggedIn), "Sign in to Claude Code or Codex (optional)", "The heading and SEO plans and a few optional helpers use AI, on your own Claude or ChatGPT subscription. Checklists, scans and checks work without it.", () => go(routes.settings())],
    [!!status.browser?.ok, "Chrome or Edge for scans", "Groundwork uses the browser already on this Mac.", () => go(routes.settings())],
    [!!prefs.appliedBy, "Add your name", "It signs client messages and exported guides.", () => go(routes.settings())],
    [projects.some((p) => !p.sample), "Create your first project", "Pick a checklist that fits: a redesign, a new site, a store and more.", () => newProject()],
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

// The sentence under the greeting: only what to do first, since the cards below carry the counts.
function summaryLine(d: HomeData) {
  const bits = []
  if (d.stats.signoffs) bits.push(d.stats.signoffs === 1 ? "one sign-off is ready to record" : `${d.stats.signoffs} sign-offs are ready to record`)
  if (d.stats.toAsk) bits.push(d.stats.toAsk === 1 ? "it’s time to ask a client for one item" : `it’s time to ask clients for ${d.stats.toAsk} items`)
  const lateIn = d.groups.filter((g) => g.late > 0).length
  if (!bits.length) return d.stats.overdue || d.stats.late ? `${lateIn === 1 ? "One project has" : `${lateIn} projects have`} something late.` : d.stats.dueThisWeek ? `${d.stats.dueThisWeek} ${d.stats.dueThisWeek === 1 ? "item is" : "items are"} due this week, nothing late.` : "Nothing is late."
  const t = bits.length > 1 ? bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] : bits[0]!
  return t[0]!.toUpperCase() + t.slice(1) + "."
}

type Msg = { key: string; title: string; sub: string; go: () => void; m: HomeMessages }

/** The messages to send, grouped by kind (asks, reminders, weekly updates, invoices, payment reminders). A group with
 *  more than one opens into a row per client; each row opens the place that writes it. */
function ToSend({ list }: { list: HomeMessages[] }) {
  const [open, setOpen] = React.useState<string | null>(null)
  const n = (k: number, one: string, many = one + "s") => `${k} ${k === 1 ? one : many}`
  const who = (m: HomeMessages) => m.clientName || m.projectName
  const kinds: { key: string; icon: React.ReactNode; rows: Msg[]; title: (r: Msg[]) => string; sub: (r: Msg[]) => string }[] = [
    { key: "ask", icon: <Mail />, rows: list.filter((m) => m.ask).map((m) => ({ key: m.projectId + "a", m, title: `Ask ${who(m)} for ${n(m.ask, "item")}`, sub: "Time to ask, going by the due dates", go: () => go(routes.project(m.projectId, "client")) })),
      title: (r) => r.length === 1 ? r[0]!.title : `Ask ${r.length} clients for ${n(r.reduce((t, x) => t + x.m.ask, 0), "item")}`, sub: () => "Time to ask, going by the due dates" },
    { key: "remind", icon: <Bell />, rows: list.filter((m) => m.remind).map((m) => ({ key: m.projectId + "r", m, title: `Remind ${who(m)} about ${n(m.remind, "item")}`, sub: "Asked before and due soon or late", go: () => go(routes.remind(m.projectId)) })),
      title: (r) => r.length === 1 ? r[0]!.title : `Remind ${r.length} clients about ${n(r.reduce((t, x) => t + x.m.remind, 0), "item")}`, sub: () => "Asked before and due soon or late" },
    { key: "update", icon: <CalendarClock />, rows: list.filter((m) => m.update).map((m) => ({ key: m.projectId + "u", m, title: `Weekly update for ${who(m)}`, sub: m.lastUpdate ? `Last one ${fmtDay(dayOf(m.lastUpdate))}` : "No update sent yet", go: () => go(routes.clientUpdate(m.projectId)) })),
      title: (r) => r.length === 1 ? r[0]!.title : `Weekly updates for ${r.length} clients`, sub: (r) => r.length === 1 ? r[0]!.sub : r.some((x) => x.m.lastUpdate) ? "Due this week" : "None sent yet" },
    { key: "invoice", icon: <Receipt />, rows: list.flatMap((m) => m.invoices.map((x) => ({ key: m.projectId + "i" + x.phaseId, m, title: `Send the invoice: ${x.label}${x.amount ? `, ${x.amount}` : ""}`, sub: x.phaseId === "deposit" ? "The deposit, due at kickoff" : "The phase is signed off", go: () => go(routes.project(m.projectId, "money")) }))),
      title: (r) => r.length === 1 ? r[0]!.title : `Send ${r.length} invoices`, sub: (r) => r.length === 1 ? r[0]!.sub : "Deposits and signed-off phases" },
    { key: "unpaid", icon: <Receipt />, rows: list.flatMap((m) => m.unpaid.map((x) => ({ key: m.projectId + "p" + (x.phaseId || x.invoiceId), m, title: `Payment reminder: ${x.label}${x.amount ? `, ${x.amount}` : ""}`, sub: `Invoiced ${fmtDay(dayOf(x.invoiced))}, not paid yet`, go: () => go(routes.project(m.projectId, "money")) }))),
      title: (r) => r.length === 1 ? r[0]!.title : `${r.length} payment reminders`, sub: (r) => r.length === 1 ? r[0]!.sub : "Invoiced, not paid yet" },
  ]
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2 className="flex items-baseline gap-2 px-3.5 pt-3 pb-1.5 text-[14px] font-medium">To send<span className="flex-1" /><span className="text-[12px] font-normal text-muted-foreground">Groundwork writes, you send</span></h2>
      {kinds.filter((k) => k.rows.length).map((k) => {
        const many = k.rows.length > 1, isOpen = open === k.key
        const who = [...new Map(k.rows.map((r) => [r.m.projectId, r.m])).values()]
        return (
          <div key={k.key} className="border-t">
            <button onClick={() => (many ? setOpen(isOpen ? null : k.key) : k.rows[0]!.go())} aria-expanded={many ? isOpen : undefined} className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-muted/40">
              <span className="grid size-7 place-items-center rounded-lg bg-muted text-foreground/70 [&_svg]:size-3.5">{k.icon}</span>
              <span className="grid min-w-0 gap-0.5"><span className="line-clamp-2 text-[13.5px] leading-snug font-medium">{k.title(k.rows)}</span><span className="truncate text-[12px] text-muted-foreground">{k.sub(k.rows)}</span></span>
              <span className="flex items-center gap-1.5">
                <span className="flex">{who.slice(0, 4).map((m, i) => <SiteIcon key={m.projectId} runId={m.iconRun || undefined} name={m.projectName} color={m.color} className={cn("size-[18px] rounded-[5px] text-[9px] ring-2 ring-card", i > 0 && "-ml-1")} />)}</span>
                {many && <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />}
              </span>
            </button>
            {many && isOpen && (
              <div className="pb-1.5">
                {k.rows.map((r) => (
                  <button key={r.key} onClick={r.go} className="grid w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 py-1.5 pr-3.5 pl-[50px] text-left hover:bg-muted/40">
                    <SiteIcon runId={r.m.iconRun || undefined} name={r.m.projectName} color={r.m.color} className="size-[18px] rounded-[5px] text-[9px]" />
                    <span className="grid min-w-0"><span className="truncate text-[13px]">{r.title}</span><span className="truncate text-[12px] text-muted-foreground">{r.m.projectName}, {r.sub.replace(/^./, (c) => c.toLowerCase())}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** One project's week: a header with the project, then its most urgent rows. */
function WeekGroup({ g }: { g: HomeGroup }) {
  return (
    <div>
      <button onClick={() => go(routes.project(g.projectId))} className="-mx-2 flex h-8 items-center gap-2 rounded-md px-2 text-left hover:bg-muted/50">
        <SiteIcon runId={g.iconRun || undefined} name={g.projectName} color={g.color} className="size-[18px] rounded text-[9px]" /><span className="text-[13.5px] font-medium">{g.projectName}</span>
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
  watch: () => <span className="inline-flex items-center gap-1"><Radar className="size-3" />Groundwork checked the live site again</span>,
  renewal: () => <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" />Renewal date</span>,
  down: () => <span className="inline-flex items-center gap-1"><Radar className="size-3" />Groundwork’s hourly check of the live site</span>,
  files: () => <span className="inline-flex items-center gap-1"><User className="size-3" />Files from the client</span>,
  launch: () => <span className="inline-flex items-center gap-1"><Rocket className="size-3" />Launch day</span>,
}

// Two lines, so the title gets the full width: what to do, then what kind of work it is. Your own items can go on
// today's task list or get a timer straight away.
function NextRow({ n, project }: { n: NextUp; project?: Pick<HomeGroup, "projectName" | "color" | "iconRun"> }) {
  const { now } = useTimer()
  const running = useRunningOn({ projectId: n.projectId, itemId: n.itemId })
  const open = () => go(n.kind === "renewal" || n.kind === "down" ? routes.project(n.projectId, "site") : n.kind === "watch" && n.checkId ? routes.launch(n.projectId, n.checkId) : n.kind === "client" || n.kind === "ask" ? routes.project(n.projectId, "client") : n.kind === "files" ? routes.clientFiles(n.projectId) : n.kind === "launch" ? routes.markLaunched(n.projectId) : n.itemId ? routes.item(n.projectId, n.itemId) : routes.project(n.projectId))
  const due = n.kind === "launch" ? "Mark launched" : n.kind === "down" ? "Now" : n.kind === "watch" ? fmtDay(n.due) : n.kind === "signoff" && n.ready ? "Ready" : n.kind === "ask" ? (n.due ? `due ${fmtDay(n.due)}` : "") : dueLabel({ due: n.due, late: n.late, status: "todo" })
  const ours = n.kind === "item" && !!n.itemId
  const addTask = async (e: React.MouseEvent) => { e.stopPropagation(); try { await api.addTask({ title: n.title, projectId: n.projectId, itemId: n.itemId }); toast("Added to my tasks"); timeChanged() } catch (err) { toast((err as Error).message) } }
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && open()} className={cn("group grid min-h-[46px] w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/50", project ? "grid-cols-[minmax(0,1fr)_150px_auto_96px]" : "grid-cols-[minmax(0,1fr)_auto_96px]")}>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-[13.5px]">{n.title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">{KIND[n.kind](n)}</span>
      </span>
      {project && <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground"><SiteIcon runId={project.iconRun || undefined} name={project.projectName} color={project.color} className="size-4 rounded text-[8px]" /><span className="truncate">{project.projectName}</span></span>}
      <span className="flex items-center">
        {ours && !running && <button onClick={addTask} aria-label="Add to my tasks" title="Add to my tasks" className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"><ListPlus className="size-4" /></button>}
        {ours && <PlayButton running={running} start={{ projectId: n.projectId, itemId: n.itemId, title: n.title }} className={running ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"} label="Start a timer on this item" />}
      </span>
      <span className={cn("text-right text-[12.5px] whitespace-nowrap", running ? "text-brand-ink tabular" : n.late ? "text-destructive" : n.kind === "signoff" && n.ready ? "text-foreground" : "text-muted-foreground")}>{running ? clockOf(running, now) : due}</span>
    </div>
  )
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs whitespace-nowrap text-muted-foreground", className)}>{children}</span>
}
