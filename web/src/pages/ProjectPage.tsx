import * as React from "react"
import { cn } from "cn"
import { Ban, CalendarDays, FileText, Check, ChevronDown, ChevronRight, ChevronUp, Copy, Download, ExternalLink, FolderPlus, Info, Layers, Link2, Loader2, Mail, MessageSquare, MoreHorizontal, Paperclip, Pencil, Plus, Receipt, RefreshCw, Stamp, Trash2, Undo2, User, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { PLATFORMS, platformOf, stagingExample, type PlatformId } from "@/lib/platforms"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Kbd, SiteIcon, Spinner, TopBar } from "@/components/common/bits"
import { Crumbs } from "@/components/project/Crumbs"
import { newProject } from "@/components/project/NewProjectDialog"
import { DateField } from "@/components/common/DateField"
import { Chip } from "@/pages/Dashboard"
import { useApp } from "@/hooks/useApp"
import { api, proofUrl, type MessageTemplate, type PItem, type PPhase, type Project, type SiteKey, type TemplateSummary } from "@/lib/api"
import { SITE_KEYS, SITE_NAME, dayOf, dueLabel, fmtDay, hostOfUrl, renderMessage, subName, today, waited, weeklyUpdate } from "@/lib/project"
import { ago } from "@/lib/format"
import { go, routes } from "@/lib/router"
import { LaunchCard, LaunchItemPanel, LaunchReportPage, useLaunchRefresh } from "@/components/project/LaunchCheck"
import { RedirectCard, RedirectsPage } from "@/components/project/Redirects"
import { InventoryCard, InventoryPage } from "@/components/project/Inventory"
import { StatusPageDialog } from "@/components/project/StatusPage"
import { ShiftDialog, shiftPlan } from "@/components/project/ShiftDialog"
import { TemplateUpdateDialog, updateFromTemplate } from "@/components/project/TemplateUpdate"

type Tab = "checklist" | "client" | "tools" | "launch" | "redirects" | "inventory"
type SetItem = (itemId: string, b: Parameters<typeof api.setItem>[2]) => Promise<void>

export function ProjectPage({ id, tab: asked, sub, item }: { id: string; tab: Tab; sub?: string; item?: string }) {
  let tab = asked
  const { runs, refreshProjects } = useApp()
  const [p, setP] = React.useState<Project | null>(null)
  const [missing, setMissing] = React.useState<null | "gone" | string>(null)
  const [editing, setEditing] = React.useState(false)
  const [statusOpen, setStatusOpen] = React.useState(false)
  React.useEffect(() => { const on = () => setStatusOpen(true); window.addEventListener("gw:status-page", on); return () => window.removeEventListener("gw:status-page", on) }, [])
  const [removing, setRemoving] = React.useState(false)
  // A project that's been deleted says so; anything else (the app restarting, a bad file) can be retried.
  const load = React.useCallback(() => api.project(id).then((x) => { setP(x); setMissing(null) }).catch((e: Error) => setMissing(/doesn’t exist|not found/i.test(e.message) ? "gone" : e.message)), [id])
  React.useEffect(() => { load() }, [load, runs])
  // While a launch check runs, keep the checklist current so its items tick as soon as it ends.
  const checking = p?.tools.launchRunning?.id
  React.useEffect(() => { if (!checking) return; const t = setInterval(load, 3000); return () => clearInterval(t) }, [checking, load])
  useLaunchRefresh(p)

  const setItem: SetItem = async (itemId, b) => {
    try { setP(await api.setItem(id, itemId, b)); refreshProjects().catch(() => {}) } catch (e) { toast.error((e as Error).message) }
  }
  if (missing === "gone") return <div className="grid h-full place-items-center p-8 text-center"><div><p className="text-lg font-medium">This project doesn’t exist any more.</p><Button className="mt-4" variant="outline" onClick={() => go(routes.home)}>Back home</Button></div></div>
  if (missing && !p) return <div className="grid h-full place-items-center p-8 text-center"><div><p className="text-lg font-medium">Couldn’t open this project</p><p className="mt-1.5 max-w-md text-sm text-muted-foreground">{missing}</p><Button className="mt-4" variant="outline" onClick={load}>Try again</Button></div></div>
  if (!p) return <div className="grid h-full place-items-center"><Spinner /></div>
  const audit = p.kind === "audit"
  // An audit has no checklist, so it only has the Tools page.
  if (audit && (tab === "checklist" || tab === "client")) tab = "tools"
  const open = p.client.late.length + p.client.soon.length

  return (
    <div className="flex h-full flex-col">
      <TopBar className="gap-1.5 text-[14px]">
        <Crumbs projectId={id} label={sub_label(tab) || undefined} />
        <span className="flex-1" />
        <span className="text-[12.5px] text-muted-foreground">Edited {ago(p.updated || p.created)}</span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Project options" />}><MoreHorizontal /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setEditing(true)}><Pencil /> Edit details…</DropdownMenuItem>
            {!audit && <DropdownMenuItem onClick={shiftPlan}><CalendarDays /> Move dates…</DropdownMenuItem>}
            {!audit && <DropdownMenuItem onClick={updateFromTemplate}><RefreshCw /> Update from the template…{p.templateChanged && <span className="ml-auto size-1.5 rounded-full bg-foreground/60" />}</DropdownMenuItem>}
            {audit && <DropdownMenuItem onClick={() => newProject({ name: p.name, old: p.sites.live || p.url || "" })}><FolderPlus /> Start a project for this site…</DropdownMenuItem>}
            {!audit && <DropdownMenuItem onClick={() => setStatusOpen(true)}><FileText /> Client status page…</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => { const a = document.createElement("a"); a.href = `/api/projects/${p.id}/export`; a.download = ""; a.click(); toast("Exporting the project", { description: "Its checklist, files, scans and plans, as one zip another Groundwork can import." }) }}><Download /> Export project…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}><Trash2 /> {audit ? "Delete audit…" : "Delete project…"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TopBar>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        {!sub_label(tab) && (
          <header className="px-12 pt-7">
            <SiteIcon runId={p.tools.iconRun || undefined} name={p.name} className="size-10 rounded-lg text-lg" />
            <h1 className="mt-2.5 text-[32px] leading-tight font-medium">{p.name}</h1>
            <dl className="mt-4 grid max-w-2xl gap-y-0.5 text-[14px] [--prop-w:130px] lg:max-w-5xl lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-5 lg:gap-x-12">
              {(audit ? (["live"] as const) : SITE_KEYS).map((k) => (
                <Prop key={k} icon={<Link2 className="size-3.5" />} label={audit ? "Site" : SITE_NAME[k]}>{p.sites[k] ? <a href={p.sites[k]!} target="_blank" rel="noreferrer" className="hover:underline">{hostOfUrl(p.sites[k])}</a> : <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">Empty</button>}</Prop>
              ))}
              <Prop icon={<Layers className="size-3.5" />} label="Built with">{platformOf(p.platform) ? <button onClick={() => setEditing(true)} className="hover:underline">{platformOf(p.platform)!.name}</button> : <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">Not known yet</button>}</Prop>
              {!audit && <>
              <Prop icon={<User className="size-3.5" />} label="Client">{p.clientName ? <button onClick={() => setEditing(true)} className="hover:underline">{p.clientName}</button> : <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">Empty</button>}</Prop>
              <Prop icon={<CalendarDays className="size-3.5" />} label={p.labels?.kickoff || "Kickoff"}><DateField value={p.kickoff} placeholder="Empty" icon={false} className="-ml-2" onChange={async (v) => { try { setP(await api.updateProject(id, { kickoff: v })); refreshProjects() } catch (e) { toast.error((e as Error).message) } }} /></Prop>
              <Prop icon={<CalendarDays className="size-3.5" />} label={p.labels?.launch || "Launch"}><DateField value={p.launch} placeholder="Empty" icon={false} className="-ml-2" onChange={async (v) => { try { setP(await api.updateProject(id, { launch: v })); refreshProjects() } catch (e) { toast.error((e as Error).message) } }} /></Prop>
              <Prop icon={<Stamp className="size-3.5" />} label="Phase">{(() => { const c = p.phases.find((x) => x.id === p.current); return c ? <span>{c.name} <span className="text-muted-foreground">· {c.done} of {c.total} done</span></span> : <span className="text-muted-foreground">All signed off</span> })()}</Prop>
              <Prop icon={<Layers className="size-3.5" />} label="Template"><span>{p.templateName}</span>{p.templateChanged && <button onClick={updateFromTemplate} className="ml-2 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground">Template updated. Review changes</button>}</Prop>
              </>}
            </dl>
            {audit ? (
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-4 text-[14px]">
                <span className="min-w-0 flex-1 text-muted-foreground">An audit: scans and checks for one site, with no checklist. Redesigning it? Start a project and this audit’s scans move into it.</span>
                <Button size="sm" variant="outline" onClick={() => newProject({ name: p.name, old: p.sites.live || p.url || "" })}><FolderPlus />Start a project</Button>
              </div>
            ) : (
              <nav aria-label="Project" className="mt-5 flex gap-1 border-b pb-2">
                <TabLink on={tab === "checklist"} onClick={() => go(routes.project(id))}>Checklist</TabLink>
                <TabLink on={tab === "client"} onClick={() => go(routes.project(id, "client"))}>Client <span className="text-xs text-muted-foreground tabular">{open}</span>{p.client.late.length > 0 && <span className="size-1.5 rounded-full bg-destructive" aria-label={`${p.client.late.length} late`} />}</TabLink>
                <TabLink on={tab === "tools"} onClick={() => go(routes.project(id, "tools"))}>Tools</TabLink>
              </nav>
            )}
          </header>
        )}
        {tab === "checklist" && <ChecklistTab p={p} setItem={setItem} setP={setP} reload={load} openItem={item} openPhase={sub} />}
        {tab === "client" && <ClientTab key={sub || ""} p={p} setItem={setItem} setP={setP} mode={sub === "remind" || sub === "update" ? sub : undefined} />}
        {tab === "tools" && <ToolsTab p={p} reload={load} onEdit={() => setEditing(true)} />}
        {tab === "launch" && <LaunchReportPage key={sub || ""} p={p} sub={sub} reload={load} />}
        {tab === "redirects" && <RedirectsPage p={p} reload={load} />}
        {tab === "inventory" && <InventoryPage p={p} reload={load} />}
      </div>
      <EditDialog p={p} open={editing} onClose={() => setEditing(false)} onSaved={(x) => { setP(x); refreshProjects() }} />
      {!audit && <StatusPageDialog p={p} open={statusOpen} onClose={() => setStatusOpen(false)} />}
      <ShiftDialog p={p} onDone={(x) => { setP(x); refreshProjects() }} />
      <TemplateUpdateDialog p={p} onDone={(x) => { setP(x); refreshProjects() }} />
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
            <AlertDialogDescription>{audit ? "This deletes the audit’s scans, plans and checks from this computer." : "This deletes the project from this computer: its checklist, sign-offs, notes, and the scans and plans made in it."} You can’t undo it.</AlertDialogDescription>
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

const sub_label = (tab: Tab) => (tab === "launch" ? "Launch check" : tab === "redirects" ? "Redirect map" : tab === "inventory" ? "Content inventory" : "")

function TabLink({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-current={on ? "page" : undefined} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[14px]", on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>{children}</button>
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
type Filter = "all" | "us" | "client"
function ChecklistTab({ p, setItem, setP, reload, openItem, openPhase }: { p: Project; setItem: SetItem; setP: (x: Project) => void; reload: () => void; openItem?: string; openPhase?: string }) {
  const { refreshProjects } = useApp()
  const [sel, setSel] = React.useState(p.current || p.phases[p.phases.length - 1]!.id)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [toolsOnly, setToolsOnly] = React.useState(false)
  const [hideDone, setHideDone] = React.useState(false)
  const [itemId, setItemId] = React.useState<string | null>(null)
  const [signing, setSigning] = React.useState(false)
  React.useEffect(() => { setSel(p.current || p.phases[p.phases.length - 1]!.id) }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // An item opened by its address (from Home or search): show its phase and open it on the side.
  React.useEffect(() => {
    if (!openItem) return
    const ph = p.phases.find((x) => [...x.groups.flatMap((g) => g.items), ...x.handoff.items].some((i) => i.id === openItem))
    if (ph) { setSel(ph.id); setItemId(openItem) }
  }, [openItem]) // eslint-disable-line react-hooks/exhaustive-deps
  // A phase opened by its address (from Home's invoices): show it, scrolled to its sign-off.
  React.useEffect(() => {
    if (!openPhase || !p.phases.some((x) => x.id === openPhase)) return
    setSel(openPhase)
    setTimeout(() => document.getElementById("signoff-" + openPhase)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100)
  }, [openPhase]) // eslint-disable-line react-hooks/exhaustive-deps
  const ph = p.phases.find((x) => x.id === sel) || p.phases[0]!
  const all = [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items]
  const match = (it: PItem) => (filter === "all" || (filter === "us" && it.who === "us") || (filter === "client" && it.who === "client")) && (!toolsOnly || !!it.tool) && !(hideDone && it.status !== "todo")
  const allItems = p.phases.flatMap((x) => [...x.groups.flatMap((g) => g.items), ...x.handoff.items])
  const item = itemId ? allItems.find((x) => x.id === itemId) || null : null
  const toggle = (it: PItem) => setItem(it.id, { status: it.status === "done" ? "todo" : "done" })
  // Waiting means asked and not received yet. Late items nobody has asked for are counted separately.
  const waiting = [...p.client.late, ...p.client.soon].filter((x) => x.asked)
  const lateUnasked = p.client.late.filter((x) => !x.asked).length
  const toolCount = all.filter((x) => x.tool).length
  // The phase in one line: on track, at risk or behind, and why.
  const todayIso = today()
  const oursLate = all.filter((x) => x.who === "us" && x.late).length, clientLate = all.filter((x) => x.who === "client" && x.late).length
  const daysTo = ph.due ? Math.round((new Date(ph.due).getTime() - new Date(todayIso).getTime()) / 864e5) : null
  const health = ph.state === "signed" ? null : (daysTo != null && daysTo < 0 && ph.state === "current") || (ph.state === "current" && p.behind.days >= 7) ? "Behind" : oursLate || clientLate || (daysTo != null && daysTo <= 7 && ph.total && ph.done / ph.total < 0.8) ? "At risk" : "On track"
  // The panel steps through the items as they're listed: groups, then the sign-off's deliverables.
  const order = [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items].filter(match).map((x) => x.id)

  return (
    <div className="flex flex-col">
      {p.sample && (
        <div className="mx-12 mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-4 py-3 text-[14px]">
          <Info className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">This is a sample project with made-up details. <span className="text-muted-foreground">Tick items, open them, try the Client tab. Nothing here is sent anywhere.</span></span>
          <Button size="sm" variant="outline" onClick={async () => { await api.removeProject(p.id); await refreshProjects(); go(routes.home); toast("Deleted the sample project") }}>Delete the sample</Button>
        </div>
      )}
      {p.repeat && !p.current && (
        <div className="mx-12 mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-4 py-3 text-[14px]">
          <RefreshCw className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">Month {p.cycle} is closed. <span className="text-muted-foreground">Start the next month to open every item again, with dates a month later.</span></span>
          <Button size="sm" onClick={async () => { try { setP(await api.nextCycle(p.id)); toast(`Started month ${p.cycle + 1}`) } catch (e) { toast.error((e as Error).message) } }}>Start month {p.cycle + 1}</Button>
        </div>
      )}
      {p.behind.items >= 3 && p.behind.days >= 7 && (
        <div className="mx-12 mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-4 py-3 text-[14px]">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">The schedule has slipped. <span className="text-muted-foreground">{p.behind.items} items are late across the project ({p.behind.ours} yours, {p.behind.client} the client’s). The oldest in {p.phases.find((x) => x.id === p.current)?.name || "this phase"} is {p.behind.days} days late.</span></span>
          <Button size="sm" variant="outline" onClick={shiftPlan}>Move dates…</Button>
        </div>
      )}
      <ol aria-label="Phases" className="grid gap-2 px-12 pt-5" style={{ gridTemplateColumns: `repeat(${p.phases.length}, minmax(0, 1fr))` }}>
        {p.phases.map((x) => (
          <li key={x.id}>
            <button onClick={() => setSel(x.id)} aria-current={x.id === p.current ? "step" : undefined} className={cn("flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors", x.id === sel ? "border-input bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "border-transparent hover:bg-muted/50")}>
              <span className="flex items-center gap-1.5 text-[13.5px]"><span className="text-xs text-muted-foreground tabular">{String(x.index + 1).padStart(2, "0")}</span><span className={cn("truncate", x.state === "upcoming" && x.id !== sel ? "text-muted-foreground" : "font-medium")}>{x.name}</span><span className="flex-1" /><span className="text-xs text-muted-foreground tabular">{x.done}/{x.total}</span></span>
              <span className="h-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full", x.state === "signed" ? "bg-done" : "bg-brand")} style={{ width: `${x.state === "signed" ? 100 : x.total ? (100 * x.done) / x.total : 0}%` }} /></span>
              <span className="truncate text-xs text-muted-foreground">{x.state === "signed" ? `Signed off ${fmtDay(x.signoff!.date)}` : x.due ? `Sign-off ${fmtDay(x.due)}` : "No sign-off date"}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="grid gap-10 px-12 pt-6 pb-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2.5">
            <div role="group" aria-label="Show" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
              {([["all", "All", all.length], ["us", "Ours", all.filter((x) => x.who === "us").length], ["client", "Client’s", all.filter((x) => x.who === "client").length]] as const).map(([k, l, n]) => (
                <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", filter === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}<span className="text-xs font-normal text-muted-foreground tabular">{n}</span></button>
              ))}
            </div>
            {toolCount > 0 && <button aria-pressed={toolsOnly} onClick={() => setToolsOnly(!toolsOnly)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px]", toolsOnly ? "border-foreground/30 bg-card font-medium" : "border-transparent text-muted-foreground hover:bg-muted/60")}><span className="size-2 rounded-[2px] bg-brand" />Groundwork tools<span className="text-xs font-normal text-muted-foreground tabular">{toolCount}</span></button>}
            <span className="flex-1" />
            <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"><Checkbox checked={hideDone} onCheckedChange={(v) => setHideDone(!!v)} />Hide done</label>
          </div>
          {ph.groups.map((g) => {
            const items = g.items.filter(match)
            if (!items.length) return null
            return <Group key={g.id} name={g.name} done={g.items.filter((x) => x.status !== "todo").length} total={g.items.length}>{items.map((it) => <ItemRow key={it.id} it={it} active={itemId === it.id} onToggle={() => toggle(it)} onOpen={() => setItemId(it.id)} />)}</Group>
          })}
          <SignoffCard p={p} ph={ph} setP={setP} onReview={() => setSigning(true)} onUndo={async () => setP(await api.unsign(p.id, ph.id))} onOpen={setItemId} match={match} toggle={toggle} />
        </div>
        <aside className="flex min-w-0 flex-col gap-3.5">
          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2"><span className="text-[12.5px] text-muted-foreground">{ph.name} phase</span><span className="flex-1" />{health && <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs", health === "Behind" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground/80")}><span className={cn("size-1.5 rounded-full", health === "On track" ? "bg-done" : "bg-destructive")} />{health}</span>}</div>
            <div className="mt-1.5 flex items-baseline gap-1.5"><span className="text-[22px] font-medium tabular">{ph.done}</span><span className="text-muted-foreground">of {ph.total} done</span></div>
            <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand" style={{ width: `${ph.total ? (100 * ph.done) / ph.total : 0}%` }} /></div>
            {health && health !== "On track" && (
              <ul className="mt-3 grid gap-1 text-[13px]">
                {oursLate > 0 && <li>{oursLate} of yours late in {ph.name}</li>}
                {clientLate > 0 && <li>{clientLate} of the client’s late in {ph.name}</li>}
                {daysTo != null && daysTo < 0 && <li>Sign-off was due {-daysTo} {daysTo === -1 ? "day" : "days"} ago</li>}
                {daysTo != null && daysTo >= 0 && daysTo <= 7 && <li>Sign-off {daysTo === 0 ? "is today" : `in ${daysTo} ${daysTo === 1 ? "day" : "days"}`}, {ph.total - ph.done} left</li>}
              </ul>
            )}
            <dl className="mt-3.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
              {ph.due && <><dt className="text-muted-foreground">{ph.state === "signed" ? "Planned sign-off" : "Sign-off planned"}</dt><dd className="text-right">{fmtDay(ph.due)}</dd></>}
              {ph.signoff && <><dt className="text-muted-foreground">Signed off</dt><dd className="text-right">{fmtDay(ph.signoff.date)}</dd></>}
              {p.kickoff && <><dt className="text-muted-foreground">{p.labels?.kickoff || "Kickoff"}</dt><dd className="text-right">{fmtDay(p.kickoff)}</dd></>}
              {p.launch && <><dt className="text-muted-foreground">{p.labels?.launch || "Launch"}</dt><dd className="text-right">{fmtDay(p.launch)}</dd></>}
            </dl>
          </section>
          <section className="flex flex-col gap-1 rounded-xl border bg-card p-4">
            <div className="mb-1.5 flex items-center gap-2"><h3 className="text-[13.5px] font-medium">Waiting on the client</h3><span className="text-[12.5px] text-muted-foreground tabular">{waiting.length}</span></div>
            {lateUnasked > 0 && <button onClick={() => go(routes.project(p.id, "client"))} className="-mx-2 mb-1 rounded-md px-2 py-1.5 text-left text-[12.5px] text-destructive hover:bg-muted/50">{lateUnasked} late {lateUnasked === 1 ? "item hasn’t" : "items haven’t"} been asked for yet</button>}
            {waiting.length ? waiting.slice(0, 5).map((x) => (
              <button key={x.id} onClick={() => setItemId(x.id)} className="-mx-2 grid gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/50">
                <span className="truncate text-[13px]">{x.title}</span>
                <span className={cn("text-xs", x.late ? "text-destructive" : "text-muted-foreground")}>{waited(x).replace(/^./, (c) => c.toUpperCase())}{x.nudged ? `, nudged ${fmtDay(dayOf(x.nudged))}` : ""}{x.late ? ", late" : ""}</span>
              </button>
            )) : <p className="text-[13px] text-muted-foreground">Nothing you’ve asked for is outstanding.</p>}
            {waiting.length > 5 && <span className="text-xs text-muted-foreground">and {waiting.length - 5} more</span>}
            <div className="mt-2 flex gap-2">
              {waiting.some((x) => x.late) && <Button size="sm" className="flex-1" onClick={() => go(routes.remind(p.id))}><Mail />Remind</Button>}
              <Button variant="outline" size="sm" className="flex-1" onClick={() => go(routes.project(p.id, "client"))}>Client tab</Button>
            </div>
          </section>
        </aside>
      </div>
      <ItemSheet p={p} it={item} onClose={() => setItemId(null)} setItem={setItem} reload={reload} order={order} onMove={setItemId} />
      <SignoffDialog p={p} ph={ph} open={signing} onClose={() => setSigning(false)} onDone={(x) => { setP(x); setSigning(false) }} />
    </div>
  )
}

// A group, Notion style: a toggle triangle, the name and a count, and plain rows under it.
function Group({ name, done, total, children }: { name: string; done: number; total: number; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true)
  return (
    <div className="mb-7">
      <button onClick={() => setOpen(!open)} className="-mx-2 mb-1 flex h-8 items-center gap-1.5 rounded-md px-2 text-left hover:bg-muted/50">
        <svg viewBox="0 0 12 12" className={cn("size-3 text-muted-foreground transition-transform", !open && "-rotate-90")}><path d="M2.5 4 6 8l3.5-4z" fill="currentColor" /></svg>
        <h2 className="text-[14px] font-medium">{name}</h2><span className="ml-1 text-[12.5px] text-muted-foreground tabular">{done}/{total}</span>
      </button>
      {open && children}
    </div>
  )
}

function ItemRow({ it, onToggle, onOpen, active }: { it: PItem; onToggle: () => void; onOpen: () => void; active?: boolean }) {
  const faded = it.status !== "todo"
  let tag: React.ReactNode = null
  if (it.who === "client" && it.status === "todo") tag = <Chip className={cn(!it.asked && "border-dashed")}><User className="size-3" />{it.asked ? `Asked ${new Date(it.asked).toLocaleDateString([], { month: "short", day: "numeric" })}` : "Not asked yet"}</Chip>
  else if (it.tool && it.toolInfo) tag = it.toolInfo.ready
    ? <Chip className="bg-muted/60 text-foreground/80"><span className="size-2 rounded-[2px] bg-brand" />{it.toolInfo.progress ? <>{it.toolInfo.name} <span className="text-muted-foreground tabular">{it.toolInfo.progress.done} of {it.toolInfo.progress.total}</span></> : it.status === "done" && it.auto ? "Done by Groundwork" : it.status === "todo" && it.toolInfo.issues ? <>{it.toolInfo.name} <span className="text-destructive tabular">{it.toolInfo.issues} {it.toolInfo.issues === 1 ? "issue" : "issues"}</span></> : it.toolInfo.name}</Chip>
    : <Chip className="border-dashed"><span className="size-2 rounded-[2px] bg-brand" />{it.toolInfo.name}, soon</Chip>
  else if (it.note || it.link) tag = <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80">{it.link ? <Link2 className="size-3" /> : <MessageSquare className="size-3" />}{it.link ? "Link" : "Note"}</span>
  return (
    <div onClick={onOpen} className={cn("-mx-2 grid h-[34px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_180px_78px] items-center gap-3 rounded-md px-2 hover:bg-muted/50", active && "bg-muted/70 hover:bg-muted/70")}>
      <StatusIcon it={it} onClick={onToggle} />
      <span className={cn("truncate text-[13.5px]", faded && "text-muted-foreground", it.status === "na" && "line-through")}>{it.title}{it.carriedFrom && <span className="ml-2 text-xs text-muted-foreground">from {it.carriedFrom}</span>}</span>
      <span className="flex justify-end">{tag}</span>
      <span className={cn("text-right text-[12.5px] whitespace-nowrap", it.status === "todo" && it.late ? "text-destructive" : faded ? "text-muted-foreground/70" : "text-muted-foreground")}>{it.status === "na" ? "Not needed" : it.status === "done" ? (it.at ? fmtDay(dayOf(it.at)) : "Done") : dueLabel(it)}</span>
    </div>
  )
}

function SignoffCard({ p, ph, setP, onReview, onUndo, onOpen, match, toggle }: { p: Project; ph: PPhase; setP: (x: Project) => void; onReview: () => void; onUndo: () => void; onOpen: (id: string) => void; match: (it: PItem) => boolean; toggle: (it: PItem) => void }) {
  const [open, setOpen] = React.useState(false)
  const h = ph.handoff
  const ready = h.items.filter((x) => x.status !== "todo").length
  const s = ph.signoff
  return (
    <div id={"signoff-" + ph.id} className="mt-1 scroll-mt-6 rounded-[10px] border bg-muted/40">
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
      {open && <div className="border-t bg-card/60 px-3.5 pb-1">{h.items.filter(match).map((it) => <ItemRow key={it.id} it={it} onToggle={() => toggle(it)} onOpen={() => onOpen(it.id)} />)}</div>}
      <PaymentRow p={p} ph={ph} setP={setP} />
    </div>
  )
}

// The payment that falls due with a sign-off: add it once, then mark it invoiced and paid. Home lists invoices to
// send once the phase is signed off, and payment reminders two weeks after invoicing.
function PaymentRow({ p, ph, setP }: { p: Project; ph: PPhase; setP: (x: Project) => void }) {
  const { prefs } = useApp()
  const pay = ph.payment
  const [editing, setEditing] = React.useState(false)
  const [label, setLabel] = React.useState(""), [amount, setAmount] = React.useState("")
  const save = async (b: Parameters<typeof api.setPayment>[2]) => { try { setP(await api.setPayment(p.id, ph.id, b)) } catch (e) { toast.error((e as Error).message) } }
  const edit = () => { setLabel(pay?.label || `${ph.name} sign-off`); setAmount(pay?.amount || ""); setEditing(true) }
  const remind = async () => {
    if (!pay) return
    try {
      const all = await api.templates()
      const t = all.find((x) => x.id === "payment-reminder") || all.find((x) => /payment/i.test(x.name) && x.kind !== "checklist")
      if (!t) return toast.error("There’s no payment reminder template. Add one in Templates.")
      const tpl = await api.template(t.id)
      if (tpl.kind === "checklist") return
      const m = renderMessage(tpl, p, prefs.appliedBy || "", [], { invoice: pay.label, amount: pay.amount || `sent ${fmtDay(dayOf(pay.invoiced || Date.now()))}` })
      navigator.clipboard.writeText(tpl.kind === "email" && m.subject ? `Subject: ${m.subject}\n\n${m.body}` : m.body)
      toast("Copied the payment reminder")
    } catch (e) { toast.error((e as Error).message) }
  }
  if (editing) return (
    <form onSubmit={(e) => { e.preventDefault(); save({ label, amount }); setEditing(false) }} className="flex flex-wrap items-center gap-2 border-t px-3.5 py-2.5">
      <Receipt className="size-4 text-muted-foreground" />
      <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What it’s for" aria-label="What the payment is for" className="h-8 min-w-40 flex-1 text-[13px]" />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount, like $2,400" aria-label="Amount" className="h-8 w-36 text-[13px]" />
      <Button size="sm" type="submit">Save</Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
    </form>
  )
  if (!pay) return (
    <div className="border-t px-3.5 py-1.5">
      <button onClick={edit} className="inline-flex h-7 items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><Plus className="size-3.5" />Add the payment due with this sign-off</button>
    </div>
  )
  const late = pay.invoiced && !pay.paid && Date.now() - pay.invoiced >= 14 * 864e5
  const state = pay.paid ? `Paid ${fmtDay(dayOf(pay.paid))}` : pay.invoiced ? `Invoiced ${fmtDay(dayOf(pay.invoiced))}, waiting on payment` : ph.signoff ? "Ready to invoice" : "Invoice when this phase is signed off"
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3 border-t px-3.5 py-2">
      <Receipt className="size-4 text-muted-foreground" />
      <span className="grid min-w-0 gap-0.5"><span className="truncate text-[13.5px]">{pay.label}{pay.amount ? <span className="text-muted-foreground">, {pay.amount}</span> : null}</span><span className={cn("text-[12.5px]", late ? "text-destructive" : "text-muted-foreground")}>{state}</span></span>
      <div className="flex items-center gap-1.5">
        {pay.paid ? <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => save({ paid: false })}><Undo2 />Undo</Button>
          : pay.invoiced ? <><Button size="sm" variant="ghost" onClick={remind}><Copy />Copy a reminder</Button><Button size="sm" variant="outline" onClick={() => save({ paid: true })}>Mark paid</Button></>
          : ph.signoff ? <Button size="sm" variant="outline" onClick={() => save({ invoiced: true })}>Mark invoiced</Button> : null}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Payment options" />}><MoreHorizontal /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={edit}><Pencil />Edit</DropdownMenuItem>
            {pay.invoiced && !pay.paid && <DropdownMenuItem onClick={() => save({ invoiced: false })}><Undo2 />Not invoiced yet</DropdownMenuItem>}
            {!pay.invoiced && !pay.paid && <DropdownMenuItem onClick={() => save({ paid: true })}><Check />Mark paid</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => save({ remove: true })}><Trash2 />Remove the payment</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ---------- item detail ----------
function ItemSheet({ p, it, onClose, setItem, reload, order, onMove }: { p: Project; it: PItem | null; onClose: () => void; setItem: SetItem; reload: () => void; order: string[]; onMove: (id: string) => void }) {
  const [note, setNote] = React.useState("")
  const [link, setLink] = React.useState("")
  React.useEffect(() => { setNote(it?.note || ""); setLink(it?.link || "") }, [it?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const last = React.useRef<PItem | null>(null)
  if (it) last.current = it
  const x = it || last.current
  const t = x?.toolInfo
  const pos = x ? order.indexOf(x.id) : -1
  const prev = pos > 0 ? order[pos - 1] : null, next = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : null
  // j/k or the arrow keys step through the phase's items while the panel is open.
  React.useEffect(() => {
    if (!it) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable || document.querySelector("[role=menu]")) return
      if ((e.key === "j" || e.key === "ArrowDown") && next) { e.preventDefault(); onMove(next) }
      if ((e.key === "k" || e.key === "ArrowUp") && prev) { e.preventDefault(); onMove(prev) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [it, next, prev, onMove])
  const when = (at: number) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  const activity = x ? [
    ...(x.auto && t?.text ? [{ at: 0, what: `Ticked by Groundwork: ${t.text}` }] : []),
    ...x.hist.map((h) => ({ ...h, what: h.what.replace(/(\d{4}-\d{2}-\d{2})/, (d) => fmtDay(d, true)) })),
    { at: p.created, what: `Added with the project, from ${p.templateName || "its template"}` },
  ] : []
  const status = !x ? "" : x.status === "done" ? (x.auto ? "Done by Groundwork" : "Done") : x.status === "na" ? "Not needed" : x.late ? "Late" : "To do"
  return (
    <Sheet open={!!it} modal={false} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" overlay={false} showCloseButton={false} initialFocus={false} className="w-[600px]! max-w-[50vw]! min-w-[440px] gap-0 p-0 shadow-[-8px_0_24px_rgba(0,0,0,0.06)]">
        {x && (
          <div className="flex h-full flex-col">
            <div className="flex h-11 shrink-0 items-center gap-1 px-3 text-[13px] text-muted-foreground">
              <span className="truncate px-1.5">{x.phaseName}{x.carriedFrom ? `, carried from ${x.carriedFrom}` : ""}</span>
              <span className="flex-1" />
              {pos >= 0 && <span className="px-1.5 text-xs tabular">{pos + 1} of {order.length}</span>}
              <Button variant="ghost" size="icon-sm" disabled={!prev} onClick={() => prev && onMove(prev)} aria-label="Previous item" title="Previous (k)"><ChevronUp /></Button>
              <Button variant="ghost" size="icon-sm" disabled={!next} onClick={() => next && onMove(next)} aria-label="Next item" title="Next (j)"><ChevronDown /></Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X /></Button>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
              <div className="px-12 pt-6 pb-10">
                <div className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-3">
                  <span className="mt-1"><StatusIcon it={x} size={24} onClick={() => setItem(x.id, { status: x.status === "done" ? "todo" : "done" })} /></span>
                  <SheetTitle className="text-[26px] leading-tight font-medium">{x.title}</SheetTitle>
                </div>
                <dl className="mt-6 grid gap-y-0.5 text-[13.5px]">
                  <Prop icon={<Check className="size-3.5" />} label="Status"><span className={cn("inline-flex h-6 items-center rounded-md px-2 text-[12.5px]", x.status === "todo" ? (x.late ? "bg-destructive/10 text-destructive" : "bg-muted") : "bg-done/40 text-foreground/80")}>{status}</span></Prop>
                  <Prop icon={<CalendarDays className="size-3.5" />} label="Due">
                    <DateField value={x.due} onChange={(v) => setItem(x.id, { due: v })} icon={false} className="-ml-2" />
                    {x.manualDue && <button onClick={() => setItem(x.id, { due: null })} className="ml-1 text-xs text-muted-foreground hover:text-foreground">Back to the plan’s date</button>}
                  </Prop>
                  <Prop icon={<User className="size-3.5" />} label="Owner">{x.who === "client" ? "Client" : "Us"}</Prop>
                  {x.who === "client" && (
                    <Prop icon={<Mail className="size-3.5" />} label="Asked">
                      {x.asked ? <span>{fmtDay(dayOf(x.asked), true)}<span className="text-muted-foreground">{x.nudged ? `, nudged ${fmtDay(dayOf(x.nudged))}` : ""}</span></span> : <span className="text-muted-foreground">Not yet</span>}
                      <button onClick={() => setItem(x.id, { asked: !x.asked })} className="ml-2 text-xs text-muted-foreground hover:text-foreground">{x.asked ? "Clear" : "Mark as asked today"}</button>
                    </Prop>
                  )}
                  <Prop icon={<Link2 className="size-3.5" />} label="Link">
                    <input value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => link !== x.link && setItem(x.id, { link })} placeholder="Figma, doc or email link" className="-ml-2 h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 outline-none placeholder:text-muted-foreground/70 hover:bg-muted/70 focus:bg-muted/70" />
                    {x.link && <a href={x.link} target="_blank" rel="noreferrer" aria-label="Open link" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" /></a>}
                  </Prop>
                  {t && <Prop icon={<Layers className="size-3.5" />} label="Groundwork">{t.name}{t.checkName && <span className="text-muted-foreground">: {t.checkName}</span>}</Prop>}
                </dl>
                {x.doneMeans && <div className="mt-6 grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 rounded-lg bg-muted/60 px-4 py-3.5 leading-relaxed"><Info className="mt-0.5 size-4 text-muted-foreground" /><span><span className="text-muted-foreground">Done means </span>{x.doneMeans.replace(/^./, (c) => c.toLowerCase())}</span></div>}
                {t && (
                  <section className="mt-6 grid gap-3 rounded-lg border p-4">
                    <div className="text-[13px] text-muted-foreground">{t.ready ? t.text || "Not run yet" : "Coming soon to Groundwork"}</div>
                    {t.progress && t.progress.total > 0 && <><div className="flex items-baseline gap-1.5"><span className="text-xl font-medium tabular">{t.progress.done}</span><span className="text-muted-foreground">of {t.progress.total} {x.tool === "seo" ? "SEO changes" : "tag fixes"} done</span></div><div className="h-[5px] overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand" style={{ width: `${(100 * t.progress.done) / t.progress.total}%` }} /></div></>}
                    {x.tool === "launch" ? <LaunchItemPanel p={p} it={x} reload={reload} /> : t.ready && (t.runId
                      ? <div className="flex gap-2"><Button size="sm" onClick={() => go(x.tool === "headings" ? routes.review(t.runId!) : x.tool === "seo" ? routes.seo(t.runId!) : routes.run(t.runId!))}>{x.tool === "headings" ? "Open the to-do list" : x.tool === "seo" ? "Open the SEO plan" : "Open the scan"}</Button></div>
                      : x.tool === "inventory" ? <div className="flex gap-2"><Button size="sm" variant={p.tools.inventory ? "default" : "outline"} onClick={() => go(routes.project(p.id, "inventory"))}>{p.tools.inventory ? "Open the inventory" : "Make the inventory"}</Button></div>
                      : x.tool === "redirects" ? <div className="flex gap-2"><Button size="sm" variant={p.tools.redirects ? "default" : "outline"} onClick={() => go(p.tools.redirects ? routes.project(p.id, "redirects") : routes.project(p.id, "tools"))}>{p.tools.redirects ? "Open the redirect map" : "Go to Tools"}</Button></div>
                      : x.tool === "seo" && p.tools.seoRunning ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => go(routes.run(p.tools.seoRunning!, "seo"))}><Loader2 className="animate-spin" />Planning now</Button></div>
                      : x.tool === "seo" && p.tools.scan ? <div className="flex gap-2"><Button size="sm" onClick={() => go(routes.run(p.tools.plan?.runId || p.tools.scan!.runId, "seo"))}>Plan SEO</Button></div>
                      : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => go(routes.project(p.id, "tools"))}>Go to Tools</Button></div>)}
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">{!t.ready ? "When this tool is ready, it will do or check this item for you." : x.tool === "headings" ? "This item ticks itself once every tag fix in the plan is done. You can also tick it yourself." : x.tool === "inventory" ? "This item ticks itself once every old page has a keep, rewrite, merge or remove call you’re happy with." : x.tool === "launch" ? (x.check === "indexing" || x.check === "https" ? "This item ticks itself when a check of the live domain passes. A staging check shows the issues but doesn’t tick it." : "This item ticks itself when the check passes. You can also tick it yourself.") : x.tool === "redirects" ? (x.check === "map" ? "This item ticks itself when every old URL has a match you’re happy with." : x.check === "after" ? "This item ticks itself when a test of the live domain after launch day passes." : "This item ticks itself when a test of the live domain passes: every redirect is one 301 to the right page.") : x.tool === "seo" ? (x.check === "plan" ? "This item ticks itself once an SEO plan covers every page the scan read. Plan staging, so it describes the new site." : "Counts the plan’s titles, descriptions and URLs as they go live. This item also covers OG images, alt text, schema and the 404 page, so you tick it yourself. The launch check covers several of those.") : (x.check === "recrawl" ? "This item ticks itself when the old site is scanned in the 10 days before launch day. Rebuild the redirect map afterwards, so new pages get redirects too." : "This item ticks itself when the scan finishes.")}</p>
                  </section>
                )}
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== x.note && setItem(x.id, { note })} rows={3} placeholder="Add notes…" className="mt-6 min-h-0 resize-none border-0 bg-transparent px-0 text-[14.5px] leading-relaxed shadow-none [field-sizing:content] focus-visible:ring-0 dark:bg-transparent" />
                <div className="mt-8 border-t pt-4">
                  <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Activity</h3>
                  <ol className="grid gap-2 text-[13px]">
                    {activity.map((a, i) => <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-2.5"><span className="size-1.5 translate-y-[-1px] rounded-full bg-input" /><span>{a.what}</span><span className="text-xs text-muted-foreground">{a.at ? when(a.at) : ""}</span></li>)}
                  </ol>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setItem(x.id, { status: x.status === "na" ? "todo" : "na" })}><Ban />{x.status === "na" ? "Needed after all" : "Not needed"}</Button>
              <span className="flex-1" />
              <span className="hidden text-xs text-muted-foreground sm:inline"><Kbd>j</Kbd> <Kbd>k</Kbd> next and previous</span>
              <Button size="sm" variant={x.status === "done" ? "outline" : "default"} onClick={() => setItem(x.id, { status: x.status === "done" ? "todo" : "done" })}><Check />{x.status === "done" ? "Mark not done" : "Mark done"}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** A property row, Notion style: a quiet label with its icon, then the value. */
function Prop({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[var(--prop-w,140px)_minmax(0,1fr)]">
      <dt className="flex h-8 items-center gap-2 text-muted-foreground">{icon}{label}</dt>
      <dd className="flex min-h-8 min-w-0 items-center">{children}</dd>
    </div>
  )
}

// ---------- sign-off ----------
function SignoffDialog({ p, ph, open, onClose, onDone }: { p: Project; ph: PPhase; open: boolean; onClose: () => void; onDone: (x: Project) => void }) {
  const { prefs } = useApp()
  // The "Ask for sign-off" message, ready to paste, for phases the client approves.
  const copyRequest = async () => {
    try {
      const t = await api.template("signoff-request")
      if (t.kind === "checklist") return
      const m = renderMessage(t, p, prefs.appliedBy || "", [])
      navigator.clipboard.writeText(t.kind === "email" && m.subject ? `Subject: ${m.subject}\n\n${m.body}` : m.body)
      toast("Copied the approval request", { description: "Paste it into email or Slack, then record the reply here." })
    } catch { toast.error("The “Ask for sign-off” message template isn’t there any more. Add one in Templates.") }
  }
  const [by, setBy] = React.useState("")
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("")
  const [link, setLink] = React.useState("")
  const [file, setFile] = React.useState<{ name: string; data: string } | null>(null)
  const [plan, setPlan] = React.useState<Record<string, "carry" | "skip">>({})
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { if (open) { setBy(p.clientName ? `${p.clientName}, ${p.name}` : ""); setDate(today()); setNote(""); setLink(""); setFile(null); setPlan({}); setBusy(false) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
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
          <div className="grid gap-1.5"><DialogTitle>Record sign-off: {ph.handoff.title}</DialogTitle><DialogDescription>{ph.handoff.needs === "client" ? <>{next ? next.name + " starts" : "The project closes"} once the client approves in writing. Keep the proof here so it stays with the project. <button onClick={copyRequest} className="text-foreground/80 underline underline-offset-2 hover:text-foreground">Copy the approval request</button></> : "Record when this phase is finished."}</DialogDescription></div>
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
                      <button onClick={() => setPlan((s) => { const n = { ...s }; delete n[x.id]; return n })} className={cn("rounded px-2 py-1", !plan[x.id] ? "bg-card shadow-sm" : "text-muted-foreground")}>Keep in {ph.name}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium">Approved by<Input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Name, company" className="font-normal" /></label>
            <div className="grid gap-1.5 text-[13px] font-medium">Date<DateField boxed value={date} onChange={(v) => setDate(v || today())} /></div>
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
// Everything the client owes, with a checkbox per item for the request message. Late ones, ones due soon and ones
// it's time to ask for start ticked.
function ClientTab({ p, setItem, setP, mode }: { p: Project; setItem: SetItem; setP: (x: Project) => void; mode?: "remind" | "update" }) {
  const { prefs, setPrefs } = useApp()
  const remind = mode === "remind"
  // The panel writes a request or reminder about ticked items, or the weekly update.
  const [kind, setKind] = React.useState<"ask" | "update">(mode === "update" ? "update" : "ask")
  const [ai, setAi] = React.useState<{ from: string; text: string } | null>(null) // the AI rewrite and the text it came from
  const [rewriting, setRewriting] = React.useState(false)
  const [voice, setVoice] = React.useState(prefs.voice || "")
  const [tpls, setTpls] = React.useState<TemplateSummary[]>([])
  const [tid, setTid] = React.useState("")
  const [picked, setPicked] = React.useState(false) // a template chosen by hand stays
  const [tpl, setTpl] = React.useState<MessageTemplate | null>(null)
  const [record, setRecord] = React.useState(true)
  const [showReceived, setShowReceived] = React.useState(false)
  const c = p.client
  const due = (x: PItem & { askBy?: string | null }) => !x.askBy || x.askBy <= today()
  // A reminder starts from the items due a reminder (or else the late ones already asked for); a request from
  // everything it's time to ask for. The weekly update starts with nothing ticked.
  const firstPick = () => {
    const dueNow = [...c.late, ...c.soon].filter((x) => x.remindDue)
    return new Set((remind ? (dueNow.length ? dueNow : c.late.filter((x) => x.asked)) : [...c.late, ...c.soon, ...c.notAsked.filter(due)]).map((x) => x.id))
  }
  const [pick, setPick] = React.useState<Set<string>>(() => (mode === "update" ? new Set() : firstPick()))
  const panel = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    api.templates().then((l) => setTpls(l.filter((t) => t.kind !== "checklist"))).catch(() => {})
  }, [])
  React.useEffect(() => { if (tid) api.template(tid).then((t) => t.kind !== "checklist" && setTpl(t)).catch(() => {}) }, [tid])
  const open = [...c.late, ...c.soon, ...c.notAsked]
  const chosen = open.filter((x) => pick.has(x.id))
  const fresh = chosen.filter((x) => !x.asked)
  // The message follows the items: a reminder when every ticked item was asked for already, otherwise a request.
  const reminderTpl = (tpls.find((t) => t.id === "reminder") || tpls.find((t) => /remind|nudge/i.test(t.name)))?.id
  const requestTpl = (tpls.find((t) => t.use?.includes("client-request")) || tpls[0])?.id
  const updateTpl = (tpls.find((t) => t.use?.includes("weekly-update")) || tpls.find((t) => /update/i.test(t.name)))?.id
  const auto = kind === "update" ? updateTpl : chosen.length > 0 && !fresh.length && reminderTpl ? reminderTpl : requestTpl
  React.useEffect(() => { if (!picked && auto) setTid(auto) }, [auto, picked])
  React.useEffect(() => { setPicked(false) }, [kind])
  const update = weeklyUpdate(p)
  const msg = tpl ? renderMessage(tpl, p, prefs.appliedBy || "", kind === "update" ? [] : chosen, kind === "update" ? update.extra : {}) : null
  const plain = msg ? (tpl?.kind === "email" && msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body) : ""
  const rewritten = ai && ai.from === plain ? ai.text : null // a different message drops the rewrite
  const text = rewritten ?? plain
  const rewrite = async () => {
    setRewriting(true)
    try { const r = await api.rewrite(plain, voice); setAi({ from: plain, text: r.text }); setPrefs({ voice }) } catch (e) { toast.error((e as Error).message) } finally { setRewriting(false) }
  }
  const received = p.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items]).filter((x) => x.who === "client" && x.status === "done")
  const toggle = (id: string, on: boolean) => setPick((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  const copy = async () => {
    navigator.clipboard.writeText(text)
    if (kind === "update") {
      if (!record) return toast("Copied the update")
      try { setP(await api.updateSent(p.id)); toast("Copied the update", { description: "The next one is due in a week." }) } catch (e) { toast.error((e as Error).message) }
      return
    }
    if (!record || !chosen.length) return toast("Copied the message")
    try {
      if (fresh.length) setP(await api.askItems(p.id, fresh.map((x) => x.id)))
      const again = chosen.filter((x) => x.asked)
      if (again.length) setP(await api.askItems(p.id, again.map((x) => x.id), true))
      toast("Copied the message", { description: [fresh.length ? `${fresh.length} marked as asked today` : "", again.length ? `${again.length} marked as nudged` : ""].filter(Boolean).join(", ") + "." })
    } catch (e) { toast.error((e as Error).message) }
  }
  // One control per row: the checkbox puts the item in the message; "Received" ticks it off.
  const cols = "grid-cols-[16px_minmax(0,1fr)_88px_60px_136px_72px]"
  const Row = ({ x, right, select = true }: { x: PItem; right: React.ReactNode; select?: boolean }) => (
    <div className={cn("group grid h-11 items-center gap-3 border-t border-border/60", cols)}>
      {select ? <Checkbox aria-label={`Include ${x.title} in the message`} checked={pick.has(x.id)} onCheckedChange={(v) => toggle(x.id, !!v)} /> : <Check className="size-4 text-muted-foreground/70" />}
      <span className="flex min-w-0 items-center gap-2"><span className={cn("truncate", x.status === "done" && "text-muted-foreground")}>{x.title}</span>{x.remindDue && <span title="Asked before and due a reminder today" className="shrink-0 rounded-md bg-muted px-1.5 text-[12px] leading-5 text-muted-foreground">Remind</span>}</span>
      <span className="truncate text-muted-foreground">{x.phaseName}</span>
      <span className="truncate text-muted-foreground">{x.asked ? new Date(x.asked).toLocaleDateString([], { month: "short", day: "numeric" }) : <span className="text-muted-foreground/60">Not yet</span>}</span>
      <span className="text-right whitespace-nowrap">{right}</span>
      <span className="text-right">{x.status === "done"
        ? <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setItem(x.id, { status: "todo" })}>Undo</Button>
        : <Button size="xs" variant="ghost" className="text-muted-foreground opacity-70 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100" onClick={() => { setItem(x.id, { status: "done" }); toggle(x.id, false) }}>Received</Button>}</span>
    </div>
  )
  const Section = ({ title, list, tone, children }: { title: string; list: PItem[]; tone?: string; children: React.ReactNode }) => {
    if (!list.length) return null
    const all = list.every((x) => pick.has(x.id))
    return (
      <div className="mt-3">
        <div className="flex h-[34px] items-center gap-2">
          <h2 className={cn("text-[13.5px] font-medium", tone)}>{title}</h2><span className="text-[12.5px] text-muted-foreground tabular">{list.length}</span>
          <span className="flex-1" />
          <button onClick={() => setPick((s) => { const n = new Set(s); list.forEach((x) => (all ? n.delete(x.id) : n.add(x.id))); return n })} className="text-[12.5px] text-muted-foreground hover:text-foreground">{all ? "Untick all" : "Tick all"}</button>
        </div>
        {children}
      </div>
    )
  }
  return (
    <div className="grid gap-10 px-12 pt-6 pb-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 text-[13.5px]">
        <h2 className="text-[16px] font-medium">Waiting on the client</h2>
        <p className="mt-1 text-sm text-muted-foreground">Everything {p.name} owes you, from every phase. Tick the items to ask for or remind about, and press Received when one arrives. An item is late once its due date passes, whether or not you’ve asked yet.</p>
        <label className="mt-2 mb-4 block text-[13px] leading-7 text-muted-foreground">Remind the client{" "}
          <select value={p.remindEvery} onChange={async (e) => { try { setP(await api.updateProject(p.id, { remindEvery: +e.target.value })) } catch (err) { toast.error((err as Error).message) } }} className="mx-0.5 h-7 rounded-md border border-input bg-card px-1.5 text-[13px] text-foreground">
            {[[0, "never"], [2, "every 2 days"], [3, "every 3 days"], [5, "every 5 days"], [7, "once a week"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>{" "}
          once something they were asked for is due in two days or late. Home lists the reminders to send.
        </label>
        <div className={cn("grid h-[30px] items-center gap-3 border-b text-[12.5px] text-muted-foreground", cols)}><span /><span>Item</span><span>Phase</span><span>Asked</span><span className="text-right">Due</span><span /></div>
        <Section title="Late" list={c.late} tone="text-destructive">{c.late.map((x) => <Row key={x.id} x={x} right={<span className="text-destructive">{fmtDay(x.due)}, {dueLabel(x)}</span>} />)}</Section>
        <Section title="Asked, due soon" list={c.soon}>{c.soon.map((x) => <Row key={x.id} x={x} right={x.due ? fmtDay(x.due, true) : ""} />)}</Section>
        <Section title="Not asked yet" list={c.notAsked}>{c.notAsked.map((x) => <Row key={x.id} x={x} right={due(x)
          ? <Button size="xs" variant="outline" onClick={() => { toggle(x.id, true); panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }) }}>{pick.has(x.id) ? "In the message" : "Ask now"}</Button>
          : <span className="text-muted-foreground">Ask around {fmtDay(x.askBy)}</span>} />)}</Section>
        {!open.length && <p className="mt-6 text-sm text-muted-foreground">The client doesn’t owe you anything right now.</p>}
        {received.length > 0 && <button onClick={() => setShowReceived(!showReceived)} className="mt-4 flex h-8 items-center gap-2 font-medium"><ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", showReceived && "rotate-90")} />Received <span className="text-[12.5px] font-normal text-muted-foreground tabular">{received.length}</span></button>}
        {showReceived && received.map((x) => <Row key={x.id} x={x} select={false} right={<span className="text-muted-foreground">{x.at ? `Received ${new Date(x.at).toLocaleDateString([], { month: "short", day: "numeric" })}` : "Received"}</span>} />)}
      </div>
      <section ref={panel} className="flex scroll-mt-4 flex-col gap-3.5 self-start rounded-xl border bg-card p-[18px]">
        <div role="group" aria-label="Message" className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5">
          {([["ask", "Ask or remind"], ["update", "Weekly update"]] as const).map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); if (k === "ask" && !pick.size) setPick(firstPick()) }} className={cn("h-7 rounded-md text-[13px]", kind === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}</button>)}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5"><div className="grid gap-0.5"><h2 className="text-sm font-medium">{kind === "update" ? "Weekly update" : "Message to the client"}</h2><span className="text-[12.5px] text-muted-foreground">{kind === "update" ? `Since ${p.lastUpdate ? `the last update, ${fmtDay(dayOf(p.lastUpdate))}` : fmtDay(dayOf(update.since))}: ${update.counts.done} done, ${update.counts.next} up next, ${update.counts.waiting} waiting on them` : chosen.length ? `${chosen.length} ${chosen.length === 1 ? "item" : "items"} ticked${!fresh.length ? ", all asked before" : ""}` : "No items ticked. Tick items on the left to list them."}</span></div>{tid && <button onClick={() => go(routes.template(tid))} className="text-[12.5px] text-foreground/70 underline underline-offset-2">Edit template</button>}</div>
        <label className="grid gap-1.5 text-[12.5px] text-muted-foreground">Template
          <select value={tid} onChange={(e) => { setPicked(true); setTid(e.target.value) }} className="h-9 rounded-lg border border-input bg-card px-2.5 text-[13.5px] text-foreground">{tpls.map((t) => <option key={t.id} value={t.id}>{t.name}{t.kind === "email" ? " (email)" : ""}</option>)}</select>
        </label>
        <div className="max-h-80 overflow-auto rounded-[10px] border bg-background px-4 py-3.5 text-[13.5px] leading-relaxed whitespace-pre-line">{text || "Pick a template."}</div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <Input value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="Your voice: warm, short, first names" className="h-8 text-[13px]" />
            <Button size="sm" variant="outline" onClick={rewrite} disabled={rewriting || !plain}>{rewriting ? <Loader2 className="animate-spin" /> : null}Rewrite</Button>
          </div>
          <span className="text-[12px] text-muted-foreground">{rewritten ? <>Rewritten by AI. <button onClick={() => setAi(null)} className="underline underline-offset-2 hover:text-foreground">Back to the plain version</button></> : "Optional: rewrites it in your voice with Claude or ChatGPT. It sends this message and nothing else."}</span>
        </div>
        {kind === "update" && <button onClick={() => window.dispatchEvent(new Event("gw:status-page"))} className="flex items-center gap-1.5 text-left text-[12.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"><FileText className="size-3.5" />Or send a status page as a PDF</button>}
        {kind === "update" && <label className="flex items-start gap-2 text-[13px]"><Checkbox checked={record} onCheckedChange={(v) => setRecord(!!v)} className="mt-0.5" /><span>Record it as sent today <span className="text-muted-foreground">(the next one is due in a week)</span></span></label>}
        {kind === "ask" && chosen.length > 0 && <label className="flex items-start gap-2 text-[13px]"><Checkbox checked={record} onCheckedChange={(v) => setRecord(!!v)} className="mt-0.5" /><span>Record it as sent today <span className="text-muted-foreground">({[fresh.length ? `${fresh.length} asked` : "", chosen.length - fresh.length ? `${chosen.length - fresh.length} nudged` : ""].filter(Boolean).join(", ")})</span></span></label>}
        <Button onClick={copy} disabled={!text}><Copy />Copy message</Button>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">Groundwork doesn’t send anything. Paste the message wherever you talk to the client.{!prefs.appliedBy && " Add your name in Settings to sign it."}</p>
      </section>
    </div>
  )
}

// ---------- tools ----------
type Run = Project["tools"]["runs"][number]
const DONE = (s?: string | null) => s === "done" || s === "partial"
const countsOf = (r: Run) => { const c = r.progress?.now || r.progress?.all || r.progress?.live; return c ? `${c.done} of ${c.tasks} tag fixes done` : "Ready" }

function ToolsTab({ p, reload, onEdit }: { p: Project; reload: () => void; onEdit: () => void }) {
  const { refreshRuns, status } = useApp()
  const [busy, setBusy] = React.useState<SiteKey | null>(null)
  const audit = p.kind === "audit"
  const scan = async (site: SiteKey) => {
    setBusy(site)
    try { const { runId } = await api.scanProject(p.id, site); await refreshRuns(); reload(); go(routes.run(runId)) } catch (e) { toast.error((e as Error).message); setBusy(null) }
  }
  const keys: SiteKey[] = audit ? ["live"] : SITE_KEYS
  const label = (r: Run) => (DONE(r.status) ? (r.output === "live" ? "Heading plan (tags only)" : "Heading plan (tags and rewrites)") : r.status === "scanning" ? "Scanning" : r.status === "running" ? "Planning headings" : r.status === "scan_failed" ? "Scan failed" : r.status === "failed" ? "Heading plan failed" : "Scan") + (r.seo && DONE(r.seo.status) ? ", SEO plan" : r.seo?.status === "running" ? ", planning SEO" : "")
  return (
    <div className="grid mx-auto w-full max-w-3xl gap-3 px-12 pt-6 pb-10">
      <p className="text-[14px] text-muted-foreground">{audit ? `Groundwork’s tools for ${p.name}.` : `Groundwork’s tools for ${p.name}. Their results tick checklist items for you.`}</p>
      <h2 className="mt-2 text-[13px] font-medium text-muted-foreground">{audit ? "Site" : "Websites"}</h2>
      <div className="overflow-hidden rounded-xl border bg-card">
        {keys.map((k) => <SiteTools key={k} p={p} k={k} label={audit ? "Site" : SITE_NAME[k]} busy={busy === k} onScan={() => scan(k)} onEdit={onEdit} />)}
      </div>
      <p className="text-[12.5px] text-muted-foreground">Scans run on your Mac with no AI. The heading and SEO plans use your {subName(status)} subscription.</p>
      <h2 className="mt-4 text-[13px] font-medium text-muted-foreground">Checks</h2>
      <LaunchCard p={p} reload={reload} />
      {!audit && <RedirectCard p={p} onEdit={onEdit} />}
      {!audit && <InventoryCard p={p} />}
      {p.tools.runs.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-[13px] font-medium text-muted-foreground">History</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {p.tools.runs.map((r) => (
              <div key={r.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_84px_96px_64px] items-center gap-3 border-t px-4 py-2 text-[13.5px] first:border-t-0">
                <button onClick={() => go(DONE(r.status) ? routes.review(r.id) : r.seo && DONE(r.seo.status) ? routes.seo(r.id) : r.status === "running" ? routes.run(r.id, "headings") : r.seo?.status === "running" ? routes.run(r.id, "seo") : routes.run(r.id))} className="grid min-w-0 gap-0.5 text-left hover:underline">
                  <span className={cn(r.error && "text-destructive")}>{label(r)}</span>
                  {r.error && <span className="truncate text-xs text-muted-foreground">{r.error}</span>}
                </button>
                <span className="truncate text-muted-foreground">{r.site ? (audit ? "Site" : SITE_NAME[r.site]) : ""}</span>
                <span className="text-muted-foreground tabular">{r.pages} found</span>
                <span className="text-muted-foreground">{new Date(r.created).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** One website on the Tools tab: its latest scan, and the heading and SEO plans made from its scans. */
function SiteTools({ p, k, label, busy, onScan, onEdit }: { p: Project; k: SiteKey; label: string; busy: boolean; onScan: () => void; onEdit: () => void }) {
  const url = p.sites[k]
  const runs = p.tools.runs.filter((r) => r.site === k)
  const scanning = runs.find((r) => r.status === "scanning")
  const failed = runs[0]?.status === "scan_failed" ? runs[0] : null
  const scan = runs.find((r) => r.pages > 0 && r.status !== "scanning" && r.status !== "scan_failed")
  const heading = runs.find((r) => DONE(r.status) || r.status === "running")
  const seo = runs.find((r) => r.seo && (DONE(r.seo.status) || r.seo.status === "running"))
  const date = (r: Run) => new Date(r.created).toLocaleDateString([], { month: "short", day: "numeric" })
  // One grid for the site and its tools, so the addresses and statuses line up.
  const Row = ({ name, status, children }: { name: string; status: React.ReactNode; children?: React.ReactNode }) => (
    <div className="grid min-h-10 grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-[13.5px]">
      <span className="text-muted-foreground">{name}</span>
      <span className="min-w-0 truncate text-muted-foreground">{status}</span>
      <span className="flex items-center gap-1.5">{children}</span>
    </div>
  )
  // In a same-domain redesign the live domain shows the old site until launch day, so there's nothing new to scan yet.
  const sameAsOld = k === "live" && !!url && !!p.sites.old && hostOfUrl(p.sites.old) === hostOfUrl(url) && !(p.launch && today() >= p.launch)
  if (sameAsOld) return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 border-t px-4 py-3 text-[13.5px] first:border-t-0">
      <span className="font-medium">{label}</span>
      <span className="min-w-0 text-muted-foreground"><a href={url} target="_blank" rel="noreferrer" className="text-foreground hover:underline">{hostOfUrl(url)}</a>, the same address as the old site. It shows the old site until launch day{p.launch ? ` (${fmtDay(p.launch)})` : ""}, so scan and check it from then on.</span>
    </div>
  )
  if (!url) return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 border-t px-4 py-3 text-[13.5px] first:border-t-0">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{k === "old" ? "Only for redesigns: the site being replaced." : k === "staging" ? `The new site before launch, like ${stagingExample(p.platform)}.` : "Where the site launches."}</span>
      <Button size="xs" variant="ghost" onClick={onEdit}>Add</Button>
    </div>
  )
  return (
    <div className="grid gap-0.5 border-t px-4 py-3 first:border-t-0">
      <div className="grid min-h-9 grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-[13.5px]">
        <span className="font-medium">{label}</span>
        <a href={url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">{hostOfUrl(url)}</a>
        {scanning ? <Button size="sm" variant="outline" onClick={() => go(routes.run(scanning.id))}><Loader2 className="animate-spin" />Scanning</Button>
          : <Button size="sm" variant="outline" onClick={onScan} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{failed ? "Retry the scan" : scan ? "Scan again" : "Scan"}</Button>}
      </div>
      <Row name="Scan" status={failed && !scanning ? <span className="text-destructive">Failed: {failed.error || "the site didn’t load"}</span> : scan ? <>{scan.pages} pages found, {scan.scanned} read, {ago(scan.created)}</> : scanning ? "Scanning now" : "Not scanned yet"}>
        {scan && <Button size="xs" variant="ghost" onClick={() => go(routes.run(scan.id))}>Open</Button>}
      </Row>
      <Row name="Heading plan" status={heading ? <>{heading.status === "running" ? "Planning now" : countsOf(heading)}{scan && heading.id !== scan.id ? `, from the ${date(heading)} scan` : ""}</> : scan ? "Not planned yet" : "Scan first"}>
        {heading && <Button size="xs" variant="ghost" onClick={() => go(heading.status === "running" ? routes.run(heading.id, "headings") : routes.review(heading.id))}>Open</Button>}
        {scan && (!heading || heading.id !== scan.id) && <Button size="xs" variant="outline" onClick={() => go(routes.run(scan.id, "headings"))}>{heading ? "Plan the latest scan" : "Plan headings"}</Button>}
      </Row>
      <Row name="SEO plan" status={seo ? <>{seo.seo!.status === "running" ? "Planning now" : seo.seo!.progress ? `${seo.seo!.progress.done} of ${seo.seo!.progress.tasks} changes done` : "Ready"}{scan && seo.id !== scan.id ? `, from the ${date(seo)} scan` : ""}</> : scan ? "Not planned yet" : "Scan first"}>
        {seo && <Button size="xs" variant="ghost" onClick={() => go(seo.seo!.status === "running" ? routes.run(seo.id, "seo") : routes.seo(seo.id))}>Open</Button>}
        {scan && (!seo || seo.id !== scan.id) && <Button size="xs" variant="outline" onClick={() => go(routes.run(scan.id, "seo"))}>{seo ? "Plan the latest scan" : "Plan SEO"}</Button>}
      </Row>
    </div>
  )
}

// ---------- edit details ----------
function EditDialog({ p, open, onClose, onSaved }: { p: Project; open: boolean; onClose: () => void; onSaved: (x: Project) => void }) {
  const audit = p.kind === "audit"
  const init = () => ({ name: p.name, clientName: p.clientName, platform: (p.platform || "") as PlatformId | "", old: p.sites.old || "", staging: p.sites.staging || "", live: p.sites.live || "", kickoff: p.kickoff || "", launch: p.launch || "" })
  const [f, setF] = React.useState(init)
  React.useEffect(() => { if (open) setF(init()) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    try {
      const sites = audit ? { live: f.live.trim() } : { old: f.old.trim(), staging: f.staging.trim(), live: f.live.trim() }
      onSaved(await api.updateProject(p.id, audit ? { name: f.name, sites, platform: f.platform || null } : { name: f.name, clientName: f.clientName, kickoff: f.kickoff || null, launch: f.launch || null, sites, platform: f.platform || null }))
      onClose()
    } catch (e) { toast.error((e as Error).message) }
  }
  const site = (k: "old" | "staging" | "live", label: string, hint: string, placeholder: string) => (
    <label className="grid gap-1.5 text-[13px] font-medium"><span>{label} <span className="font-normal text-muted-foreground">{hint}</span></span><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder} className="font-normal" /></label>
  )
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{audit ? "Audit details" : "Project details"}</DialogTitle>{!audit && <DialogDescription>Changing the dates moves every due date that hasn’t been set by hand.</DialogDescription>}</DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-[13px] font-medium">Name<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="font-normal" /></label>
          <label className="grid gap-1.5 text-[13px] font-medium">Built with
            <select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as PlatformId | "" })} className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal">
              <option value="">Not known yet</option>{PLATFORMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          {audit ? site("live", "Site", "", "client-site.com") : <>
            {site("old", "Old site", "(the one being replaced)", "old-site.com")}
            {site("staging", "Staging", "(the new site before launch)", stagingExample(f.platform))}
            {site("live", "Live domain", "(where it launches)", "client-site.com")}
            <label className="grid gap-1.5 text-[13px] font-medium">Client contact<Input value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} placeholder="Used in messages" className="font-normal" /></label>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5 text-[13px] font-medium">Kickoff<DateField boxed clearable value={f.kickoff} onChange={(v) => setF({ ...f, kickoff: v || "" })} placeholder="Not set" /></div>
              <div className="grid gap-1.5 text-[13px] font-medium">Launch<DateField boxed clearable value={f.launch} onChange={(v) => setF({ ...f, launch: v || "" })} placeholder="Not set" /></div>
            </div>
          </>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
