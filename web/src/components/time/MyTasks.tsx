import * as React from "react"
import { cn } from "cn"
import { ArrowRight, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PlayButton, ProjectSelect } from "@/components/time/TimeBits"
import { timeChanged, useTimeChanged, useTimer } from "@/hooks/useTimer"
import { api, type Task } from "@/lib/api"
import { fmtDay, today } from "@/lib/project"
import { addDays, clockOf, fmtMins } from "@/lib/time"
import { store } from "@/lib/store"
import { go, routes } from "@/lib/router"

/**
 * My tasks for today: typed in one line ("Call Sam 30m", the time at the end is the estimate), each with a project, a
 * timer and a tick. Unfinished tasks from earlier days stay on the list until they're done or moved.
 */
export function MyTasks({ onCount }: { onCount?: (left: number) => void }) {
  const { state, now, stop } = useTimer()
  const [list, setList] = React.useState<Task[] | null>(null)
  const [text, setText] = React.useState("")
  const [pid, setPid] = React.useState(() => store.get("taskProject", ""))
  const [showDone, setShowDone] = React.useState(false)
  const load = React.useCallback(() => { api.tasks().then((r) => setList(r.tasks)).catch(() => {}) }, [])
  React.useEffect(load, [load])
  useTimeChanged(load)
  const open = (list || []).filter((t) => !t.done), done = (list || []).filter((t) => t.done)
  React.useEffect(() => { if (list) onCount?.(open.length) }, [list]) // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    try { await api.addTask({ text, projectId: pid || null }); setText(""); store.set("taskProject", pid); load() } catch (err) { toast.error((err as Error).message) }
  }
  const logged = state?.today.mins || 0
  // A timer counts as this task's when it was started from it, or runs on the checklist item the task is for.
  const r = state?.running || null
  const runsOn = (t: Task) => (r && (r.taskId === t.id || (!r.taskId && !!t.itemId && r.itemId === t.itemId && r.projectId === t.projectId)) ? r : null)
  return (
    <section>
      <div className="mb-1.5 flex items-baseline gap-2">
        <h2 className="text-[14px] font-medium">My tasks</h2>
        <span className="text-[13px] text-muted-foreground">{list ? (open.length ? `${open.length} left` : list.length ? "all done" : "") : ""}</span>
        <span className="flex-1" />
        <button onClick={() => go(routes.time())} className="text-[13px] text-muted-foreground tabular hover:text-foreground">{logged ? `${fmtMins(logged)} logged today` : "Nothing logged today"}</button>
      </div>
      <form onSubmit={add} className="-mx-2 grid min-h-[44px] grid-cols-[18px_minmax(0,1fr)_minmax(0,190px)] items-center gap-3 rounded-md px-2">
        <span className="grid place-items-center text-[18px] leading-none text-muted-foreground">+</span>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task, like “Call Sam 30m”" aria-label="Add a task" className="h-9 min-w-0 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
        <ProjectSelect value={pid} onChange={setPid} className="justify-self-end border-transparent bg-transparent hover:border-input hover:bg-card" />
      </form>
      <div className="-mx-2">
        {open.map((t) => { const on = runsOn(t); return <TaskRow key={t.id} t={t} running={on} now={now} reload={load} onStopIfRunning={() => on && stop()} /> })}
      </div>
      {list && !list.length && <p className="py-2 text-[13.5px] text-muted-foreground">Plan your day here. Add what you’ll work on, with a rough time if you like, and start a timer on it.</p>}
      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone(!showDone)} className="mt-1 flex h-8 items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ChevronRight className={cn("size-3.5 transition-transform", showDone && "rotate-90")} />Done today <span className="tabular">{done.length}</span></button>
          {showDone && <div className="-mx-2">{done.map((t) => <TaskRow key={t.id} t={t} running={null} now={now} reload={load} />)}</div>}
        </>
      )}
    </section>
  )
}

function TaskRow({ t, running, now, reload, onStopIfRunning }: { t: Task; running: NonNullable<ReturnType<typeof useTimer>["state"]>["running"]; now: number; reload: () => void; onStopIfRunning?: () => void }) {
  const [editing, setEditing] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [pid, setPid] = React.useState("")
  const save = async (b: Parameters<typeof api.editTask>[1], msg?: string) => { try { await api.editTask(t.id, b); if (msg) toast(msg); reload(); timeChanged() } catch (e) { toast.error((e as Error).message) } }
  const toggle = async () => { if (!t.done) onStopIfRunning?.(); await save({ done: !t.done }) }
  const remove = async () => {
    try { await api.removeTask(t.id); reload(); toast("Deleted the task", { action: { label: "Undo", onClick: async () => { await api.addTask({ text: t.title + (t.est ? ` ${fmtMins(t.est).replace(" ", "")}` : ""), projectId: t.projectId, itemId: t.itemId, day: t.day }).catch(() => {}); reload() } } }) } catch (e) { toast.error((e as Error).message) }
  }
  const startEdit = () => { setTitle(t.title + (t.est ? ` ${fmtMins(t.est).replace(" ", "")}` : "")); setPid(t.projectId || ""); setEditing(true) }
  if (editing) return (
    <form onSubmit={(e) => { e.preventDefault(); save({ title, projectId: pid || null }); setEditing(false) }} className="grid min-h-[44px] grid-cols-[18px_minmax(0,1fr)_minmax(0,190px)_auto] items-center gap-3 rounded-md bg-muted/50 px-2">
      <span />
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} aria-label="Task" className="h-9 min-w-0 bg-transparent text-[14px] outline-none" />
      <ProjectSelect value={pid} onChange={setPid} />
      <span className="flex gap-1"><Button size="sm" type="submit">Save</Button><Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button></span>
    </form>
  )
  // Time on the task: the clock while it runs, else what's logged against the estimate.
  const time = running ? clockOf(running, now) : t.est ? (t.mins ? `${fmtMins(t.mins)} of ${fmtMins(t.est)}` : fmtMins(t.est)) : t.mins ? fmtMins(t.mins) : ""
  const from = !t.done && t.day < today() ? `from ${t.day === addDays(today(), -1) ? "yesterday" : fmtDay(t.day, true)}` : ""
  return (
    <div onDoubleClick={() => !t.done && startEdit()} className="group grid min-h-[44px] grid-cols-[18px_minmax(0,1fr)_auto_96px_28px_28px] items-center gap-3 rounded-md px-2 hover:bg-muted/50">
      <button onClick={toggle} aria-label={t.done ? "Mark not done" : "Mark done"} title={t.done ? "Mark not done" : "Mark done"} className="grid place-items-center">
        {t.done ? <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8.5" className="fill-done" /><path d="m5.5 9.2 2.3 2.3 4.7-4.7" fill="none" className="stroke-background" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.75" fill="none" className="stroke-input" strokeWidth="1.5" /></svg>}
      </button>
      <span className="grid min-w-0">
        <span className={cn("truncate text-[14px]", t.done && "text-muted-foreground")}>{t.title}{from && <span className="ml-2 text-[12.5px] text-muted-foreground">{from}</span>}</span>
        {t.item && <button onClick={() => t.projectId && t.itemId && go(routes.item(t.projectId, t.itemId))} className="w-fit truncate text-left text-[12px] text-muted-foreground hover:text-foreground hover:underline">Checklist item · {t.item.phase}</button>}
      </span>
      <span className="min-w-0">{t.projectId && t.pname ? <button onClick={() => go(routes.project(t.projectId!))} className="block max-w-[180px] truncate text-[13px] text-muted-foreground hover:text-foreground hover:underline">{t.pname}</button> : null}</span>
      <span className={cn("text-right text-[13px] whitespace-nowrap tabular", running ? "text-brand-ink" : "text-muted-foreground")}>{running && <span className="mr-1.5 inline-block size-1.5 translate-y-[-1px] rounded-full bg-brand" />}{time}</span>
      {t.done ? <span /> : <PlayButton running={running} start={{ taskId: t.id, projectId: t.projectId, itemId: t.itemId, title: t.title }} label="Start a timer on this task" />}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Task options" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100" />}><MoreHorizontal /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {!t.done && <DropdownMenuItem onClick={startEdit}><Pencil />Edit</DropdownMenuItem>}
          {!t.done && <DropdownMenuItem onClick={() => save({ day: addDays(today(), 1) }, "Moved to tomorrow")}><ArrowRight />Move to tomorrow</DropdownMenuItem>}
          {!t.done && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={remove}><Trash2 />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
