import * as React from "react"
import { cn } from "cn"
import { Ban, CalendarDays, Check, ChevronDown, ChevronRight, Copy, ExternalLink, Info, Layers, Link2, Loader2, Mail, MessageSquare, MoreHorizontal, Paperclip, Pencil, Stamp, Trash2, Undo2, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { SiteIcon, Spinner, TopBar } from "@/components/common/bits"
import { Chip } from "@/pages/Dashboard"
import { useApp } from "@/hooks/useApp"
import { api, proofUrl, type MessageTemplate, type PItem, type PPhase, type Project, type TemplateSummary } from "@/lib/api"
import { dueLabel, fmtDay, renderMessage, today } from "@/lib/project"
import { ago } from "@/lib/format"
import { go, routes } from "@/lib/router"
import { LaunchCard, LaunchItemPanel, LaunchReportPage, useLaunchRefresh } from "@/components/project/LaunchCheck"
import { RedirectCard, RedirectsPage } from "@/components/project/Redirects"

type Tab = "checklist" | "client" | "tools" | "launch" | "redirects"
type SetItem = (itemId: string, b: Parameters<typeof api.setItem>[2]) => Promise<void>

export function ProjectPage({ id, tab, sub }: { id: string; tab: Tab; sub?: string }) {
  const { runs, refreshProjects } = useApp()
  const [p, setP] = React.useState<Project | null>(null)
  const [missing, setMissing] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const load = React.useCallback(() => api.project(id).then((x) => { setP(x); setMissing(false) }).catch(() => setMissing(true)), [id])
  React.useEffect(() => { load() }, [load, runs])
  // While a launch check runs, keep the checklist current so its items tick as soon as it ends.
  const checking = p?.tools.launchRunning?.id
  React.useEffect(() => { if (!checking) return; const t = setInterval(load, 3000); return () => clearInterval(t) }, [checking, load])
  useLaunchRefresh(p)

  const setItem: SetItem = async (itemId, b) => {
    try { setP(await api.setItem(id, itemId, b)); refreshProjects().catch(() => {}) } catch (e) { toast.error((e as Error).message) }
  }
  if (missing) return <div className="grid h-full place-items-center text-sm text-muted-foreground">This project doesn’t exist any more.</div>
  if (!p) return <div className="grid h-full place-items-center"><Spinner /></div>
  const open = p.client.late.length + p.client.soon.length

  return (
    <div className="flex h-full flex-col">
      <TopBar className="gap-2.5">
        <SiteIcon runId={p.tools.iconRun || undefined} name={p.name} className="size-[22px] rounded-md text-[10px]" />
        <span className="text-sm font-medium">{p.name}</span>
        {p.host && <span className="text-[13px] text-muted-foreground">{p.host}</span>}
        <nav aria-label="Project" className="ml-3 flex gap-0.5">
          <TabLink on={tab === "checklist"} onClick={() => go(routes.project(id))}>Checklist</TabLink>
          <TabLink on={tab === "client"} onClick={() => go(routes.project(id, "client"))}>Client <span className="text-xs text-muted-foreground tabular">{open}</span>{p.client.late.length > 0 && <span className="size-1.5 rounded-full bg-destructive" aria-label={`${p.client.late.length} late`} />}</TabLink>
          <TabLink on={tab === "tools" || tab === "launch" || tab === "redirects"} onClick={() => go(routes.project(id, "tools"))}>Tools <span className="text-xs text-muted-foreground tabular">{p.tools.runs.length}</span></TabLink>
        </nav>
        <span className="flex-1" />
        <button onClick={() => setEditing(true)} className="inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground"><CalendarDays className="size-3.5" />{p.launch ? `Launch ${fmtDay(p.launch)}` : "Set dates"}</button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Project options" />}><MoreHorizontal /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setEditing(true)}><Pencil /> Edit details…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}><Trash2 /> Delete project…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TopBar>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        {tab === "checklist" && <ChecklistTab p={p} setItem={setItem} setP={setP} reload={load} />}
        {tab === "client" && <ClientTab p={p} setItem={setItem} setP={setP} />}
        {tab === "tools" && <ToolsTab p={p} reload={load} />}
        {tab === "launch" && <LaunchReportPage key={sub || ""} p={p} sub={sub} reload={load} />}
        {tab === "redirects" && <RedirectsPage p={p} reload={load} />}
      </div>
      <EditDialog p={p} open={editing} onClose={() => setEditing(false)} onSaved={(x) => { setP(x); refreshProjects() }} />
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
            <AlertDialogDescription>This deletes the project’s checklist, sign-offs and notes from this computer. The site’s scans and plans stay under Other sites. You can’t undo it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => { await api.removeProject(id); await refreshProjects(); go(routes.home) }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TabLink({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-current={on ? "page" : undefined} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>{children}</button>
}

// ---------- status icon ----------
function StatusIcon({ it, onClick, size = 18 }: { it: PItem; onClick?: () => void; size?: number }) {
  const prog = it.toolInfo?.progress
  let icon: React.ReactNode
  if (it.status === "done") icon = <svg width={size} height={size} viewBox="0 0 18 18"><circle cx="9" cy="9" r="8.5" className={it.auto ? "fill-brand" : "fill-done"} /><path d="m5.5 9.2 2.3 2.3 4.7-4.7" fill="none" className="stroke-background" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  else if (it.status === "na") icon = <svg width={size} height={size} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.75" fill="none" className="stroke-input" strokeWidth="1.5" /><path d="M4 14 14 4" className="stroke-input" strokeWidth="1.5" /></svg>
  else if (prog && prog.total && prog.done) icon = <svg width={size} height={size} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" className="stroke-muted" strokeWidth="2" /><circle cx="9" cy="9" r="7" fill="none" className="stroke-brand" strokeWidth="2" strokeDasharray={`${(44 * prog.done) / prog.total} 44`} strokeLinecap="round" transform="rotate(-90 9 9)" /></svg>
  else icon = <svg width={size} height={size} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.75" fill="none" className="stroke-input" strokeWidth="1.5" strokeDasharray={it.who === "client" && !it.asked ? "2.5 2.5" : undefined} /></svg>
  if (!onClick) return <span className="grid place-items-center">{icon}</span>
  return <button onClick={(e) => { e.stopPropagation(); onClick() }} className="grid place-items-center rounded-full" aria-label={it.status === "done" ? "Mark not done" : "Mark done"} title={it.status === "done" ? "Mark not done" : "Mark done"}>{icon}</button>
}

// ---------- checklist ----------
type Filter = "all" | "us" | "client" | "tools"
function ChecklistTab({ p, setItem, setP, reload }: { p: Project; setItem: SetItem; setP: (x: Project) => void; reload: () => void }) {
  const [sel, setSel] = React.useState(p.current || p.phases[p.phases.length - 1]!.id)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [hideDone, setHideDone] = React.useState(false)
  const [itemId, setItemId] = React.useState<string | null>(null)
  const [signing, setSigning] = React.useState(false)
  React.useEffect(() => { setSel(p.current || p.phases[p.phases.length - 1]!.id) }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const ph = p.phases.find((x) => x.id === sel) || p.phases[0]!
  const all = [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items]
  const match = (it: PItem) => (filter === "all" || (filter === "us" && it.who === "us") || (filter === "client" && it.who === "client") || (filter === "tools" && !!it.tool)) && !(hideDone && it.status !== "todo")
  const allItems = p.phases.flatMap((x) => [...x.groups.flatMap((g) => g.items), ...x.handoff.items])
  const item = itemId ? allItems.find((x) => x.id === itemId) || null : null
  const toggle = (it: PItem) => setItem(it.id, { status: it.status === "done" ? "todo" : "done" })
  const waiting = [...p.client.late, ...p.client.soon]
  const toolItems = all.filter((x) => x.tool)

  return (
    <div className="flex flex-col">
      <ol aria-label="Phases" className="grid gap-2 px-7 pt-5" style={{ gridTemplateColumns: `repeat(${p.phases.length}, minmax(0, 1fr))` }}>
        {p.phases.map((x) => (
          <li key={x.id}>
            <button onClick={() => setSel(x.id)} aria-current={x.id === p.current ? "step" : undefined} className={cn("flex h-16 w-full flex-col justify-between rounded-[10px] border px-3 py-2.5 text-left transition-colors", x.id === sel ? "border-input bg-card shadow-[0_1px_3px_rgba(22,23,22,0.08)]" : x.state === "signed" ? "bg-muted/50" : "border-dashed", x.id !== sel && "hover:bg-muted/40")}>
              <span className="flex items-center gap-1.5 text-[13.5px]"><span className="text-xs text-muted-foreground tabular">{String(x.index).padStart(2, "0")}</span><span className={cn(x.state === "upcoming" && x.id !== sel ? "text-muted-foreground" : "font-medium")}>{x.name}</span><span className="flex-1" />{x.state === "signed" ? <svg width="15" height="15" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8.5" className="fill-done" /><path d="m5.5 9.2 2.3 2.3 4.7-4.7" fill="none" className="stroke-background" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : x.state === "current" ? <span className="text-xs text-muted-foreground tabular">{x.done} of {x.total}</span> : null}</span>
              {x.state === "signed" ? <span className="text-xs text-muted-foreground">Signed off {fmtDay(x.signoff!.date)}</span> : x.state === "current" ? <span className="h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand" style={{ width: `${x.total ? (100 * x.done) / x.total : 0}%` }} /></span> : <span className="text-xs text-muted-foreground">{x.total} items{x.done ? `, ${x.done} done early` : ""}</span>}
            </button>
          </li>
        ))}
      </ol>
      <div className="grid gap-7 px-7 pt-5 pb-8 lg:grid-cols-[minmax(0,1fr)_316px]">
        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2.5">
            <div role="group" aria-label="Show" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
              {([["all", "All", all.length], ["us", "Ours", all.filter((x) => x.who === "us").length], ["client", "Client", all.filter((x) => x.who === "client").length], ["tools", "Groundwork", all.filter((x) => x.tool).length]] as const).map(([k, l, n]) => (
                <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", filter === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}<span className="text-xs font-normal text-muted-foreground tabular">{n}</span></button>
              ))}
            </div>
            <span className="flex-1" />
            <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="size-[15px] accent-foreground" />Hide done</label>
          </div>
          {ph.groups.map((g) => {
            const items = g.items.filter(match)
            if (!items.length) return null
            return <Group key={g.id} name={g.name} done={g.items.filter((x) => x.status !== "todo").length} total={g.items.length}>{items.map((it) => <ItemRow key={it.id} it={it} onToggle={() => toggle(it)} onOpen={() => setItemId(it.id)} />)}</Group>
          })}
          <SignoffCard p={p} ph={ph} onReview={() => setSigning(true)} onUndo={async () => setP(await api.unsign(p.id, ph.id))} onOpen={setItemId} match={match} toggle={toggle} />
        </div>
        <aside className="flex min-w-0 flex-col gap-3.5">
          <section className="rounded-xl border bg-card p-4">
            <div className="text-[12.5px] text-muted-foreground">{ph.name} phase</div>
            <div className="mt-1.5 flex items-baseline gap-1.5"><span className="text-[22px] font-medium tabular">{ph.done}</span><span className="text-muted-foreground">of {ph.total} done</span></div>
            <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand" style={{ width: `${ph.total ? (100 * ph.done) / ph.total : 0}%` }} /></div>
            <dl className="mt-3.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
              {ph.due && <><dt className="text-muted-foreground">{ph.state === "signed" ? "Planned sign-off" : "Sign-off planned"}</dt><dd className="text-right">{fmtDay(ph.due)}</dd></>}
              {ph.signoff && <><dt className="text-muted-foreground">Signed off</dt><dd className="text-right">{fmtDay(ph.signoff.date)}</dd></>}
              {p.kickoff && <><dt className="text-muted-foreground">Kickoff</dt><dd className="text-right">{fmtDay(p.kickoff)}</dd></>}
              {p.launch && <><dt className="text-muted-foreground">Launch</dt><dd className="text-right">{fmtDay(p.launch)}</dd></>}
            </dl>
          </section>
          <section className="flex flex-col gap-2.5 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2"><h3 className="text-[13.5px] font-medium">Waiting on the client</h3><span className="text-[12.5px] text-muted-foreground tabular">{waiting.length}</span></div>
            {waiting.length ? waiting.slice(0, 4).map((x) => <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2 text-[13px]"><span className="truncate">{x.title}</span><span className={cn("text-right", x.late ? "text-destructive" : "text-muted-foreground")}>{x.late ? "Late" : dueLabel(x)}</span></div>) : <p className="text-[13px] text-muted-foreground">Nothing you’ve asked for is outstanding.</p>}
            <Button variant="outline" size="sm" className="mt-1" onClick={() => go(routes.project(p.id, "client"))}><Mail />Write a request message</Button>
          </section>
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2"><span className="grid size-[18px] place-items-center rounded-[5px] bg-brand text-brand-foreground"><Layers className="size-[11px]" strokeWidth={2.4} /></span><h3 className="text-[13.5px] font-medium">Groundwork can help</h3></div>
            {toolItems.length ? toolItems.map((x) => (
              <button key={x.id} onClick={() => setItemId(x.id)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 text-left">
                <span className="grid gap-0.5"><span className="text-[13px] font-medium">{x.title}</span><span className="text-xs text-muted-foreground">{x.toolInfo?.ready ? x.toolInfo.text || x.toolInfo.name : `${x.toolInfo?.name}, coming soon`}</span></span>
                {x.status === "done" ? <StatusIcon it={x} size={16} /> : x.toolInfo?.ready ? <span className="rounded-md border px-2 py-0.5 text-xs">Open</span> : <Chip className="border-dashed text-[11.5px]">Soon</Chip>}
              </button>
            )) : <p className="text-[13px] text-muted-foreground">No items in this phase use a Groundwork tool.</p>}
          </section>
        </aside>
      </div>
      <ItemSheet p={p} it={item} onClose={() => setItemId(null)} setItem={setItem} reload={reload} />
      <SignoffDialog p={p} ph={ph} open={signing} onClose={() => setSigning(false)} onDone={(x) => { setP(x); setSigning(false) }} />
    </div>
  )
}

function Group({ name, done, total, children }: { name: string; done: number; total: number; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true)
  return (
    <div className="mb-3.5">
      <button onClick={() => setOpen(!open)} className="flex h-[34px] w-full items-center gap-2 border-b text-left"><ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")} /><h2 className="text-[13.5px] font-medium">{name}</h2><span className="text-[12.5px] text-muted-foreground tabular">{done} of {total}</span></button>
      {open && children}
    </div>
  )
}

function ItemRow({ it, onToggle, onOpen }: { it: PItem; onToggle: () => void; onOpen: () => void }) {
  const faded = it.status !== "todo"
  let tag: React.ReactNode = null
  if (it.who === "client" && it.status === "todo") tag = <Chip className={cn(!it.asked && "border-dashed")}><User className="size-3" />{it.asked ? `Asked ${new Date(it.asked).toLocaleDateString([], { month: "short", day: "numeric" })}` : "Not asked yet"}</Chip>
  else if (it.tool && it.toolInfo) tag = it.toolInfo.ready
    ? <Chip className="bg-muted/60 text-foreground/80"><span className="size-2 rounded-[2px] bg-brand" />{it.toolInfo.progress ? <>{it.toolInfo.name} <span className="text-muted-foreground tabular">{it.toolInfo.progress.done} of {it.toolInfo.progress.total}</span></> : it.status === "done" && it.auto ? "Done by Groundwork" : it.status === "todo" && it.toolInfo.issues ? <>{it.toolInfo.name} <span className="text-destructive tabular">{it.toolInfo.issues} {it.toolInfo.issues === 1 ? "issue" : "issues"}</span></> : it.toolInfo.name}</Chip>
    : <Chip className="border-dashed"><span className="size-2 rounded-[2px] bg-brand" />{it.toolInfo.name}, soon</Chip>
  else if (it.note || it.link) tag = <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80">{it.link ? <Link2 className="size-3" /> : <MessageSquare className="size-3" />}{it.link ? "Link" : "Note"}</span>
  return (
    <div onClick={onOpen} className="grid h-[37px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_180px_78px] items-center gap-3 border-b border-border/60 hover:bg-muted/30">
      <StatusIcon it={it} onClick={onToggle} />
      <span className={cn("truncate text-[13.5px]", faded && "text-muted-foreground", it.status === "na" && "line-through")}>{it.title}{it.carriedFrom && <span className="ml-2 text-xs text-muted-foreground">from {it.carriedFrom}</span>}</span>
      <span className="flex justify-end">{tag}</span>
      <span className={cn("text-right text-[12.5px] whitespace-nowrap", it.status === "todo" && it.late ? "text-destructive" : faded ? "text-muted-foreground/70" : "text-muted-foreground")}>{it.status === "na" ? "Not needed" : it.status === "done" ? (it.at ? fmtDay(new Date(it.at).toISOString().slice(0, 10)) : "Done") : dueLabel(it)}</span>
    </div>
  )
}

function SignoffCard({ p, ph, onReview, onUndo, onOpen, match, toggle }: { p: Project; ph: PPhase; onReview: () => void; onUndo: () => void; onOpen: (id: string) => void; match: (it: PItem) => boolean; toggle: (it: PItem) => void }) {
  const [open, setOpen] = React.useState(false)
  const h = ph.handoff
  const ready = h.items.filter((x) => x.status !== "todo").length
  const s = ph.signoff
  return (
    <div className="mt-1 rounded-[10px] border bg-muted/40">
      <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3">
        <Stamp className="size-[18px] text-foreground/70" />
        <div className="grid gap-0.5">
          <span className="font-medium">{h.title}</span>
          <span className="text-[12.5px] text-muted-foreground">
            {s ? <>Signed off {fmtDay(s.date)}{s.by ? ` by ${s.by}` : ""}{s.note ? `. ${s.note}` : ""}</> : <>{h.items.length ? `${h.items.length} deliverables, ${ready === h.items.length ? "all ready" : ready ? `${ready} ready` : "none ready yet"}. ` : ""}{h.needs === "client" ? "Needs the client’s written approval." : "You sign this one off yourself."}</>}
          </span>
          {s && (s.file || s.link) && <span className="mt-0.5 flex flex-wrap gap-3 text-[12.5px]">{s.file && <a href={proofUrl(p.id, s.file.stored)} className="inline-flex items-center gap-1 underline underline-offset-2"><Paperclip className="size-3" />{s.file.name}</a>}{s.link && <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2"><Link2 className="size-3" />Proof link</a>}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {h.items.length > 0 && <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? "Hide" : "Deliverables"}<ChevronRight className={cn("transition-transform", open && "rotate-90")} /></Button>}
          {s ? <Button variant="outline" size="sm" onClick={onUndo}><Undo2 />Undo</Button> : ph.state !== "upcoming" || ph.ready ? <Button variant="outline" size="sm" onClick={onReview}>Review handoff</Button> : null}
        </div>
      </div>
      {open && <div className="border-t bg-card/60 px-3.5 pb-1 rounded-b-[10px]">{h.items.filter(match).map((it) => <ItemRow key={it.id} it={it} onToggle={() => toggle(it)} onOpen={() => onOpen(it.id)} />)}</div>}
    </div>
  )
}

// ---------- item detail ----------
function ItemSheet({ p, it, onClose, setItem, reload }: { p: Project; it: PItem | null; onClose: () => void; setItem: SetItem; reload: () => void }) {
  const [note, setNote] = React.useState("")
  const [link, setLink] = React.useState("")
  React.useEffect(() => { setNote(it?.note || ""); setLink(it?.link || "") }, [it?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const last = React.useRef<PItem | null>(null)
  if (it) last.current = it
  const x = it || last.current
  const t = x?.toolInfo
  return (
    <Sheet open={!!it} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[500px]! max-w-[94vw]! gap-0 p-0" showCloseButton>
        {x && (
          <div className="flex h-full flex-col">
            <div className="flex h-[52px] shrink-0 items-center border-b px-5 text-[13px] text-muted-foreground">{x.phaseName}{x.who === "client" ? " · needed from the client" : ""}</div>
            <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-6 py-5">
              <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-3">
                <span className="mt-0.5"><StatusIcon it={x} size={22} /></span>
                <div className="grid gap-2.5">
                  <SheetTitle className="text-[19px] leading-snug font-medium">{x.title}</SheetTitle>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip className={cn(x.status === "todo" && "border-transparent bg-muted text-foreground/80")}>{x.status === "done" ? (x.auto ? "Done by Groundwork" : "Done") : x.status === "na" ? "Not needed" : x.late ? <span className="text-destructive">Late</span> : "To do"}</Chip>
                    {x.due && <Chip><CalendarDays className="size-3" />Due {fmtDay(x.due, true)}</Chip>}
                    <Chip>{x.who === "client" ? "Client" : "Ours"}</Chip>
                  </div>
                </div>
              </div>
              {x.doneMeans && <div className="grid gap-1 rounded-lg bg-muted/60 px-3.5 py-3"><span className="text-[12.5px] text-muted-foreground">Done means</span><p className="leading-relaxed">{x.doneMeans}</p></div>}
              {t && (
                <section className="grid gap-3 rounded-xl border bg-card p-4">
                  <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5"><span className="grid size-7 place-items-center rounded-md bg-brand text-brand-foreground"><Layers className="size-[15px]" strokeWidth={2.2} /></span><div className="grid gap-px"><h3 className="text-sm font-medium">{t.name}{t.checkName && <span className="font-normal text-muted-foreground">: {t.checkName}</span>}</h3><span className="text-[12.5px] text-muted-foreground">{t.ready ? t.text || "Not run yet" : "Coming soon to Groundwork"}</span></div></div>
                  {t.progress && t.progress.total > 0 && <><div className="flex items-baseline gap-1.5"><span className="text-xl font-medium tabular">{t.progress.done}</span><span className="text-muted-foreground">of {t.progress.total} {x.tool === "seo" ? "SEO changes" : "tag fixes"} done</span></div><div className="h-[5px] overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand" style={{ width: `${(100 * t.progress.done) / t.progress.total}%` }} /></div></>}
                  {x.tool === "launch" ? <LaunchItemPanel p={p} it={x} reload={reload} /> : t.ready && (t.runId
                    ? <div className="flex gap-2"><Button size="sm" onClick={() => go(x.tool === "headings" ? routes.review(t.runId!) : x.tool === "seo" ? routes.seo(t.runId!) : routes.run(t.runId!))}>{x.tool === "headings" ? "Open the to-do list" : x.tool === "seo" ? "Open the SEO plan" : "Open the scan"}</Button></div>
                    : x.tool === "redirects" ? <div className="flex gap-2"><Button size="sm" variant={p.tools.redirects ? "default" : "outline"} onClick={() => go(p.tools.redirects ? routes.project(p.id, "redirects") : routes.project(p.id, "tools"))}>{p.tools.redirects ? "Open the redirect map" : "Go to Tools"}</Button></div>
                    : x.tool === "seo" && p.tools.seoRunning ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => go(routes.run(p.tools.seoRunning!))}><Loader2 className="animate-spin" />Planning now</Button></div>
                    : x.tool === "seo" && p.tools.scan ? <div className="flex gap-2"><Button size="sm" onClick={() => go(routes.run(p.tools.scan!.runId, "seo"))}>Plan SEO</Button></div>
                    : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => go(routes.project(p.id, "tools"))}>Go to Tools</Button></div>)}
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">{!t.ready ? "When this tool is ready, it will do or check this item for you." : x.tool === "headings" ? "This item ticks itself once every tag fix in the plan is done. You can also tick it yourself." : x.tool === "launch" ? (x.check === "indexing" || x.check === "https" ? "This item ticks itself when a check of the live domain passes. A staging check shows the issues but doesn’t tick it." : "This item ticks itself when the check passes. You can also tick it yourself.") : x.tool === "redirects" ? (x.check === "map" ? "This item ticks itself when every old URL has a match you’re happy with." : x.check === "after" ? "This item ticks itself when a test of the live domain after launch day passes." : "This item ticks itself when a test of the live domain passes: every redirect is one 301 to the right page.") : x.tool === "seo" ? (x.check === "plan" ? "This item ticks itself when the SEO plan is ready. Its H1s come from the heading plan." : "Counts the plan’s titles, descriptions and URLs as they go live. This item also covers OG images, alt text, schema and the 404 page, so you tick it yourself. The launch check covers several of those.") : "This item ticks itself when the scan finishes."}</p>
                </section>
              )}
              <dl className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                <dt className="text-muted-foreground">Due</dt><dd><Input type="date" value={x.due || ""} onChange={(e) => setItem(x.id, { due: e.target.value || null })} className="h-8 w-44" /></dd>
                {x.who === "client" && <><dt className="text-muted-foreground">Asked</dt><dd className="flex items-center gap-2">{x.asked ? <><span>{new Date(x.asked).toLocaleDateString([], { month: "short", day: "numeric" })}</span><Button variant="ghost" size="xs" onClick={() => setItem(x.id, { asked: false })}>Not asked</Button></> : <Button variant="outline" size="xs" onClick={() => setItem(x.id, { asked: true })}>Mark as asked today</Button>}</dd></>}
                <dt className="text-muted-foreground">Link</dt><dd className="flex items-center gap-2"><Input value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => link !== x.link && setItem(x.id, { link })} placeholder="Figma, doc or email link" className="h-8" />{x.link && <a href={x.link} target="_blank" rel="noreferrer" aria-label="Open link" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" /></a>}</dd>
              </dl>
              <label className="grid gap-1.5 text-[13px] font-medium">Notes<Textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== x.note && setItem(x.id, { note })} rows={4} placeholder="Anything worth remembering about this item" className="font-normal" /></label>
              {x.at && <p className="text-[12.5px] text-muted-foreground">Last changed {ago(x.at)}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t bg-muted/30 px-5 py-3.5">
              <Button variant="ghost" size="sm" onClick={() => setItem(x.id, { status: x.status === "na" ? "todo" : "na" })}><Ban />{x.status === "na" ? "Needed after all" : "Not needed"}</Button>
              <span className="flex-1" />
              <Button size="sm" variant={x.status === "done" ? "outline" : "default"} onClick={() => setItem(x.id, { status: x.status === "done" ? "todo" : "done" })}><Check />{x.status === "done" ? "Mark not done" : "Mark done"}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------- sign-off ----------
function SignoffDialog({ p, ph, open, onClose, onDone }: { p: Project; ph: PPhase; open: boolean; onClose: () => void; onDone: (x: Project) => void }) {
  const [by, setBy] = React.useState("")
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("")
  const [link, setLink] = React.useState("")
  const [file, setFile] = React.useState<{ name: string; data: string } | null>(null)
  const [plan, setPlan] = React.useState<Record<string, "carry" | "skip">>({})
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { if (open) { setBy(p.clientName ? `${p.clientName}, ${p.name}` : ""); setDate(new Date().toISOString().slice(0, 10)); setNote(""); setLink(""); setFile(null); setPlan({}); setBusy(false) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const openItems = [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items].filter((x) => x.status === "todo")
  const next = p.phases[ph.index + 1]
  const pick = (f?: File) => {
    if (!f) return
    if (f.size > 15e6) return toast.error("That file is over 15 MB.")
    const r = new FileReader()
    r.onload = () => setFile({ name: f.name, data: String(r.result).split(",")[1] || "" })
    r.readAsDataURL(f)
  }
  const save = async () => {
    setBusy(true)
    try {
      const carry = Object.entries(plan).filter(([, v]) => v === "carry").map(([k]) => k)
      const skip = Object.entries(plan).filter(([, v]) => v === "skip").map(([k]) => k)
      onDone(await api.signoff(p.id, ph.id, { by, date, note, link, file, carry, skip }))
      toast.success(`${ph.handoff.title} signed off`)
    } catch (e) { toast.error((e as Error).message); setBusy(false) }
  }
  const left = openItems.filter((x) => !plan[x.id]).length
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[620px]">
        <DialogHeader className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3.5 px-6 pt-6">
          <span className="grid size-10 place-items-center rounded-[10px] border bg-muted/60 text-foreground/70"><Stamp className="size-[19px]" /></span>
          <div className="grid gap-1.5"><DialogTitle>Record sign-off: {ph.handoff.title}</DialogTitle><DialogDescription>{ph.handoff.needs === "client" ? `${next ? next.name + " starts" : "The project closes"} once the client approves in writing. Keep the proof here so it stays with the project.` : "Record when this phase is finished."}</DialogDescription></div>
        </DialogHeader>
        <div className="scrollbar-thin grid max-h-[62vh] gap-4 overflow-auto px-6 py-5">
          {ph.handoff.items.length > 0 && (
            <div className="grid gap-2">
              <div className="flex items-baseline gap-2"><span className="text-[13px] font-medium">Deliverables</span><span className="text-[12.5px] text-muted-foreground tabular">{ph.handoff.items.filter((x) => x.status !== "todo").length} of {ph.handoff.items.length} ready</span></div>
              <div className="rounded-xl border bg-card px-3.5 py-1">
                {ph.handoff.items.map((x) => <div key={x.id} className="grid h-[30px] grid-cols-[16px_minmax(0,1fr)] items-center gap-2.5 text-[13px]"><StatusIcon it={x} size={16} /><span className={cn("truncate", x.status !== "todo" && "text-muted-foreground")}>{x.title}</span></div>)}
              </div>
            </div>
          )}
          {openItems.length > 0 && (
            <div className="grid gap-2">
              <span className="text-[13px] font-medium">Still open in {ph.name} <span className="font-normal text-muted-foreground">({openItems.length})</span></span>
              <div className="rounded-xl border bg-card px-3.5 py-1">
                {openItems.map((x) => (
                  <div key={x.id} className="grid min-h-[38px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[13px]">
                    <span className="truncate">{x.title}</span>
                    <div role="group" className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-xs">
                      {next && <button onClick={() => setPlan((s) => ({ ...s, [x.id]: "carry" }))} className={cn("rounded px-2 py-1", plan[x.id] === "carry" ? "bg-card shadow-sm" : "text-muted-foreground")}>Move to {next.name}</button>}
                      <button onClick={() => setPlan((s) => ({ ...s, [x.id]: "skip" }))} className={cn("rounded px-2 py-1", plan[x.id] === "skip" ? "bg-card shadow-sm" : "text-muted-foreground")}>Not needed</button>
                      <button onClick={() => setPlan((s) => { const n = { ...s }; delete n[x.id]; return n })} className={cn("rounded px-2 py-1", !plan[x.id] ? "bg-card shadow-sm" : "text-muted-foreground")}>Leave</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium">Approved by<Input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Name, company" className="font-normal" /></label>
            <label className="grid gap-1.5 text-[13px] font-medium">Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-normal" /></label>
          </div>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Proof</span>
            <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }} className="flex cursor-pointer flex-wrap items-center gap-2.5 rounded-[10px] border border-dashed bg-card px-3 py-2.5 text-[12.5px] text-muted-foreground">
              <input type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              {file ? <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-[13px] text-foreground"><Paperclip className="size-3.5" />{file.name}</span> : <Paperclip className="size-4" />}
              <span>{file ? "Choose a different file" : "Drop an email or screenshot here, or click to choose"}</span>
            </label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a link to the email or message" />
          </div>
          <label className="grid gap-1.5 text-[13px] font-medium"><span>Note <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Approved with one change…" className="font-normal" /></label>
        </div>
        <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <span className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">{left ? <><Info className="size-3.5" />{left} open {left === 1 ? "item stays" : "items stay"} in {ph.name}</> : null}</span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{next ? `Record and start ${next.name}` : "Record sign-off"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- client ----------
function ClientTab({ p, setItem, setP }: { p: Project; setItem: SetItem; setP: (x: Project) => void }) {
  const { prefs } = useApp()
  const [tpls, setTpls] = React.useState<TemplateSummary[]>([])
  const [tid, setTid] = React.useState("")
  const [tpl, setTpl] = React.useState<MessageTemplate | null>(null)
  const [soon, setSoon] = React.useState(true)
  const [notAsked, setNotAsked] = React.useState(false)
  const [showReceived, setShowReceived] = React.useState(false)
  React.useEffect(() => {
    api.templates().then((l) => { const m = l.filter((t) => t.kind !== "checklist"); setTpls(m); setTid((m.find((t) => t.use?.includes("client-request")) || m[0])?.id || "") }).catch(() => {})
  }, [])
  React.useEffect(() => { if (tid) api.template(tid).then((t) => t.kind !== "checklist" && setTpl(t)).catch(() => {}) }, [tid])
  const c = p.client
  const included = [...(soon ? [...c.late, ...c.soon] : []), ...(notAsked ? c.notAsked : [])]
  const msg = tpl ? renderMessage(tpl, p, prefs.appliedBy || "", included) : null
  const text = msg ? (tpl?.kind === "email" && msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body) : ""
  const received = p.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items]).filter((x) => x.who === "client" && x.status === "done")
  const cols = "grid-cols-[18px_minmax(0,1fr)_104px_96px_150px]"
  const Row = ({ x, right }: { x: PItem; right: React.ReactNode }) => (
    <div className={cn("grid h-11 items-center gap-3 border-t border-border/60", cols)}>
      <StatusIcon it={x} onClick={() => setItem(x.id, { status: x.status === "done" ? "todo" : "done" })} />
      <span className={cn("truncate", x.status === "done" && "text-muted-foreground")}>{x.title}</span>
      <span className="text-muted-foreground">{x.phaseName}</span>
      <span className="text-muted-foreground">{x.asked ? new Date(x.asked).toLocaleDateString([], { month: "short", day: "numeric" }) : <span className="text-muted-foreground/60">Not yet</span>}</span>
      <span className="text-right">{right}</span>
    </div>
  )
  const Section = ({ title, n, tone, children }: { title: string; n: number; tone?: string; children: React.ReactNode }) => n ? <div className="mt-3"><div className="flex h-[34px] items-center gap-2"><h2 className={cn("text-[13.5px] font-medium", tone)}>{title}</h2><span className="text-[12.5px] text-muted-foreground tabular">{n}</span></div>{children}</div> : null
  return (
    <div className="grid gap-7 p-7 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 text-[13.5px]">
        <h1 className="text-[22px] font-medium">Waiting on the client</h1>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Everything {p.name} owes you, from every phase. Tick an item when it arrives.</p>
        <div className={cn("grid h-[30px] items-center gap-3 border-b text-[12.5px] text-muted-foreground", cols)}><span /><span>Item</span><span>Phase</span><span>Asked</span><span className="text-right">Due</span></div>
        <Section title="Late" n={c.late.length} tone="text-destructive">{c.late.map((x) => <Row key={x.id} x={x} right={<span className="text-destructive">{fmtDay(x.due)}, {dueLabel(x)}</span>} />)}</Section>
        <Section title="Due soon" n={c.soon.length}>{c.soon.map((x) => <Row key={x.id} x={x} right={x.due ? fmtDay(x.due, true) : ""} />)}</Section>
        <Section title="Not asked yet" n={c.notAsked.length}>{c.notAsked.map((x) => <Row key={x.id} x={x} right={x.askBy && x.askBy <= today() ? <span>Ask now</span> : <span className="text-muted-foreground">{x.askBy ? `Ask around ${fmtDay(x.askBy)}` : ""}</span>} />)}</Section>
        {!c.late.length && !c.soon.length && !c.notAsked.length && <p className="mt-6 text-sm text-muted-foreground">The client doesn’t owe you anything right now.</p>}
        {received.length > 0 && <button onClick={() => setShowReceived(!showReceived)} className="mt-4 flex h-8 items-center gap-2 font-medium"><ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", showReceived && "rotate-90")} />Received <span className="text-[12.5px] font-normal text-muted-foreground tabular">{received.length}</span></button>}
        {showReceived && received.map((x) => <Row key={x.id} x={x} right={<span className="text-muted-foreground">{x.at ? `Received ${new Date(x.at).toLocaleDateString([], { month: "short", day: "numeric" })}` : "Received"}</span>} />)}
      </div>
      <section className="flex flex-col gap-3.5 self-start rounded-xl border bg-card p-[18px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5"><div className="grid gap-0.5"><h2 className="text-sm font-medium">Request message</h2><span className="text-[12.5px] text-muted-foreground">Plain text to paste into email or Slack</span></div>{tid && <button onClick={() => go(routes.template(tid))} className="text-[12.5px] text-foreground/70 underline underline-offset-2">Edit template</button>}</div>
        <label className="grid gap-1.5 text-[12.5px] text-muted-foreground">Template
          <select value={tid} onChange={(e) => setTid(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-[13.5px] text-foreground">{tpls.map((t) => <option key={t.id} value={t.id}>{t.name}{t.kind === "email" ? " (email)" : ""}</option>)}</select>
        </label>
        <div className="grid gap-2 text-[13px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={soon} onChange={(e) => setSoon(e.target.checked)} className="size-[15px] accent-foreground" />Late and due soon <span className="text-muted-foreground tabular">{c.late.length + c.soon.length}</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={notAsked} onChange={(e) => setNotAsked(e.target.checked)} className="size-[15px] accent-foreground" />Not asked yet <span className="text-muted-foreground tabular">{c.notAsked.length}</span></label>
        </div>
        <div className="rounded-[10px] border bg-background px-4 py-3.5 text-[13.5px] leading-relaxed whitespace-pre-line">{text || "Pick a template."}</div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => { navigator.clipboard.writeText(text); toast("Copied the message") }} disabled={!text}><Copy />Copy message</Button>
          {notAsked && c.notAsked.length > 0 && <Button variant="outline" onClick={async () => { setP(await api.askItems(p.id, c.notAsked.map((x) => x.id))); setNotAsked(false); toast("Marked as asked today") }}>Mark as asked today</Button>}
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">Groundwork doesn’t send anything. Paste the message wherever you talk to the client.{!prefs.appliedBy && " Set your name in Engines & settings to sign it."}</p>
      </section>
    </div>
  )
}

// ---------- tools ----------
function ToolsTab({ p, reload }: { p: Project; reload: () => void }) {
  const { refreshRuns } = useApp()
  const [url, setUrl] = React.useState(p.url || "")
  const [busy, setBusy] = React.useState(false)
  const scan = async () => {
    setBusy(true)
    try { const { runId } = await api.scanProject(p.id, url.trim() || undefined); await refreshRuns(); reload(); go(routes.run(runId)) } catch (e) { toast.error((e as Error).message); setBusy(false) }
  }
  const latestScan = p.tools.runs.find((r) => r.pages > 0)
  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-7 py-7">
      <div><h1 className="text-[22px] font-medium">Tools</h1><p className="mt-1.5 text-sm text-muted-foreground">Groundwork’s tools for {p.name}. Their results tick checklist items for you.</p></div>
      <LaunchCard p={p} reload={reload} />
      {!p.url ? (
        <section className="grid gap-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium">Add the website</h2>
          <p className="text-[13px] text-muted-foreground">The scan runs on your Mac and doesn’t use your AI plan.</p>
          <div className="flex gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="client-site.com" /><Button onClick={scan} disabled={busy || !url.trim()}>{busy && <Loader2 className="animate-spin" />}Scan the site</Button></div>
        </section>
      ) : (
        <>
          <section className="grid gap-2.5 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2"><h2 className="text-sm font-medium">Site scan</h2><span className="text-[12.5px] text-muted-foreground">runs on your Mac, no AI</span><span className="flex-1" /><Button size="sm" variant="outline" onClick={scan} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{latestScan ? "Scan again" : "Scan the site"}</Button></div>
            <p className="text-[13px] text-muted-foreground">{p.tools.scan ? `${p.tools.scan.urls} pages found, ${ago(p.tools.scan.at)}. Ticks “Crawl the current site”.` : "Not scanned yet."}</p>
          </section>
          <section className="grid gap-2.5 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2"><h2 className="text-sm font-medium">Heading plan</h2><span className="text-[12.5px] text-muted-foreground">uses your AI plan</span><span className="flex-1" />{p.tools.plan ? <Button size="sm" onClick={() => go(routes.review(p.tools.plan!.runId))}>Open the to-do list</Button> : latestScan ? <Button size="sm" onClick={() => go(routes.run(latestScan.id))}>Plan headings</Button> : null}</div>
            <p className="text-[13px] text-muted-foreground">{p.tools.plan ? `${p.tools.plan.done} of ${p.tools.plan.total} tag fixes done. Ticks “Heading structure” in Design when they’re all done.` : latestScan ? "Pick the pages and plan H1 to H6 for each one." : "Scan the site first."}</p>
          </section>
          <section className="grid gap-2.5 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2"><h2 className="text-sm font-medium">SEO plan</h2><span className="text-[12.5px] text-muted-foreground">uses your AI plan</span><span className="flex-1" />
              {p.tools.seoRunning ? <Button size="sm" variant="outline" onClick={() => go(routes.run(p.tools.seoRunning!))}><Loader2 className="animate-spin" />Planning now</Button>
                : p.tools.seo ? <Button size="sm" onClick={() => go(routes.seo(p.tools.seo!.runId))}>Open the SEO plan</Button>
                : latestScan ? <Button size="sm" onClick={() => go(routes.run(latestScan.id, "seo"))}>Plan SEO</Button> : null}
            </div>
            <p className="text-[13px] text-muted-foreground">{p.tools.seo ? `${p.tools.seo.done} of ${p.tools.seo.total} changes done across ${p.tools.seo.pages} pages. Ticks “SEO per page” in Design.` : latestScan ? "A title, meta description and URL for each page, using the heading plan’s keywords when there is one." : "Scan the site first."}</p>
          </section>
          <RedirectCard p={p} />
          {p.tools.runs.length > 0 && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex h-11 items-center px-4 text-sm font-medium">All scans and plans</div>
              {p.tools.runs.map((r) => (
                <button key={r.id} onClick={() => go(r.status === "done" || r.status === "partial" ? routes.review(r.id) : routes.run(r.id))} className="grid h-11 w-full grid-cols-[minmax(0,1fr)_120px_140px] items-center gap-3 border-t px-4 text-left text-[13.5px] hover:bg-muted/40">
                  <span>{r.status === "done" || r.status === "partial" ? (r.output === "live" ? "Heading plan (tags only)" : "Heading plan (tags and rewrites)") : r.status === "scanning" ? "Scanning…" : r.status === "running" ? "Planning…" : r.status === "scan_failed" ? "Scan failed" : "Scan"}{r.seo && (r.seo.status === "done" || r.seo.status === "partial") ? ", SEO plan" : r.seo?.status === "running" ? ", planning SEO" : ""}</span>
                  <span className="text-muted-foreground tabular">{r.pages} pages</span>
                  <span className="text-right text-muted-foreground">{new Date(r.created).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </button>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ---------- edit details ----------
function EditDialog({ p, open, onClose, onSaved }: { p: Project; open: boolean; onClose: () => void; onSaved: (x: Project) => void }) {
  const init = () => ({ name: p.name, clientName: p.clientName, url: p.url || "", kickoff: p.kickoff || "", launch: p.launch || "" })
  const [f, setF] = React.useState(init)
  React.useEffect(() => { if (open) setF(init()) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => { try { onSaved(await api.updateProject(p.id, { name: f.name, clientName: f.clientName, kickoff: f.kickoff || null, launch: f.launch || null, ...(f.url.trim() ? { url: f.url.trim() } : {}) })); onClose() } catch (e) { toast.error((e as Error).message) } }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Project details</DialogTitle><DialogDescription>Changing the dates moves every due date that hasn’t been set by hand.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-[13px] font-medium">Name<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="font-normal" /></label>
          <label className="grid gap-1.5 text-[13px] font-medium"><span>Website <span className="font-normal text-muted-foreground">(the live domain)</span></span><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="client-site.com" className="font-normal" /></label>
          <label className="grid gap-1.5 text-[13px] font-medium">Client contact<Input value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} placeholder="Used in messages" className="font-normal" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium">Kickoff<Input type="date" value={f.kickoff} onChange={(e) => setF({ ...f, kickoff: e.target.value })} className="font-normal" /></label>
            <label className="grid gap-1.5 text-[13px] font-medium">Launch<Input type="date" value={f.launch} onChange={(e) => setF({ ...f, launch: e.target.value })} className="font-normal" /></label>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

