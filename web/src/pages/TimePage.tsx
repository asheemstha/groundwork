import * as React from "react"
import { cn } from "cn"
import { ChevronLeft, ChevronRight, Download, MoreHorizontal, Pencil, Plus, Receipt, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SiteIcon, TopBar } from "@/components/common/bits"
import { DateField } from "@/components/common/DateField"
import { EditTimeDialog, ProjectSelect, openRef } from "@/components/time/TimeBits"
import { useApp } from "@/hooks/useApp"
import { timeChanged, useTimeChanged, useTimer } from "@/hooks/useTimer"
import { api, fmtMoney, timeCsvUrl, type Project, type TimeEntry } from "@/lib/api"
import { makeInvoice } from "@/components/project/InvoiceDialog"
import { today } from "@/lib/project"
import { addDays, clockOf, fmtMins, longDay, parseDur, periodLabel, rangeOf, runMins, shiftPeriod, timeOf, type Period } from "@/lib/time"
import { store } from "@/lib/store"
import { go, routes } from "@/lib/router"

/**
 * Time: the work log for a day, week or month, across projects or for one. The total first, then where the hours went
 * by project, a row to add time by hand, and the entries by day.
 */
export function TimePage({ project }: { project?: string }) {
  const { projects } = useApp()
  const { state, now, stop } = useTimer()
  const [period, setPeriod] = React.useState<Period>(() => store.get("timePeriod", "week"))
  const [at, setAt] = React.useState(today())
  const [entries, setEntries] = React.useState<TimeEntry[] | null>(null)
  const [editing, setEditing] = React.useState<TimeEntry | null>(null)
  const range = rangeOf(period, at)
  // One project's page also shows its invoices and what's been paid.
  const [pj, setPj] = React.useState<Project | null>(null)
  const load = React.useCallback(() => {
    api.time({ ...range, project }).then((r) => setEntries(r.entries)).catch((e) => toast.error((e as Error).message))
    if (project) api.project(project).then(setPj).catch(() => {})
  }, [range.from, range.to, project]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(load, [load])
  useTimeChanged(load)
  const pick = (p: Period) => { setPeriod(p); store.set("timePeriod", p) }
  const proj = project ? projects.find((p) => p.id === project) : null
  const r = state?.running
  // The running timer counts in today's total, if today is in view and it's for the project being shown.
  const live = r && today() >= range.from && today() <= range.to && (!project || r.projectId === project) ? r : null
  const list = entries || []
  const total = list.reduce((n, e) => n + e.mins, 0) + (live ? runMins(live, now) : 0)
  const billable = list.filter((e) => e.billable).reduce((n, e) => n + e.mins, 0) + (live && live.billable ? runMins(live, now) : 0)
  const isNow = range.from <= today() && today() <= range.to
  // Time added by hand goes on the day in view, today in the current week or month, else the period's last day.
  const addDay = period === "day" ? at : isNow ? today() : range.to
  const when = period === "day" ? (at === today() ? "today" : "that day") : period === "week" ? (isNow ? "this week" : "that week") : isNow ? "this month" : "that month"

  // Hours by project, biggest first.
  const by = new Map<string, { id: string | null; name: string; mins: number }>()
  for (const e of list) { const k = e.projectId || ""; const x = by.get(k) || { id: e.projectId, name: e.pname || "No project", mins: 0 }; x.mins += e.mins; by.set(k, x) }
  if (live) { const k = live.projectId || ""; const x = by.get(k) || { id: live.projectId, name: live.pname || "No project", mins: 0 }; x.mins += runMins(live, now); by.set(k, x) }
  const bars = [...by.values()].sort((a, b) => b.mins - a.mins)
  // Each project in its own colour; time with no project in grey.
  const colorOf = (id: string | null) => { const c = id ? projects.find((p) => p.id === id)?.color : null; return c ? `var(--p-${c})` : "var(--input)" }
  // Minutes by day and project, for the chart.
  const perDay = new Map<string, Map<string, number>>()
  const addTo = (d: string, k: string, m: number) => { const x = perDay.get(d) || new Map<string, number>(); x.set(k, (x.get(k) || 0) + m); perDay.set(d, x) }
  for (const e of list) addTo(e.day, e.projectId || "", e.mins)
  if (live) addTo(today(), live.projectId || "", runMins(live, now))
  const span: string[] = []
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) span.push(d)

  // Entries by day, newest first.
  const days = new Map<string, TimeEntry[]>()
  for (const e of list) days.set(e.day, [...(days.get(e.day) || []), e])
  if (live && !days.has(today())) days.set(today(), [])
  const dayKeys = [...days.keys()].sort().reverse()

  return (
    <div className="flex h-full flex-col">
      <TopBar className="gap-2">
        {proj ? <><button onClick={() => go(routes.time())} className="rounded-md px-1.5 py-0.5 text-[14px] text-muted-foreground hover:bg-muted/70 hover:text-foreground">Time</button><span className="text-muted-foreground/60">/</span><span className="truncate px-1.5 text-[14px]">{proj.name}</span></> : <span className="px-1.5 text-[14px]">Time</span>}
        <span className="flex-1" />
        <div role="group" aria-label="Period" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {(["day", "week", "month"] as const).map((k) => <button key={k} aria-pressed={period === k} onClick={() => pick(k)} className={cn("h-7 rounded-md px-2.5 text-[13px] capitalize", period === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{k}</button>)}
        </div>
        {proj && <Button size="sm" variant="outline" onClick={() => makeInvoice({ projectId: proj.id, kind: "hours" })}><Receipt />Invoice hours</Button>}
        <Button size="sm" variant="outline" nativeButton={false} render={<a href={timeCsvUrl({ ...range, project })} download />}><Download />Export CSV</Button>
      </TopBar>
      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-10 pt-9 pb-14">
          <div className="flex items-end gap-4">
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
                <span>{periodLabel(period, at)}</span>
                {!isNow && <button onClick={() => setAt(today())} className="ml-1.5 rounded px-1.5 text-[12.5px] underline-offset-2 hover:text-foreground hover:underline">Back to {period === "day" ? "today" : `this ${period}`}</button>}
              </div>
              <h1 className="text-[30px] leading-tight font-medium tabular">{fmtMins(total)} {when}</h1>
              <p className="text-[14px] text-muted-foreground">{total ? `${fmtMins(billable)} billable` : "Nothing logged yet"}{pj?.paid && pj.time.mins >= 60 && !pj.paid.mixed ? ` · ${fmtMoney(pj.paid.amount, pj.paid.currency)} paid so far, ${fmtMoney(pj.paid.amount / (pj.time.mins / 60), pj.paid.currency).replace(/\.\d\d(?=\D*$)/, "")} for each hour logged` : ""}{proj ? <> · for {proj.name} <button onClick={() => go(routes.time())} className="ml-1 inline-flex items-center gap-0.5 underline-offset-2 hover:text-foreground hover:underline"><X className="size-3" />every project</button></> : ""}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" aria-label={`Previous ${period}`} onClick={() => setAt(shiftPeriod(period, at, -1))}><ChevronLeft /></Button>
              <Button variant="outline" size="icon-sm" aria-label={`Next ${period}`} onClick={() => setAt(shiftPeriod(period, at, 1))}><ChevronRight /></Button>
            </div>
          </div>

          {total > 0 && (period !== "day" || !proj) && (
            <div className={cn("grid items-start gap-5", period !== "day" && !proj && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
              {period !== "day" && <DayChart span={span} perDay={perDay} order={bars.map((b) => b.id || "")} colorOf={colorOf} period={period} onDay={(d) => { setAt(d); pick("day") }} />}
              {!proj && (
                <section aria-label="By project" className="rounded-xl border bg-card px-4 pt-3.5 pb-1.5">
                  <h2 className="text-[12.5px] font-medium text-muted-foreground">By project</h2>
                  <div className="mt-2.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full">{bars.map((b) => <span key={b.id || "none"} style={{ width: `${(100 * b.mins) / total}%`, background: colorOf(b.id) }} />)}</div>
                  <div className="mt-2.5">
                    {bars.map((b) => { const sp = b.id ? projects.find((p) => p.id === b.id) : null; return (
                      <button key={b.id || "none"} onClick={() => b.id && go(routes.time(b.id))} disabled={!b.id} className="grid h-9 w-full grid-cols-[20px_minmax(0,1fr)_auto_36px] items-center gap-2.5 border-t text-left enabled:hover:[&>span:nth-child(2)]:underline">
                        {sp ? <SiteIcon runId={sp.iconRun || undefined} name={sp.name} color={sp.color} className="size-5 rounded-[5px] text-[10px]" /> : <span className="size-5 rounded-[5px] bg-muted" />}
                        <span className="truncate text-[13.5px] underline-offset-2">{b.name}</span>
                        <span className="text-right text-[13.5px] tabular">{fmtMins(b.mins)}</span>
                        <span className="text-right text-[12.5px] text-muted-foreground tabular">{Math.round((100 * b.mins) / total)}%</span>
                      </button>
                    ) })}
                  </div>
                </section>
              )}
            </div>
          )}

          {pj && pj.invoices.length > 0 && <p className="-mt-3 text-[13px] text-muted-foreground">{pj.name}’s invoices, for hours and payments, are on its <button onClick={() => go(routes.project(pj.id, "money"))} className="underline underline-offset-2 hover:text-foreground">Money tab</button>.</p>}

          <section className="grid">
            <AddRow key={addDay} project={project || null} day={addDay} />
            {dayKeys.map((d) => {
              const rows = days.get(d)!
              const sum = rows.reduce((n, e) => n + e.mins, 0) + (live && d === today() ? runMins(live, now) : 0)
              return (
                <div key={d} className="mt-6">
                  <div className="flex h-9 items-baseline gap-2 border-b"><h2 className="flex-1 text-[14px] font-medium">{d === today() ? "Today" : longDay(d)}</h2><span className="text-[13px] text-muted-foreground tabular">{fmtMins(sum)}</span></div>
                  {live && d === today() && (
                    <div className="grid min-h-[50px] grid-cols-[minmax(0,1fr)_170px_150px_72px_28px] items-center gap-3 border-b border-border/60 py-1.5">
                      <Title e={{ title: live.title, item: live.item, taskId: live.taskId, itemId: live.itemId, projectId: live.projectId }} onOpen={() => openRef(live)} />
                      <span className="truncate text-[13px] text-muted-foreground">{project ? "" : live.pname || "No project"}</span>
                      <span className="text-right text-[13px] text-muted-foreground tabular">{timeOf(live.start)} to now</span>
                      <span className="flex items-center justify-end gap-1.5 text-[13.5px] text-brand-ink tabular"><span className="size-1.5 rounded-full bg-brand" />{clockOf(live, now)}</span>
                      <button onClick={() => stop()} aria-label="Stop the timer" title="Stop the timer" className="grid size-7 place-items-center rounded-md hover:bg-muted"><span className="size-[9px] rounded-[2px] bg-foreground" /></button>
                    </div>
                  )}
                  {rows.map((e) => <EntryRow key={e.id} e={e} showProject={!project} onEdit={() => setEditing(e)} />)}
                </div>
              )
            })}
            {entries && !dayKeys.length && <p className="mt-8 text-[14px] text-muted-foreground">No time logged {when}. Start a timer from Today or from a checklist item, or add time above.</p>}
          </section>
        </div>
      </div>
      <EditTimeDialog entry={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

/** Hours by day as stacked bars, a colour per project, biggest at the bottom. A bar opens that day. */
function DayChart({ span, perDay, order, colorOf, period, onDay }: { span: string[]; perDay: Map<string, Map<string, number>>; order: string[]; colorOf: (id: string | null) => string; period: Period; onDay: (d: string) => void }) {
  const totals = span.map((d) => [...(perDay.get(d)?.values() || [])].reduce((a, b) => a + b, 0))
  const max = Math.max(60, ...totals)
  const week = period === "week"
  const label = (d: string, i: number) => week ? new Date(d + "T00:00").toLocaleDateString([], { weekday: "short" }) : i % 7 === 0 ? String(Number(d.slice(8))) : ""
  return (
    <section aria-label="By day" className="rounded-xl border bg-card px-4 pt-4 pb-3">
      <div className={cn("grid h-[176px] items-end", week ? "gap-3" : "gap-[3px]")} style={{ gridTemplateColumns: `repeat(${span.length}, minmax(0, 1fr))` }}>
        {span.map((d, i) => (
          <button key={d} onClick={() => onDay(d)} title={`${longDay(d)}: ${totals[i] ? fmtMins(totals[i]!) : "nothing logged"}`} className="flex h-full min-w-0 flex-col justify-end gap-[2px] rounded-sm hover:opacity-85">
            {week && totals[i]! > 0 && <span className="pb-1 text-center text-[11.5px] text-muted-foreground tabular">{fmtMins(totals[i]!)}</span>}
            {order.slice().reverse().map((k) => { const m = perDay.get(d)?.get(k) || 0; return m > 0 && <span key={k} className="block shrink-0 rounded-[3px]" style={{ height: `${Math.max(2, (148 * m) / max)}px`, background: colorOf(k || null) }} /> })}
          </button>
        ))}
      </div>
      <div className={cn("mt-2 grid", week ? "gap-3" : "gap-[3px]")} style={{ gridTemplateColumns: `repeat(${span.length}, minmax(0, 1fr))` }}>
        {span.map((d, i) => <span key={d} className={cn("text-center text-[12px] text-muted-foreground tabular", d === today() && "font-medium text-foreground")}>{label(d, i)}</span>)}
      </div>
    </section>
  )
}

/** What the time was for, and what it's linked to: a checklist item or a task. */
function Title({ e, onOpen }: { e: Pick<TimeEntry, "title" | "item" | "taskId" | "itemId" | "projectId"> & { extraId?: string | null }; onOpen: () => void }) {
  const ref = e.item ? `Checklist item · ${e.item.phase}` : e.itemId ? "Checklist item" : e.extraId ? "Extra request" : e.taskId ? "Task" : ""
  return (
    <span className="grid min-w-0">
      <span className="truncate text-[13.5px]">{e.title || (e.item ? e.item.title : "Untitled")}</span>
      {ref && <button onClick={onOpen} className="w-fit truncate text-left text-[12px] text-muted-foreground hover:text-foreground hover:underline">{ref}</button>}
    </span>
  )
}

function EntryRow({ e, showProject, onEdit }: { e: TimeEntry; showProject: boolean; onEdit: () => void }) {
  const { projects } = useApp()
  const sp = e.projectId ? projects.find((p) => p.id === e.projectId) : null
  const flip = async () => { try { await api.editTime(e.id, { billable: !e.billable }); timeChanged() } catch (err) { toast.error((err as Error).message) } }
  const remove = async () => {
    try {
      await api.removeTime(e.id); timeChanged()
      toast("Deleted the entry", { action: { label: "Undo", onClick: async () => { await api.addTime({ title: e.title, projectId: e.gone ? null : e.projectId, itemId: e.itemId, day: e.day, mins: e.mins, billable: e.billable }).catch(() => {}); timeChanged() } } })
    } catch (err) { toast.error((err as Error).message) }
  }
  return (
    <div onDoubleClick={onEdit} className="group grid min-h-[50px] grid-cols-[minmax(0,1fr)_170px_150px_72px_28px] items-center gap-3 border-b border-border/60 py-1.5">
      <Title e={e} onOpen={() => openRef(e)} />
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        {showProject ? (e.projectId && !e.gone ? <button onClick={() => go(routes.time(e.projectId))} className="flex min-w-0 items-center gap-1.5 hover:text-foreground">{sp && <SiteIcon runId={sp.iconRun || undefined} name={sp.name} color={sp.color} className="size-4 shrink-0 rounded text-[8px]" />}<span className="truncate">{e.pname}</span></button> : <span className="truncate">{e.gone ? `${e.pname || "A project"} (deleted)` : "No project"}</span>) : null}
        {!e.billable && <span className="shrink-0 rounded bg-muted px-1.5 text-[11.5px] leading-5">Not billable</span>}
        {e.invoice && <span className="shrink-0 rounded bg-muted px-1.5 text-[11.5px] leading-5">Invoiced</span>}
      </span>
      <span className="text-right text-[13px] text-muted-foreground tabular">{e.start && e.end ? `${timeOf(e.start)} to ${timeOf(e.end)}` : "Added by hand"}</span>
      <span className="text-right text-[13.5px] tabular">{fmtMins(e.mins)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Entry options" className="opacity-60 group-hover:opacity-100" />}><MoreHorizontal /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit}><Pencil />Edit…</DropdownMenuItem>
          <DropdownMenuItem onClick={flip}>{e.billable ? "Mark not billable" : "Mark billable"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={remove}><Trash2 />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Time added by hand: what, the project, the day and how long, in one row. */
function AddRow({ project, day: initialDay }: { project: string | null; day: string }) {
  const [title, setTitle] = React.useState("")
  const [pid, setPid] = React.useState(project || store.get("timeProject", ""))
  const [day, setDay] = React.useState(initialDay)
  const [dur, setDur] = React.useState("")
  const mins = parseDur(dur)
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mins) return toast.error("Add how long, like 1h 30m.")
    try {
      await api.addTime({ title, projectId: pid || null, day, mins })
      toast(`Added ${fmtMins(mins)}`); setTitle(""); setDur(""); timeChanged()
      if (!project) store.set("timeProject", pid)
    } catch (err) { toast.error((err as Error).message) }
  }
  return (
    <form onSubmit={add} className="grid grid-cols-[minmax(0,1fr)_170px_150px_72px_28px] items-center gap-3 rounded-lg bg-muted/50 py-1.5 pr-1.5 pl-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What did you work on?" aria-label="What you worked on" className="h-8 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground" />
      {project ? <span /> : <ProjectSelect value={pid} onChange={setPid} />}
      <DateField boxed value={day} onChange={(v) => setDay(v || today())} className="h-8" />
      <Input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="1h 30m" aria-label="How long" className="h-8 text-right text-[13.5px]" />
      <Button type="submit" size="icon-sm" disabled={!mins} aria-label="Add the time" title="Add the time"><Plus /></Button>
    </form>
  )
}
