import * as React from "react"
import { cn } from "cn"
import { Archive, ArrowLeft, ArrowRight, Camera, Check, ChevronDown, ChevronRight, Columns3, Download, LayoutTemplate, Loader2, MessageSquare, MoreHorizontal, PanelLeft, RefreshCw, Search, Settings, Sparkles, SquarePen, Star, Sun, Timer, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApp } from "@/hooks/useApp"
import { useMorningNotice } from "@/hooks/useMorningNotice"
import { FeedbackDialog, sendFeedback } from "@/components/common/Feedback"
import { store } from "@/lib/store"
import { TimerCard, TimerCheck } from "@/components/time/TimeBits"
import { useTimer } from "@/hooks/useTimer"
import { fmtMins } from "@/lib/time"
import { go, routes, useRoute } from "@/lib/router"
import { api, type ProjectSummary, type RunSummary } from "@/lib/api"
import { NewProjectDialog, newProject } from "@/components/project/NewProjectDialog"
import { InvoiceDialog } from "@/components/project/InvoiceDialog"
import { QuickFind, openQuickFind } from "@/components/shell/QuickFind"
import { HelpButton } from "@/components/shell/HelpButton"
import { ago, pct, plural } from "@/lib/format"
import { Bar, Dot, Logo, Ring, SiteIcon, Spinner } from "@/components/common/bits"

const MAC = /Mac/.test(navigator.platform)
const DESKTOP = () => document.documentElement.classList.contains("desktop")
const mod = (k: string) => (MAC ? `⌘${k}` : `Ctrl+${k}`)

/**
 * The sidebar works like Claude's desktop app: the window buttons, sidebar toggle and back/forward sit in one fixed
 * cluster in the top-left corner that never moves. Closing the sidebar gives the page panel the full width; hovering the
 * toggle (or the left edge) slides the sidebar over the page until the pointer leaves, and clicking pins it. ⌘B toggles it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebar, setSidebar, prefs } = useApp()
  const route = useRoute()
  useMorningNotice(prefs.notify)
  const [peek, setPeek] = React.useState(false)
  const panel = React.useRef<HTMLElement>(null)
  const timer = React.useRef(0)
  const hover = React.useCallback((on: boolean) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      // Keep it open while one of its menus is open (the menu sits outside the panel).
      if (!on && panel.current?.querySelector("[data-popup-open]")) return
      setPeek(on)
    }, on ? 120 : 280)
  }, [])
  React.useEffect(() => setPeek(false), [route, sidebar])
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setPeek(false)
      if (!(MAC ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return
      const k = e.key.toLowerCase()
      if (k === "b") { e.preventDefault(); setSidebar(!sidebar) }
      else if (k === "k") { e.preventDefault(); openQuickFind() }
      else if (DESKTOP() && k === "[") { e.preventDefault(); history.back() }
      else if (DESKTOP() && k === "]") { e.preventDefault(); history.forward() }
      else if (DESKTOP() && k === "n") { e.preventDefault(); newProject() }
      else if (DESKTOP() && k === ",") { e.preventDefault(); go(routes.settings()) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sidebar, setSidebar])
  return (
    <div className="relative flex h-full bg-canvas" data-sidebar={sidebar ? "open" : "closed"}>
      <NewProjectDialog />
      <InvoiceDialog />
      <FeedbackDialog />
      <QuickFind />
      <TimerCheck />
      {sidebar ? (
        <Sidebar />
      ) : (
        <>
          <div className="absolute top-16 bottom-0 left-0 z-30 w-2" onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)} />
          <Sidebar floating open={peek} onHover={hover} panelRef={panel} />
        </>
      )}
      <main className={cn("min-w-0 flex-1 py-2 pr-2", !sidebar && "pl-2")}>
        <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-[0_1px_2px_rgba(22,23,22,0.04)]">{children}<HelpButton /></div>
      </main>
      {/* Last on purpose: in the Mac app, window-drag areas later in the page override earlier ones, so the cluster must come
          after the sidebar and page header (both draggable) or its buttons would start a window drag instead of clicking. */}
      <WindowBar sidebar={sidebar} onToggle={() => setSidebar(!sidebar)} onHover={sidebar ? undefined : hover} />
    </div>
  )
}

/** Back/forward availability, from the browser's Navigation API. */
function useHistoryState() {
  const [s, set] = React.useState({ back: false, forward: false })
  React.useEffect(() => {
    const nav = (window as unknown as { navigation?: EventTarget & { canGoBack: boolean; canGoForward: boolean } }).navigation
    if (!nav) return
    const update = () => set({ back: nav.canGoBack, forward: nav.canGoForward })
    update()
    nav.addEventListener("currententrychange", update)
    return () => nav.removeEventListener("currententrychange", update)
  }, [])
  return s
}

function BarButton({ label, keys, onClick, disabled, onHover, children }: { label: string; keys?: string; onClick: () => void; disabled?: boolean; onHover?: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            onMouseEnter={onHover && (() => onHover(true))}
            onMouseLeave={onHover && (() => onHover(false))}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}{keys && <span className="ml-2 opacity-60">{keys}</span>}</TooltipContent>
    </Tooltip>
  )
}

/** The fixed top-left cluster, centred on the page header's line. In the Mac app it starts right after the window buttons; in a browser, after the logo. */
function WindowBar({ sidebar, onToggle, onHover }: { sidebar: boolean; onToggle: () => void; onHover?: (on: boolean) => void }) {
  const h = useHistoryState()
  return (
    <div className="app-drag absolute top-0 left-0 z-50 flex h-16 items-center gap-0.5 pl-4 desktop:pl-[88px]">
      <button onClick={() => go(routes.home)} className="mr-1.5 desktop:hidden" aria-label="Groundwork home"><Logo /></button>
      <BarButton label={sidebar ? "Hide sidebar" : "Show sidebar"} keys={mod("B")} onClick={onToggle} onHover={onHover}><PanelLeft /></BarButton>
      <span className="contents web:hidden">
        <BarButton label="Back" keys={mod("[")} onClick={() => history.back()} disabled={!h.back}><ArrowLeft /></BarButton>
        <BarButton label="Forward" keys={mod("]")} onClick={() => history.forward()} disabled={!h.forward}><ArrowRight /></BarButton>
      </span>
    </div>
  )
}

const when = (t: number) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const SITE: Record<string, string> = { old: "Old site", staging: "Staging", live: "Live site" }
export type VersionTool = "scan" | "headings" | "seo"
const done = (s?: string | null) => s === "done" || s === "partial"
/** Where a version opens, staying in the same tool: the plan when it's ready, else its page with progress. */
const openVersion = (r: RunSummary, tool: VersionTool) => go(
  tool === "headings" ? (done(r.status) ? routes.review(r.id) : routes.run(r.id, "headings"))
  : tool === "seo" ? (done(r.seo?.status) ? routes.seo(r.id) : routes.run(r.id, "seo"))
  : routes.run(r.id))

/**
 * The version switcher in a tool's top bar: "Old site · Sep 29, 1:35 PM". It lists only this tool's versions in the
 * project (scans, heading plans or SEO plans) and switching keeps you in the same tool.
 */
export function VersionMenu({ runId, tool }: { runId: string; tool: VersionTool }) {
  const { runs, projects } = useApp()
  const me = runs.find((r) => r.id === runId)
  if (!me) return null
  const audit = projects.find((x) => x.id === me.projectId)?.kind === "audit"
  const mine = runs.filter((r) => (me.projectId ? r.projectId === me.projectId : r.host === me.host))
  const list = (tool === "headings" ? mine.filter((r) => r.settings || r.id === runId) : tool === "seo" ? mine.filter((r) => r.seo || r.id === runId) : mine).sort((a, b) => b.created - a.created)
  const site = (r: RunSummary) => (audit || !r.site ? r.host : SITE[r.site])
  const state = (r: RunSummary) => { const s = tool === "seo" ? r.seo?.status : tool === "headings" ? r.status : null; return s === "running" ? "planning" : s === "failed" ? "failed" : s === "cancelled" ? "stopped" : r.status === "scanning" ? "scanning" : r.status === "scan_failed" ? "scan failed" : "" }
  const label = <>{site(me)} <span className="text-muted-foreground/70">· {new Date(me.created).toLocaleDateString([], { month: "short", day: "numeric" })}</span></>
  if (list.length < 2) return <span className="truncate text-sm text-muted-foreground">{label}</span>
  const title = tool === "headings" ? "Heading plans" : tool === "seo" ? "SEO plans" : "Scans"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button className="inline-flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" />}>
        {label}{list[0]!.id !== runId && <span className="ml-1 rounded bg-muted px-1 text-[11px]">older</span>}<ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title} in this project</DropdownMenuLabel>
          {list.map((r, i) => (
            <DropdownMenuItem key={r.id} onClick={() => openVersion(r, tool)}>
              <span className="flex-1">{site(r)}<span className="text-muted-foreground"> · {plural(r.pages, "page")}{state(r) ? ` · ${state(r)}` : i === 0 ? " · latest" : ""}</span></span>
              <span className="tabular text-[11px] text-muted-foreground">{when(r.created)}</span>
              {r.id === runId && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavItem({ icon: Icon, label, active, onClick, hint, count }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; onClick: () => void; hint?: string; count?: string }) {
  return (
    <button onClick={onClick} className={cn("group flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[14px] font-medium text-foreground/80 hover:bg-sidebar-accent", active && "bg-sidebar-accent text-foreground")}>
      <Icon className="size-4 text-muted-foreground" /><span className="flex-1 text-left">{label}</span>{hint && <span className="text-[11px] font-normal text-muted-foreground opacity-0 group-hover:opacity-100">{hint}</span>}{count && <span className="text-[12px] font-normal text-muted-foreground tabular">{count}</span>}
    </button>
  )
}

/** A project in the sidebar: its current phase number and how far that phase is, and a ⋯ menu on hover. */
function ProjectRow({ p, active }: { p: ProjectSummary; active: boolean }) {
  const c = p.current
  return (
    <div className="group/row relative">
      <button onClick={() => go(routes.project(p.id))} title={p.kind === "audit" ? undefined : c ? `Phase ${c.index + 1} of ${p.phases.length}: ${c.name}, ${c.done} of ${c.total} done` : "Every phase is signed off"} className={cn("grid h-[30px] w-full grid-cols-[20px_minmax(0,1fr)_18px_14px] items-center gap-2 rounded-md px-2 text-left text-[14px] text-foreground/85 hover:bg-sidebar-accent", active && "bg-sidebar-accent text-foreground")}>
        <SiteIcon runId={p.iconRun || undefined} name={p.name} className="size-5 rounded-[5px] text-[10px]" />
        <span className="truncate">{p.name}</span>
        <span className="text-right text-[11px] text-muted-foreground tabular group-hover/row:opacity-0">{p.kind !== "audit" && c ? String(c.index + 1).padStart(2, "0") : ""}</span>
        <span className="grid place-items-center group-hover/row:opacity-0" title={p.running ? `${p.running} running` : undefined}>{p.running ? <Spinner className="size-3" /> : p.kind === "audit" ? null : c ? <Ring done={c.ready ? 1 : c.done} total={c.ready ? 1 : c.total} size={13} /> : <Ring done={1} total={1} size={13} />}</span>
      </button>
      <RowMenu p={p} />
    </div>
  )
}

/** The ⋯ on a sidebar project: favourite it, or close or reopen it. */
function RowMenu({ p }: { p: ProjectSummary }) {
  const { prefs, setPrefs, refreshProjects } = useApp()
  const fav = (prefs.favorites || []).includes(p.id)
  const toggleFav = () => { const favorites = fav ? (prefs.favorites || []).filter((x) => x !== p.id) : [...(prefs.favorites || []), p.id]; api.savePrefs({ favorites }).catch(() => {}); setPrefs({ favorites }) }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button aria-label={`Options for ${p.name}`} className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 data-[popup-open]:opacity-100" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={toggleFav}><Star /> {fav ? "Remove from Favorites" : "Add to Favorites"}</DropdownMenuItem>
        {p.kind !== "audit" && (p.stage === "closed"
          ? <DropdownMenuItem onClick={async () => { await api.setClosed(p.id, false); refreshProjects() }}><RefreshCw /> Reopen project</DropdownMenuItem>
          : <DropdownMenuItem onClick={async () => { await api.setClosed(p.id, true); refreshProjects() }}><Archive /> Close project</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The top of the sidebar, like a workspace: the studio's name with its menu, and New project beside it. */
function Workspace() {
  const { prefs } = useApp()
  const name = prefs.agency || "Groundwork"
  return (
    <div className="mb-1.5 flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left hover:bg-sidebar-accent data-[popup-open]:bg-sidebar-accent" />}>
          <span className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-foreground text-[11px] font-medium text-background">{name[0]!.toUpperCase()}</span>
          <span className="truncate text-[14px] font-medium">{name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{prefs.appliedBy || "You"}{prefs.who === "studio" ? ", in a studio" : ""}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => go(routes.settings())}><Settings /> Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => go(routes.templates)}><LayoutTemplate /> Templates</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => sendFeedback()}><MessageSquare /> Send feedback</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger render={<button onClick={() => newProject()} aria-label="New project" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" />}><SquarePen className="size-4" /></TooltipTrigger>
        <TooltipContent>New project <span className="text-muted-foreground">{mod("N")}</span></TooltipContent>
      </Tooltip>
    </div>
  )
}

/** A sidebar section's label, which folds the section like Notion's. */
function SectionLabel({ label, count, folded, onToggle }: { label: string; count?: number; folded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-expanded={!folded} className="group/label flex h-7 w-full items-center gap-1 rounded-md px-2 text-left text-[12px] font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
      <span>{label}</span>{count != null && folded && <span className="font-normal tabular">{count}</span>}
      <ChevronRight className={cn("size-3 opacity-0 transition-transform group-hover/label:opacity-100", !folded && "rotate-90")} />
    </button>
  )
}

/** The sidebar: pinned beside the page, or floating over it while previewed from the collapsed state. */
function Sidebar({ floating, open, onHover, panelRef }: { floating?: boolean; open?: boolean; onHover?: (on: boolean) => void; panelRef?: React.Ref<HTMLElement> }) {
  const { runs, projects, status, prefs } = useApp()
  const timer = useTimer()
  const route = useRoute()
  // A scan or plan page belongs to its project, so the project stays highlighted there.
  const cur = route.name === "run" || route.name === "review" || route.name === "seo" ? route.id : null
  const curProject = cur ? runs.find((r) => r.id === cur)?.projectId : null
  // Grouped by where each one is: in progress, in care, and site checks.
  const groups = ([["progress", "In progress"], ["care", "Launched and in care"], ["check", "Site checks"], ["closed", "Closed"]] as const).map(([k, label]) => ({ k, label, list: projects.filter((p) => (p.stage || (p.kind === "audit" ? "check" : "progress")) === k) })).filter((g) => g.list.length)
  // Folded sections are remembered; closed projects start folded.
  const [folded, setFolded] = React.useState<Record<string, boolean>>(() => store.get("sidebarFolded", { closed: true }))
  const fold = (k: string) => setFolded((f) => { const n = { ...f, [k]: !f[k] }; store.set("sidebarFolded", n); return n })
  const favorites = (prefs.favorites || []).map((id) => projects.find((p) => p.id === id)).filter(Boolean) as ProjectSummary[]
  return (
    <aside
      ref={panelRef}
      aria-label="Projects"
      inert={floating && !open}
      onMouseEnter={onHover && (() => onHover(true))}
      onMouseLeave={onHover && (() => onHover(false))}
      className={cn(
        "flex w-64 shrink-0 flex-col pr-2 pb-3 pl-3",
        floating && "absolute top-2 bottom-2 left-2 z-40 rounded-xl border border-sidebar-border bg-canvas shadow-[0_12px_40px_rgba(22,23,22,0.18)] transition-transform duration-200 ease-out",
        floating && !open && "-translate-x-[calc(100%+16px)] shadow-none"
      )}
    >
      {/* The top row belongs to the window buttons and the toggle cluster, which float above it. */}
      <div className={cn("app-drag shrink-0", floating ? "h-12" : "h-14")} />
      <Workspace />
      <TimerCard />
      <nav aria-label="Main" className="grid gap-px">
        <NavItem icon={Search} label="Search" hint="⌘K" onClick={openQuickFind} />
        <NavItem icon={Sun} label="Today" active={route.name === "home"} onClick={() => go(routes.home)} />
        <NavItem icon={Columns3} label="Projects" active={route.name === "projects"} onClick={() => go(routes.projects())} />
        <NavItem icon={Timer} label="Time" active={route.name === "time"} onClick={() => go(routes.time())} count={timer.state?.today.mins ? fmtMins(timer.state.today.mins) : undefined} />
        <NavItem icon={LayoutTemplate} label="Templates" active={route.name === "templates" || route.name === "template"} onClick={() => go(routes.templates)} />
      </nav>
      <div className="scrollbar-thin mt-4 min-h-0 flex-1 overflow-auto">
        {!projects.length && <><div className="px-2 pb-1 text-[12px] font-medium text-muted-foreground">Projects</div><p className="px-2 py-1 text-[13px] text-muted-foreground">Projects you start show up here.</p></>}
        {favorites.length > 0 && (
          <div className="mb-3">
            <SectionLabel label="Favorites" count={favorites.length} folded={!!folded.favorites} onToggle={() => fold("favorites")} />
            {!folded.favorites && favorites.map((p) => <ProjectRow key={p.id} p={p} active={(route.name === "project" && route.id === p.id) || curProject === p.id} />)}
          </div>
        )}
        {groups.map((g) => {
          const isActive = (p: (typeof g.list)[number]) => (route.name === "project" && route.id === p.id) || curProject === p.id
          // A folded section still shows the open project.
          const shut = !!folded[g.k]
          return (
            <div key={g.k} className="mb-3">
              <SectionLabel label={g.label} count={g.list.length} folded={shut} onToggle={() => fold(g.k)} />
              {(shut ? g.list.filter(isActive) : g.list).map((p) => <ProjectRow key={p.id} p={p} active={isActive(p)} />)}
            </div>
          )
        })}
      </div>
      <UpdateCard />
      {status && <UsageCard />}
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
        <span>{label}</span><Bar value={Math.max(2, pct(x.utilization))} tone={x.utilization > 0.8 ? "brand" : "ink"} /><span className="text-right tabular">{pct(x.utilization)}%</span>
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
        <Settings className="size-3.5" /><span className="flex-1">Settings</span>
        {!ready("claude") && !ready("codex") && <span className="text-xs font-medium text-brand-ink">Set up</span>}
      </button>
    </div>
  )
}

/** The "…" menu on scan and plan pages: plan again, rescan, retake screenshots, remove. */
export function SiteMenu({ onRescan, onDelete, onReshoot, onPlanAgain, children }: { onRescan: () => void; onDelete: () => void; onReshoot?: () => void; onPlanAgain?: () => void; children: React.ReactElement }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          {onPlanAgain && <DropdownMenuItem onClick={onPlanAgain}><Sparkles /> Plan again…</DropdownMenuItem>}
          <DropdownMenuItem onClick={onRescan}><RefreshCw /> Rescan the site</DropdownMenuItem>
          {onReshoot && <DropdownMenuItem onClick={onReshoot}><Camera /> Retake screenshots <span className="ml-auto text-xs text-muted-foreground">no AI</span></DropdownMenuItem>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 /> Remove this scan…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
