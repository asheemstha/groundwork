import * as React from "react"
import { cn } from "cn"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateField } from "@/components/common/DateField"
import { useApp } from "@/hooks/useApp"
import { timeChanged, useTimer } from "@/hooks/useTimer"
import { api, type RunningTimer, type TimeEntry, type TimerStart } from "@/lib/api"
import { dayOf, today } from "@/lib/project"
import { clockOf, fmtMins, parseDur, runMins, timeOf } from "@/lib/time"
import { go, routes } from "@/lib/router"

/** Where a running timer or an entry leads: its checklist item, its project, or the Time page. */
export const openRef = (x: { projectId: string | null; itemId: string | null }) => go(x.projectId && x.itemId ? routes.item(x.projectId, x.itemId) : x.projectId ? routes.project(x.projectId) : routes.time())

/** Is the timer running on this task, or this checklist item? */
export function useRunningOn(match: { taskId?: string; projectId?: string; itemId?: string }) {
  const { state } = useTimer()
  const r = state?.running
  if (!r) return null
  if (match.taskId) return r.taskId === match.taskId ? r : null
  return match.itemId && r.projectId === match.projectId && r.itemId === match.itemId ? r : null
}

const Play = () => <span className="ml-0.5 size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />
const Stop = () => <span className="size-[9px] rounded-[2px] bg-current" />

/** A play button that starts a timer, or a stop button while that timer runs. */
export function PlayButton({ running, start, className, label = "Start a timer" }: { running: RunningTimer | null; start: TimerStart; className?: string; label?: string }) {
  const t = useTimer()
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (running) t.stop(); else t.start(start) }}
      aria-label={running ? "Stop the timer" : label}
      title={running ? "Stop the timer" : label}
      className={cn("grid size-7 shrink-0 place-items-center rounded-md transition-colors", running ? "text-foreground hover:bg-muted" : "text-muted-foreground hover:bg-muted hover:text-foreground", className)}
    >
      {running ? <Stop /> : <Play />}
    </button>
  )
}

/** The running timer at the top of the sidebar: what it's on, how long, and stop. */
export function TimerCard() {
  const { state, now, stop } = useTimer()
  const r = state?.running
  if (!r) return null
  return (
    <div className="mb-3 grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-sidebar-border bg-background/80 py-2 pr-2 pl-3">
      <span className="size-2 rounded-full bg-brand" />
      <button onClick={() => openRef(r)} className="grid min-w-0 text-left">
        <span className="truncate text-[13px]">{r.title || r.pname || "Timer"}</span>
        <span className="truncate text-[12px] text-muted-foreground tabular">{r.pname && r.title ? `${r.pname} · ` : ""}{clockOf(r, now)}</span>
      </button>
      <button onClick={() => stop()} aria-label="Stop the timer" title="Stop the timer" className="grid size-7 place-items-center rounded-md border border-sidebar-border bg-background text-foreground hover:bg-muted"><Stop /></button>
    </div>
  )
}

const at = (t: number) => (dayOf(t) === today() ? timeOf(t) : `${new Date(t).toLocaleDateString([], { weekday: "short" })} ${timeOf(t)}`)

/**
 * The timer asks when it might be wrong: after time away from the Mac (it noticed no keyboard or mouse, or the Mac
 * slept, or Groundwork was closed), and when it has run for 3 hours since you last said you're still on it.
 */
export function TimerCheck() {
  const { state, now, set, stop } = useTimer()
  const r = state?.running
  const act = async (f: () => Promise<Parameters<typeof set>[0]>) => { try { set(await f()); timeChanged() } catch (e) { toast.error((e as Error).message) } }
  const kind = !r ? null : r.away ? "away" : now - (r.checked || r.start) >= 3 * 3600e3 ? "long" : null
  const what = r ? `“${r.title || r.pname || "the timer"}”` : ""
  // A Mac notification too, once, when Groundwork isn't in front.
  const key = r && kind ? r.id + kind + (r.away?.from || r.checked || 0) : ""
  React.useEffect(() => {
    if (!key || typeof Notification === "undefined" || Notification.permission !== "granted" || document.hasFocus()) return
    const n = new Notification(kind === "away" ? "Is the timer still right?" : "Still on it?", { body: kind === "away" ? `It kept running while you were away, on ${what}.` : `The timer has been running on ${what} for a while.` })
    n.onclick = () => window.focus()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!r || !kind) return null
  return (
    <div role="status" className="fixed bottom-4 left-4 z-50 grid w-[340px] gap-3 rounded-xl bg-foreground p-4 text-background shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
      {kind === "away" ? (
        <>
          <p className="text-[13.5px] leading-relaxed">You were away for {fmtMins(Math.round((r.away!.to - r.away!.from) / 60e3))}, from {at(r.away!.from)} to {at(r.away!.to)}, with the timer on {what}.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => act(() => api.awayTime("stop"))}>Stop it at {timeOf(r.away!.from)}</Button>
            <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background" onClick={() => act(() => api.awayTime("trim"))}>Take it out, keep going</Button>
            <Button size="sm" variant="ghost" className="text-background/70 hover:bg-background/10 hover:text-background" onClick={() => act(() => api.awayTime("keep"))}>Keep it all</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13.5px] leading-relaxed">The timer has been running for {fmtMins(runMins(r, now))}. Still on {what}?</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => act(() => api.stillOn())}>Still on it</Button>
            <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background" onClick={() => stop()}>Stop it now</Button>
          </div>
        </>
      )}
    </div>
  )
}

/** The projects to log time against, as a plain select. */
export function ProjectSelect({ value, onChange, className, none = "No project" }: { value: string; onChange: (id: string) => void; className?: string; none?: string }) {
  const { projects } = useApp()
  const list = projects.filter((p) => p.kind !== "audit")
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Project" className={cn("h-8 min-w-0 rounded-md border border-input bg-card px-2 text-[13px] text-foreground", !value && "text-muted-foreground", className)}>
      <option value="">{none}</option>
      {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      {value && !list.some((p) => p.id === value) && <option value={value}>Deleted project</option>}
    </select>
  )
}

/** Time added by hand: how long and which day, for a project or one of its items. */
export function AddTime({ projectId, itemId, title, onDone, className }: { projectId: string | null; itemId?: string | null; title?: string; onDone?: () => void; className?: string }) {
  const [dur, setDur] = React.useState(""), [day, setDay] = React.useState(today())
  const mins = parseDur(dur)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mins) return toast.error("Add how long, like 1h 30m.")
    try { await api.addTime({ projectId, itemId, title, day, mins }); toast(`Added ${fmtMins(mins)}`); setDur(""); timeChanged(); onDone?.() } catch (err) { toast.error((err as Error).message) }
  }
  return (
    <form onSubmit={save} className={cn("flex flex-wrap items-center gap-2", className)}>
      <Input autoFocus value={dur} onChange={(e) => setDur(e.target.value)} placeholder="1h 30m" aria-label="How long" className="h-8 w-28 text-[13px]" />
      <DateField boxed value={day} onChange={(v) => setDay(v || today())} className="h-8 w-auto" />
      <Button size="sm" type="submit" disabled={!mins}>Add {mins ? fmtMins(mins) : ""}</Button>
      {onDone && <Button size="sm" variant="ghost" type="button" onClick={onDone}>Cancel</Button>}
    </form>
  )
}

const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }
const withTime = (day: string, v: string) => { const [h, m] = v.split(":").map(Number); const [y, mo, d] = day.split("-").map(Number); return new Date(y!, mo! - 1, d!, h!, m!).getTime() }

/** Change an entry: what it was, the project, the day, the times or the length, billable. */
export function EditTimeDialog({ entry, onClose }: { entry: TimeEntry | null; onClose: () => void }) {
  const [f, setF] = React.useState({ title: "", projectId: "", day: today(), dur: "", start: "", end: "", billable: true })
  React.useEffect(() => {
    if (entry) setF({ title: entry.title, projectId: entry.projectId || "", day: entry.day, dur: fmtMins(entry.mins), start: entry.start ? hhmm(entry.start) : "", end: entry.end ? hhmm(entry.end) : "", billable: entry.billable })
  }, [entry])
  if (!entry) return null
  const timed = !!entry.start
  const save = async () => {
    try {
      const b: Parameters<typeof api.editTime>[1] = { title: f.title, projectId: f.projectId || null, day: f.day, billable: f.billable }
      if (timed && f.start && f.end) { const s = withTime(f.day, f.start); let e = withTime(f.day, f.end); if (e <= s) e += 864e5; b.start = s; b.end = e }
      else b.dur = f.dur
      await api.editTime(entry.id, b); timeChanged(); onClose()
    } catch (e) { toast.error((e as Error).message) }
  }
  const remove = async () => { try { await api.removeTime(entry.id); timeChanged(); onClose(); toast("Deleted the entry") } catch (e) { toast.error((e as Error).message) } }
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Time entry</DialogTitle><DialogDescription>{entry.item ? `For the checklist item “${entry.item.title}”.` : entry.by === "timer" ? "Logged with the timer." : "Added by hand."}</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-[13px] font-medium">What<Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="font-normal" /></label>
          <label className="grid gap-1.5 text-[13px] font-medium">Project<ProjectSelect value={f.projectId} onChange={(projectId) => setF({ ...f, projectId })} className="h-9 text-sm font-normal" /></label>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 text-[13px] font-medium">Day<DateField boxed value={f.day} onChange={(v) => setF({ ...f, day: v || f.day })} /></div>
            {!timed && <label className="grid gap-1.5 text-[13px] font-medium">How long<Input value={f.dur} onChange={(e) => setF({ ...f, dur: e.target.value })} placeholder="1h 30m" className="font-normal" /></label>}
          </div>
          {timed && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-[13px] font-medium">From<Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="font-normal" /></label>
              <label className="grid gap-1.5 text-[13px] font-medium">To<Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="font-normal" /></label>
            </div>
          )}
          <label className="flex items-center gap-2 text-[13.5px]"><Checkbox checked={f.billable} onCheckedChange={(v) => setF({ ...f, billable: !!v })} />Billable</label>
        </div>
        <DialogFooter className="items-center">
          <Button variant="ghost" className="mr-auto text-muted-foreground" onClick={remove}>Delete</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
