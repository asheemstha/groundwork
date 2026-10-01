import * as React from "react"
import { cn } from "cn"
import { Check, ChevronLeft, ChevronRight, Download, MoreHorizontal, Pencil, Plus, Receipt, Trash2, Undo2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TopBar } from "@/components/common/bits"
import { DateField } from "@/components/common/DateField"
import { EditTimeDialog, ProjectSelect, openRef } from "@/components/time/TimeBits"
import { useApp } from "@/hooks/useApp"
import { timeChanged, useTimeChanged, useTimer } from "@/hooks/useTimer"
import { api, fmtMoney, invoiceUrl, timeCsvUrl, type Project, type TimeEntry } from "@/lib/api"
import { makeInvoice } from "@/components/project/InvoiceDialog"
import { dayOf, fmtDay } from "@/lib/project"
import { today } from "@/lib/project"
import { clockOf, fmtMins, longDay, parseDur, periodLabel, rangeOf, runMins, shiftPeriod, timeOf, type Period } from "@/lib/time"
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
  const max = Math.max(1, ...bars.map((b) => b.mins))

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
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-12 pt-9 pb-14">
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

          {bars.length > (proj ? 0 : 1) && !proj && (
            <section aria-label="By project" className="grid gap-2.5">
              {bars.map((b) => (
                <button key={b.id || "none"} onClick={() => b.id && go(routes.time(b.id))} disabled={!b.id} className="grid grid-cols-[170px_minmax(0,1fr)_72px] items-center gap-3.5 rounded-md text-left enabled:hover:[&>span:first-child]:underline">
                  <span className="truncate text-[13.5px] underline-offset-2">{b.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.max(2, (100 * b.mins) / max)}%` }} /></span>
                  <span className="text-right text-[13.5px] tabular">{fmtMins(b.mins)}</span>
                </button>
              ))}
            </section>
          )}

          {pj && <Invoices p={pj} onChange={setPj} />}

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

/** A project's invoices: for payments and for hours, with when they're due or were paid. */
function Invoices({ p, onChange }: { p: Project; onChange: (x: Project) => void }) {
  if (!p.invoices.length) return null
  const act = async (f: () => Promise<Project>, msg?: string) => { try { onChange(await f()); timeChanged(); if (msg) toast(msg) } catch (e) { toast.error((e as Error).message) } }
  return (
    <section aria-label="Invoices" className="grid">
      <div className="flex h-9 items-baseline gap-2 border-b"><h2 className="flex-1 text-[14px] font-medium">Invoices</h2><span className="text-[13px] text-muted-foreground">{p.invoices.filter((x) => !x.paid).length} waiting on payment</span></div>
      {p.invoices.map((x) => {
        const late = !x.paid && !!x.due && x.due < today()
        const what = x.kind === "hours" ? `${x.hours ? `${x.hours} hours` : "Hours"}${x.from ? `, ${fmtDay(x.from)} to ${fmtDay(x.to)}` : ""}` : p.phases.find((ph) => ph.id === x.phaseId)?.payment?.label || "Payment"
        return (
          <div key={x.id} className="group grid min-h-[46px] grid-cols-[110px_minmax(0,1fr)_140px_110px_28px] items-center gap-3 border-b border-border/60 text-[13.5px]">
            <a href={invoiceUrl(p.id, x.id)} download className="tabular hover:underline">{x.number}</a>
            <span className="truncate text-muted-foreground">{what}</span>
            <span className={cn("text-right text-[13px]", late ? "text-destructive" : "text-muted-foreground")}>{x.paid ? `Paid ${fmtDay(dayOf(x.paid))}` : late ? `Was due ${fmtDay(x.due)}` : x.due ? `Due ${fmtDay(x.due)}` : "Not paid yet"}</span>
            <span className="text-right tabular">{fmtMoney(x.total, x.currency)}</span>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Invoice options" className="opacity-60 group-hover:opacity-100" />}><MoreHorizontal /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem render={<a href={invoiceUrl(p.id, x.id)} download />}><Download />Download the PDF</DropdownMenuItem>
                {x.paid ? <DropdownMenuItem onClick={() => act(() => api.setInvoice(p.id, x.id, { paid: false }))}><Undo2 />Not paid after all</DropdownMenuItem> : <DropdownMenuItem onClick={() => act(() => api.setInvoice(p.id, x.id, { paid: true }), `Invoice ${x.number} marked paid`)}><Check />Mark paid</DropdownMenuItem>}
                {!x.paid && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => act(() => api.removeInvoice(p.id, x.id), x.kind === "hours" ? "Removed the invoice. Its hours can be invoiced again." : "Removed the invoice")}><Trash2 />Remove the invoice</DropdownMenuItem></>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}
    </section>
  )
}

/** What the time was for, and what it's linked to: a checklist item or a task. */
function Title({ e, onOpen }: { e: Pick<TimeEntry, "title" | "item" | "taskId" | "itemId" | "projectId">; onOpen: () => void }) {
  const ref = e.item ? `Checklist item · ${e.item.phase}` : e.itemId ? "Checklist item" : e.taskId ? "Task" : ""
  return (
    <span className="grid min-w-0">
      <span className="truncate text-[13.5px]">{e.title || (e.item ? e.item.title : "Untitled")}</span>
      {ref && <button onClick={onOpen} className="w-fit truncate text-left text-[12px] text-muted-foreground hover:text-foreground hover:underline">{ref}</button>}
    </span>
  )
}

function EntryRow({ e, showProject, onEdit }: { e: TimeEntry; showProject: boolean; onEdit: () => void }) {
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
        {showProject ? (e.projectId && !e.gone ? <button onClick={() => go(routes.time(e.projectId))} className="truncate hover:text-foreground hover:underline">{e.pname}</button> : <span className="truncate">{e.gone ? `${e.pname || "A project"} (deleted)` : "No project"}</span>) : null}
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
