import * as React from "react"
import { cn } from "cn"
import { Camera, Check, ChevronDown, Download, Loader2, MoreHorizontal, Pencil, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings, SquarePen, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useApp } from "@/hooks/useApp"
import { go, routes, useRoute } from "@/lib/router"
import { api, type RunSummary } from "@/lib/api"
import { ago, pct, plural } from "@/lib/format"
import { OUTPUTS } from "@/components/composer/pickers"
import { Bar, Dot, Logo, Ring, SiteIcon, Spinner, renameSite, runLabel } from "@/components/common/bits"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebar } = useApp()
  return (
    <div className="flex h-full bg-canvas">
      <RenameDialog />
      {sidebar ? <Sidebar /> : <MiniRail />}
      <main className="min-w-0 flex-1 py-2 pr-2">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-[0_1px_2px_rgba(22,23,22,0.04)]">{children}</div>
      </main>
    </div>
  )
}

function RailButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<button onClick={onClick} aria-label={label} className={cn("grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground", active && "bg-sidebar-accent text-foreground")} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/** The collapsed sidebar: just the essentials, like ChatGPT's closed sidebar. */
function MiniRail() {
  const r = useRoute()
  const { setSidebar } = useApp()
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 py-3" aria-label="App">
      <button onClick={() => go(routes.home)} className="mb-3" aria-label="Groundwork home"><Logo className="size-7" /></button>
      <RailButton label="Show sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen className="size-[18px]" /></RailButton>
      <RailButton label="New plan" active={r.name === "home"} onClick={() => go(routes.home)}><SquarePen className="size-[18px]" /></RailButton>
      <div className="flex-1" />
      <RailButton label="AI engines & settings" active={r.name === "settings"} onClick={() => go(routes.settings())}><Settings className="size-[18px]" /></RailButton>
    </nav>
  )
}

function groupBySite(runs: RunSummary[]) {
  const map = new Map<string, RunSummary[]>()
  for (const r of runs) map.set(r.host || r.name, [...(map.get(r.host || r.name) || []), r])
  for (const list of map.values()) list.sort((a, b) => b.created - a.created)
  return [...map.entries()].sort((a, b) => Math.max(...b[1].map((r) => r.updated || r.created)) - Math.max(...a[1].map((r) => r.updated || r.created)))
}
const openRun = (r: RunSummary) => go(r.status === "done" || r.status === "partial" ? routes.review(r.id) : routes.run(r.id))
const when = (t: number) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
/** What a version is, in a few words: "Tags only · 5 pages", "Scan", "Planning…". */
const versionLabel = (r: RunSummary) => {
  const l = runLabel(r)
  if (r.settings && (r.status === "done" || r.status === "partial")) return `${OUTPUTS[r.settings.output]?.short || "Plan"} · ${plural(r.pages, "page")}`
  return l.title
}

/** One row per site. It opens the latest scan or plan; older ones live in its Versions menu. */
function SiteRow({ host, list, cur, onRemove }: { host: string; list: RunSummary[]; cur: string | null; onRemove: () => void }) {
  const { siteLabel } = useApp()
  const latest = list[0]!, l = runLabel(latest)
  const label = siteLabel(host)
  const active = list.some((r) => r.id === cur)
  const busy = list.some((r) => r.status === "running" || r.status === "scanning")
  return (
    <div className={cn("group flex items-center rounded-lg hover:bg-sidebar-accent", active && "bg-sidebar-accent")}>
      <button onClick={() => openRun(latest)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-left text-[13.5px]">
        <SiteIcon runId={(list.find((r) => r.hasIcon) || latest).id} name={label} className="size-5 rounded-[5px] text-[10px]" />
        <span className="min-w-0 flex-1 truncate" title={label !== host ? host : undefined}>{label}</span>
        {busy ? <Spinner className="size-3" /> : l.total ? <Ring done={l.done!} total={l.total} size={13} /> : l.tone === "bad" ? <Dot tone="bad" /> : null}
        <span className="pr-2 font-mono text-[11px] text-muted-foreground tabular group-hover:hidden">{l.busy ? l.sub : l.total ? l.sub : latest.status === "scanned" ? "scan" : ""}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className="mr-1 hidden size-6 place-items-center rounded-md text-muted-foreground group-hover:grid hover:bg-background/60 data-[popup-open]:grid" aria-label={`${host} options`} />}><MoreHorizontal className="size-3.5" /></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Versions</DropdownMenuLabel>
            {list.map((r, i) => (
              <DropdownMenuItem key={r.id} onClick={() => openRun(r)}>
                <span className="flex-1">{versionLabel(r)}{i === 0 && <span className="text-muted-foreground"> · latest</span>}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{when(r.created)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => renameSite(host)}><Pencil /> Rename…</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onRemove}><Trash2 /> Remove site…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** "Heading plan · Sep 29, 1:35 PM" in the top bar, with a switcher when the site has older versions. */
export function VersionMenu({ runId }: { runId: string }) {
  const { runs, siteLabel } = useApp()
  const me = runs.find((r) => r.id === runId)
  if (!me) return null
  const list = runs.filter((r) => r.host === me.host).sort((a, b) => b.created - a.created)
  const label = <>{versionLabel(me)} <span className="text-muted-foreground/70">· {when(me.created)}</span></>
  if (list.length < 2) return <span className="truncate text-sm text-muted-foreground">{label}</span>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button className="inline-flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" />}>
        {label}{list[0]!.id !== runId && <span className="ml-1 rounded bg-muted px-1 text-[11px]">older</span>}<ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Versions of {siteLabel(me.host)}</DropdownMenuLabel>
          {list.map((r, i) => (
            <DropdownMenuItem key={r.id} onClick={() => openRun(r)}>
              <span className="flex-1">{versionLabel(r)}{i === 0 && <span className="text-muted-foreground"> · latest</span>}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{when(r.created)}</span>
              {r.id === runId && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Sidebar() {
  const { runs, status, setSidebar, refreshRuns, siteLabel } = useApp()
  const route = useRoute()
  const cur = route.name === "run" || route.name === "review" ? route.id : null
  const groups = groupBySite(runs)
  const [removing, setRemoving] = React.useState<{ host: string; list: RunSummary[] } | null>(null)
  const remove = async (x: { host: string; list: RunSummary[] }) => {
    for (const r of x.list) await api.remove(r.id)
    await refreshRuns()
    toast(`Removed ${siteLabel(x.host)}`)
    if (x.list.some((r) => r.id === cur)) go(routes.home)
  }
  return (
    <aside className="hidden w-64 shrink-0 flex-col py-3 pr-2 pl-3 md:flex" aria-label="Sites">
      <div className="flex items-center gap-2 pb-3 pl-1">
        <Logo />
        <span className="flex-1 text-[15px] font-semibold tracking-tight">Groundwork</span>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => setSidebar(false)} aria-label="Hide sidebar" />}><PanelLeftClose /></TooltipTrigger>
          <TooltipContent>Hide sidebar</TooltipContent>
        </Tooltip>
      </div>
      <button onClick={() => go(routes.home)} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px] hover:bg-sidebar-accent", route.name === "home" && "bg-sidebar-accent")}>
        <SquarePen className="size-4" /> New plan
      </button>
      <div className="scrollbar-thin mt-4 min-h-0 flex-1 overflow-auto">
        <div className="px-2 pb-1 text-xs text-muted-foreground">Sites</div>
        {!groups.length && <p className="px-2 py-1 text-[13px] text-muted-foreground">Sites you scan show up here.</p>}
        {groups.map(([host, list]) => <SiteRow key={host} host={host} list={list} cur={cur} onRemove={() => setRemoving({ host, list })} />)}
      </div>
      <UpdateCard />
      {status && <UsageCard />}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing && siteLabel(removing.host)}?</AlertDialogTitle>
            <AlertDialogDescription>This deletes {removing && removing.list.length > 1 ? `all ${removing.list.length} versions: every` : "the"} scan, plan and to-do progress for this site from this computer. You can’t undo it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { const x = removing!; setRemoving(null); remove(x) }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

/** Shown when a newer version is on GitHub. */
function UpdateCard() {
  const { update, installUpdate, updating } = useApp()
  if (!update?.enabled || !update.behind) return null
  return (
    <div className="mt-2 rounded-xl border border-brand/40 bg-background/80 p-2.5 text-[13px]">
      <div className="flex items-center gap-2 font-medium"><Download className="size-3.5 text-brand" />Update available</div>
      {update.latest && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{update.latest}</p>}
      <Button size="xs" className="mt-2 w-full" onClick={installUpdate} disabled={updating}>{updating ? <><Loader2 className="animate-spin" /> Updating…</> : "Update now"}</Button>
    </div>
  )
}

/** Plan usage, straight from Claude Code's own rate-limit events, plus the way into settings. */
function UsageCard() {
  const { status, setLimits } = useApp()
  const route = useRoute()
  const [busy, setBusy] = React.useState(false)
  if (!status) return null
  const E = status.engines, w = status.limits?.windows || {}
  const refresh = async () => {
    setBusy(true)
    try { const l = await api.refreshLimits(); if (l) setLimits(l) } finally { setBusy(false) }
  }
  const ready = (k: "claude" | "codex") => E[k].installed && E[k].loggedIn
  const sub = E.claude.loggedIn && E.claude.billing === "subscription"
  const bar = (label: string, x?: { utilization: number }) =>
    x && (
      <div className="grid grid-cols-[48px_1fr_30px] items-center gap-2 text-[11.5px] text-muted-foreground">
        <span>{label}</span><Bar value={Math.max(2, pct(x.utilization))} tone={x.utilization > 0.8 ? "brand" : "ink"} /><span className="text-right font-mono tabular">{pct(x.utilization)}%</span>
      </div>
    )
  return (
    <div className="mt-2 grid gap-1 rounded-xl border border-sidebar-border/70 bg-background/60 p-2">
      <div className="flex items-center gap-2 px-1 text-[13px]">
        <Dot tone={ready("claude") || ready("codex") ? "ink" : "muted"} />
        <span className="flex-1 font-medium">{ready("claude") ? `Claude Code${E.claude.plan ? ` · ${E.claude.plan[0]!.toUpperCase()}${E.claude.plan.slice(1)}` : ""}` : ready("codex") ? "Codex" : "No AI engine yet"}</span>
        {sub && (
          <Tooltip>
            <TooltipTrigger render={<button onClick={refresh} disabled={busy} className="text-muted-foreground hover:text-foreground" aria-label="Check plan usage" />}><RefreshCw className={cn("size-3", busy && "animate-spin")} /></TooltipTrigger>
            <TooltipContent>{status.limits ? `Checked ${ago(status.limits.at)}. ` : ""}Check now (one tiny request)</TooltipContent>
          </Tooltip>
        )}
      </div>
      {sub && (w.five_hour || w.seven_day) && <div className="grid gap-1.5 px-1 py-1">{bar("5-hour", w.five_hour)}{bar("Weekly", w.seven_day)}</div>}
      <button onClick={() => go(routes.settings())} className={cn("flex items-center gap-2 rounded-md px-1 py-1 text-left text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground", route.name === "settings" && "text-foreground")}>
        <Settings className="size-3.5" /><span className="flex-1">Engines & settings</span>
        {!ready("claude") && !ready("codex") && <span className="text-xs font-medium text-brand">Set up</span>}
      </button>
    </div>
  )
}

/** Name a site, e.g. the client's name. Shared by every version of the site. */
function RenameDialog() {
  const { siteLabel, refreshRuns } = useApp()
  const [host, setHost] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  React.useEffect(() => {
    const on = (e: Event) => { const h = (e as CustomEvent<string>).detail; setHost(h); setName(siteLabel(h) === h ? "" : siteLabel(h)) }
    window.addEventListener("gw:rename", on)
    return () => window.removeEventListener("gw:rename", on)
  }, [siteLabel])
  const save = async (value: string) => {
    if (!host) return
    await api.setSiteName(host, value)
    await refreshRuns()
    setHost(null)
    toast(value.trim() ? `Renamed to ${value.trim()}` : `Showing ${host} again`)
  }
  return (
    <Dialog open={!!host} onOpenChange={(o) => !o && setHost(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename site</DialogTitle>
          <DialogDescription>A name for {host}, like the client’s name. It shows in the sidebar and on every version.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(name) }} className="grid gap-4">
          <Input autoFocus value={name} placeholder={host || ""} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <DialogFooter>
            {siteLabel(host || "") !== host && <Button type="button" variant="ghost" className="mr-auto" onClick={() => save("")}>Use the address</Button>}
            <Button type="button" variant="outline" onClick={() => setHost(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The site menu used on run and to-do pages. */
export function SiteMenu({ host, onRescan, onDelete, onReshoot, children }: { host?: string; onRescan: () => void; onDelete: () => void; onReshoot?: () => void; children: React.ReactElement }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          {host && <DropdownMenuItem onClick={() => renameSite(host)}><Pencil /> Rename…</DropdownMenuItem>}
          <DropdownMenuItem onClick={onRescan}><RefreshCw /> Rescan the site</DropdownMenuItem>
          {onReshoot && <DropdownMenuItem onClick={onReshoot}><Camera /> Retake screenshots <span className="ml-auto text-xs text-muted-foreground">free</span></DropdownMenuItem>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 /> Remove…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
