import * as React from "react"
import { cn } from "cn"
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Gauge, KeyRound, Lightbulb, ListTodo, Loader2, Lock, MessageSquareText, MoreHorizontal, RefreshCw, Check, Info, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ActBadge, Bar, HTag, Kbd, Ring, SiteIcon, Spinner, Tag, TopBar } from "@/components/common/bits"
import { Screenshot, type Marker } from "@/components/common/Screenshot"
import { ExportItems, modelName } from "@/components/run/blocks"
import { SiteMenu, VersionMenu } from "@/components/shell/AppShell"
import { useApp } from "@/hooks/useApp"
import { useRun } from "@/hooks/useRun"
import { api, shotUrl, type CState, type ResultPage, type Row } from "@/lib/api"
import { finalMode, isH, isTask, pageChecks, phases, siteChecks, taskCounts } from "@/lib/checks"
import { ago, pct, plural } from "@/lib/format"
import { go, routes } from "@/lib/router"
import { store } from "@/lib/store"
import { Empty, hostOf } from "./RunPage"

type PRow = Row & { mode: "live" | "optimize"; phase: 1 | 2 }
const keyOf = (pid: string, r: PRow) => `${r.mode}|${pid}|${r.key}`
const pageCounts = (p: ResultPage, done: CState["done"]) => { const t = phases(p).rows.filter(isTask); return { tasks: t.length, done: t.filter((r) => done[keyOf(p.id, r)]).length } }

export function ReviewPage({ view }: { view: string }) {
  const { run, result, cstate, setCState, progress, notFound } = useRun()
  const app = useApp()
  const [checking, setChecking] = React.useState(false)
  if (notFound) return <Empty title="This site plan doesn’t exist any more." />
  if (!run || !result) return <div className="grid h-full place-items-center"><Spinner className="size-5" /></div>

  const pages = result.pages
  const planned = pages.filter((p) => p.planned)
  const combined = result.site.modes.length > 1
  const tot = taskCounts(pages, cstate.done)
  const running = run.status === "running"
  const lastCheck = Object.values(cstate.verify || {})[0]
  const signoffCount = planned.filter((p) => p.modes.optimize?.h1.proposed || p.modes.live?.h1.proposed).length

  const setDone = async (keys: string[], v: boolean) => {
    setCState((s) => { const d = { ...s.done }; keys.forEach((k) => { if (v) d[k] = { at: Date.now(), via: "manual" }; else delete d[k] }); return { ...s, done: d } })
    try { const r = await api.setDone(run.id, Object.fromEntries(keys.map((k) => [k, v]))); setCState(r.state); app.patchRun(run.id, { progress: r.progress }) }
    catch (e) { toast.error("Couldn’t save: " + (e as Error).message) }
  }
  const setApproved = async (v: boolean) => {
    setCState((s) => ({ ...s, approved: v ? { at: Date.now() } : null }))
    try { const r = await api.setApproved(run.id, v); setCState(r.state); if (v) toast.success("Client approval recorded", { description: "The rewrites are unlocked." }) }
    catch (e) { toast.error((e as Error).message) }
  }
  const checkLive = async () => {
    setChecking(true)
    try {
      const r = await api.checkLive(run.id)
      setCState(r.state); app.refreshRuns()
      if (r.found) toast.success(`${plural(r.found, "change")} found on the live site and ticked off`, { description: `${r.todo} still to do.` })
      else toast("None of the planned changes are on the live site yet", { description: `${plural(r.todo, "change")} to do.` })
    } catch (e) { toast.error((e as Error).message) } finally { setChecking(false) }
  }
  const rescan = async () => { const { id } = await api.rescan(run.id); await app.refreshRuns(); go(routes.run(id)) }
  const reshoot = async () => {
    const t = toast.loading("Retaking screenshots…", { description: "Runs on your Mac. No AI plan usage." })
    try { const r = await api.reshoot(run.id); toast.success(`New screenshots for ${plural(r.pages, "page")}`, { id: t, description: "" }) } catch (e) { toast.error((e as Error).message, { id: t }) }
  }
  const page = view.startsWith("p:") ? pages.find((p) => p.id === view.slice(2)) : null
  const signoffLabel = combined || result.site.modes[0] === "optimize" ? "Client sign-off" : "Suggestions for later"

  const navItem = (id: string) => {
    const p = pages.find((x) => x.id === id)
    if (!p) return null
    const c = pageCounts(p, cstate.done), on = view === "p:" + id
    if (!p.planned) return <div key={id} className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground">{running ? <Spinner className="size-3.5" /> : <Ring done={0} total={0} />}<span className="flex-1 truncate">{p.name}</span><span className="tabular text-[11px]">{running ? "planning" : "–"}</span></div>
    return (
      <button key={id} onClick={() => go(routes.review(run.id, "p:" + id))} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted", on && "bg-muted font-medium")}>
        <Ring done={c.done} total={c.tasks} /><span className="flex-1 truncate">{p.name}</span><span className="text-[11px] text-muted-foreground tabular">{c.tasks ? `${c.done}/${c.tasks}` : "✓"}</span>
      </button>
    )
  }
  const top = (v: string, Icon: React.ElementType, label: string, count?: number) => (
    <button onClick={() => go(routes.review(run.id, v))} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted", view === v && "bg-muted font-medium")}>
      <Icon className="size-4 text-muted-foreground" /><span className="flex-1">{label}</span>{count ? <span className="tabular text-[11px] text-muted-foreground">{count}</span> : null}
    </button>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar className="gap-3">
        <SiteIcon runId={run.id} name={app.siteLabel(hostOf(run))} className="size-5 text-[10px]" />
        <button onClick={() => go(routes.run(run.id))} className="truncate text-sm font-medium hover:underline" title={hostOf(run)}>{app.siteLabel(hostOf(run))}</button>
        <span className="text-muted-foreground">/</span>
        <VersionMenu runId={run.id} />
        <select aria-label="Go to" className="h-8 max-w-44 rounded-lg border bg-card px-2 text-sm min-[1400px]:hidden" value={view} onChange={(e) => go(routes.review(run.id, e.target.value))}>
          <option value="overview">Overview</option>
          <option value="signoff">{signoffLabel}</option>
          {planned.map((p) => { const c = pageCounts(p, cstate.done); return <option key={p.id} value={"p:" + p.id}>{p.name} ({c.done}/{c.tasks})</option> })}
        </select>
        <span className="flex-1" />
        {running && <button onClick={() => go(routes.run(run.id))} className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"><Spinner className="size-3" />Planning {progress?.percent || 0}%</button>}
        <div className="hidden items-center gap-2 lg:flex" title="Changes done across all pages">
          <Bar value={tot.tasks ? (100 * tot.done) / tot.tasks : 0} className="w-28" />
          <span className="text-xs whitespace-nowrap text-muted-foreground"><b className="text-foreground tabular">{tot.done}</b> / {tot.tasks} done</span>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" size="sm" onClick={checkLive} disabled={checking || running} />}>
            {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} {checking ? `Checking ${planned.length} pages…` : "Check live site"}
          </TooltipTrigger>
          <TooltipContent>{lastCheck ? `Last checked ${ago(lastCheck.at)}. ` : ""}Re-reads the live pages and ticks off changes that are already there.</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={running} />}><Download /> Export</DropdownMenuTrigger>
          <ExportItems id={run.id} modes={result.site.modes} />
        </DropdownMenu>
        <SiteMenu host={hostOf(run)} onRescan={rescan} onReshoot={reshoot} onDelete={() => go(routes.run(run.id))}><Button variant="ghost" size="icon-sm" aria-label="Site options"><MoreHorizontal /></Button></SiteMenu>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <nav className="scrollbar-thin hidden w-52 shrink-0 overflow-auto border-r px-2 py-3 min-[1400px]:block" aria-label="Pages">
          {top("overview", Gauge, "Overview")}
          {top("signoff", MessageSquareText, signoffLabel, signoffCount)}
          {result.nav.map((it, i) => "id" in it ? navItem(it.id) : (
            <div key={i}><div className="px-2 pt-4 pb-1 text-xs text-muted-foreground">{it.group}</div>{it.items.map(navItem)}</div>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {page && page.planned ? <PageView key={page.id} page={page} setDone={setDone} setApproved={setApproved} planned={planned} />
            : view === "signoff" ? <Scroll><SignOff setApproved={setApproved} /></Scroll>
            : page ? <Empty title="This page isn’t planned yet." /> : <Scroll><Overview /></Scroll>}
        </div>
      </div>
    </div>
  )
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="scrollbar-thin h-full overflow-auto"><div className="mx-auto max-w-5xl px-8 py-8">{children}</div></div>
}

/** Client approval for the rewrites. Shared by the page view and the sign-off view. */
function ApprovalBar({ approved, onChange }: { approved: boolean; onChange: (v: boolean) => void }) {
  return approved ? (
    <span className="flex items-center gap-2">
      <Tag tone="solid"><BadgeCheck className="size-3" />Client approved</Tag>
      <Button variant="ghost" size="xs" onClick={() => onChange(false)}>Undo</Button>
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <Tag tone="brand"><Lock className="size-3" />Waiting on client</Tag>
      <Button size="xs" onClick={() => onChange(true)}><Check /> Client approved</Button>
    </span>
  )
}

// ---------- one page ----------
function PageView({ page, setDone, setApproved, planned }: { page: ResultPage; setDone: (k: string[], v: boolean) => void; setApproved: (v: boolean) => void; planned: ResultPage[] }) {
  const { run, cstate, result } = useRun()
  const { rows, combined } = phases(page) as { rows: PRow[]; combined: boolean }
  const approved = !!cstate.approved
  const [showAll, setShowAll] = React.useState(() => store.get("showAll", false))
  const [active, setActive] = React.useState<string | null>(null)
  const [focus, setFocus] = React.useState<string | null>(null)
  const hoverT = React.useRef<number | undefined>(undefined)
  const listRef = React.useRef<HTMLDivElement>(null)
  const idx = planned.findIndex((p) => p.id === page.id)
  const prev = planned[idx - 1], next = planned[idx + 1]
  const tasks = rows.filter(isTask)
  const num = new Map(tasks.map((r, i) => [keyOf(page.id, r), i + 1]))
  const isDone = (r: PRow) => !!cstate.done[keyOf(page.id, r)]
  const locked = (r: PRow) => r.phase === 2 && !approved
  const workable = tasks.filter((r) => !locked(r))
  const verify = (r: PRow) => cstate.verify?.[r.mode]?.pages?.[page.id]?.rows?.[r.key]
  const fm = finalMode(page)
  const checks = pageChecks(page, fm)
  const fails = checks.filter((c) => !c.ok), notes = checks.filter((c) => c.info)
  const primary = page.modes[fm]!
  const phase1 = rows.filter((r) => r.phase === 1), phase2 = rows.filter((r) => r.phase === 2)
  const p1Tasks = phase1.filter(isTask), p2Tasks = phase2.filter(isTask)

  const markers: Marker[] = rows.filter((r) => !r.s && r.rect && (isTask(r) || (showAll && r.phase === 1))).map((r) => {
    const k = keyOf(page.id, r)
    return { key: k, n: num.get(k), rect: r.rect, done: isDone(r), quiet: !isTask(r), label: `${num.get(k) ? num.get(k) + ". " : ""}${r.to || r.text}` }
  })
  const hover = (key: string | null) => { window.clearTimeout(hoverT.current); hoverT.current = window.setTimeout(() => setActive(key ?? focus), 90) }
  const pick = (key: string) => { setFocus(key); setActive(key); listRef.current?.querySelector(`[data-row="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }) }

  // keyboard: j/k move, x tick, n/p pages
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || document.querySelector("[role=dialog],[role=menu]")) return
      const keys = tasks.map((r) => keyOf(page.id, r))
      const i = focus ? keys.indexOf(focus) : -1
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); const k = keys[Math.min(i + 1, keys.length - 1)]; if (k) pick(k) }
      if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); const k = keys[Math.max(i - 1, 0)]; if (k) pick(k) }
      if ((e.key === "x" || e.key === " ") && focus) { e.preventDefault(); const r = tasks.find((x) => keyOf(page.id, x) === focus); if (r && !locked(r)) setDone([focus], !isDone(r)) }
      if (e.key === "n" && next) go(routes.review(run!.id, "p:" + next.id))
      if (e.key === "p" && prev) go(routes.review(run!.id, "p:" + prev.id))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const list = (items: PRow[], unchanged: boolean) => {
    const secs: { s: string; rows: PRow[] }[] = []
    let cur = { s: "Top of page", rows: [] as PRow[] }
    for (const r of items) { if (r.s) { if (cur.rows.length) secs.push(cur); cur = { s: r.s, rows: [] } } else cur.rows.push(r) }
    if (cur.rows.length) secs.push(cur)
    return secs.map((sec) => {
      const shown = sec.rows.filter((r) => isTask(r) || unchanged)
      if (!shown.length) return null
      const t = sec.rows.filter(isTask), d = t.filter(isDone).length
      return (
        <div key={sec.s} className="border-t first:border-t-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-muted-foreground"><span className="font-medium text-foreground/70">{sec.s}</span><span className="flex-1" />{t.length > 0 && <span className="tabular">{d}/{t.length}</span>}</div>
          {shown.map((r) => {
            const k = keyOf(page.id, r)
            return <TaskRow key={k} rowKey={k} r={r} n={num.get(k)} done={isDone(r)} locked={locked(r)} verified={verify(r)} active={active === k} focused={focus === k} onToggle={(v) => setDone([k], v)} onHover={hover} onPick={() => pick(k)} />
          })}
        </div>
      )
    })
  }
  const allDone = workable.length > 0 && workable.every(isDone)
  const undone = workable.filter((r) => !isDone(r)).map((r) => keyOf(page.id, r))
  const waiting = p2Tasks.length > 0 && !approved
  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,40%)]">
      <div ref={listRef} className="scrollbar-thin min-h-0 overflow-auto">
        <div className="px-7 pt-7 pb-24">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Tag tone="muted">Page {idx + 1} of {planned.length}{page.group ? ` · ${page.group}` : ""}</Tag>
              <h1 className="mt-2 text-[28px] leading-tight font-medium">{page.name}</h1>
              <a href={result!.site.url.replace(/\/$/, "") + page.path} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 tabular text-xs text-muted-foreground hover:text-foreground">{page.path}<ExternalLink className="size-3" /></a>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" disabled={!prev} onClick={() => prev && go(routes.review(run!.id, "p:" + prev.id))} aria-label="Previous page"><ChevronLeft /></Button>
              <Button variant="outline" size="icon-sm" disabled={!next} onClick={() => next && go(routes.review(run!.id, "p:" + next.id))} aria-label="Next page"><ChevronRight /></Button>
            </div>
          </div>
          {page.purpose && <p className="mt-4 max-w-2xl text-[15px] text-foreground/80">{page.purpose}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {page.keywords ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-ink"><KeyRound className="size-3" />{page.keywords.primary[0]}</span>
                {page.keywords.secondary.map((k) => <span key={k[0]} className="rounded-md border px-2 py-0.5 text-xs">{k[0]}</span>)}
                <Tooltip><TooltipTrigger render={<span />}><Tag tone="muted">Unverified</Tag></TooltipTrigger><TooltipContent>No keyword tool is connected, so there are no search volumes.</TooltipContent></Tooltip>
              </>
            ) : <Tag tone="muted">Brand page · no target keywords</Tag>}
          </div>
          <HoverCard>
            <HoverCardTrigger render={<button className="mt-3 inline-flex items-center gap-2 text-xs" />}>
              {fails.length ? <span className="inline-flex items-center gap-1 font-medium text-brand-ink"><X className="size-3.5" />{plural(fails.length, "check")} to fix</span> : <span className="inline-flex items-center gap-1 font-medium"><Check className="size-3.5" />All {checks.length} checks pass</span>}
              {notes.length > 0 && <span className="inline-flex items-center gap-1 text-muted-foreground"><Info className="size-3.5" />{plural(notes.length, "note")}</span>}
            </HoverCardTrigger>
            <HoverCardContent className="w-96" align="start">
              <p className="mb-2 text-xs text-muted-foreground">Checked against the page as it will be once {combined ? "every change, rewrites included, is" : "the changes are"} made.</p>
              <div className="grid gap-2 text-sm">{checks.map((c, i) => <div key={i} className="flex gap-2">{c.info ? <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : c.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0 text-brand" />}<span className={cn(c.info && "text-muted-foreground")}>{c.text}</span></div>)}</div>
            </HoverCardContent>
          </HoverCard>

          <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3.5 pb-3 whitespace-nowrap">
              <ListTodo className="size-4" /><span className="font-medium">{combined ? "Tag fixes · do now" : "To do"}</span>
              <span className="text-xs text-muted-foreground tabular">{p1Tasks.length ? `${p1Tasks.filter(isDone).length} of ${p1Tasks.length} done` : "nothing to change"}</span>
              <span className="flex-1" />
              {workable.length > 0 && <Button variant="ghost" size="xs" onClick={() => setDone(allDone ? workable.map((r) => keyOf(page.id, r)) : undone, !allDone)}>{allDone ? "Untick all" : "Tick all"}</Button>}
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={showAll} onCheckedChange={(v) => { setShowAll(v); store.set("showAll", v) }} />Show unchanged</label>
            </div>
            <Bar value={p1Tasks.length ? (100 * p1Tasks.filter(isDone).length) / p1Tasks.length : 100} className="h-0.5 rounded-none" />
            {list(phase1, showAll)}
            {!p1Tasks.length && !showAll && <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">The tags on this page are already right.</p>}
          </div>

          {combined && p2Tasks.length > 0 && (
            <div className={cn("mt-4 overflow-hidden rounded-2xl border bg-card", !approved && "border-dashed")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3.5 pb-3 whitespace-nowrap">
                <Lightbulb className="size-4" /><span className="font-medium">Rewrites · after client sign-off</span>
                <span className="text-xs text-muted-foreground tabular">{p2Tasks.filter(isDone).length} of {p2Tasks.length} done</span>
                <span className="flex-1" />
                <ApprovalBar approved={approved} onChange={setApproved} />
              </div>
              {!approved && <p className="border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">New wording and new headings. Send the list from <button className="font-medium text-foreground underline underline-offset-2" onClick={() => go(routes.review(run!.id, "signoff"))}>Client sign-off</button>, then tick “Client approved” once they agree.</p>}
              <div className={cn(!approved && "opacity-70")}>{list(phase2, false)}</div>
            </div>
          )}

          {!combined && page.modes.live && primary.h1.proposed && (
            <div className="mt-4 rounded-2xl border bg-card p-4">
              <Tag tone="muted">H1 idea · for later</Tag>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground line-through">{primary.h1.cur}</span><ArrowRight className="size-3.5 text-muted-foreground" /><b>{primary.h1.proposed}</b></div>
              {primary.h1.why && <p className="mt-1.5 text-xs text-muted-foreground">{primary.h1.why}</p>}
            </div>
          )}
          {primary.notes.length > 0 && (
            <div className="mt-4 rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Lightbulb className="size-4" />{combined || fm === "optimize" ? "Ideas" : "Suggestions for later"}</div>
              <ul className="mt-2 grid gap-2">{primary.notes.map((n, i) => <li key={i} className="text-sm text-foreground/80">{n}</li>)}</ul>
            </div>
          )}
          <div className={cn("mt-4 flex items-center gap-3 rounded-2xl border p-4", allDone && "bg-muted")}>
            {allDone
              ? <><Check className="size-5" /><span className="font-medium">{waiting ? "All tag fixes on this page are done." : `All ${plural(workable.length, "change")} on this page are done.`}</span></>
              : <span className="text-sm text-muted-foreground">{workable.length - workable.filter(isDone).length} left on this page{waiting ? ", plus the rewrites once approved" : ""}.</span>}
            <span className="flex-1" />
            {next ? <Button variant={allDone ? "secondary" : "outline"} size="sm" onClick={() => go(routes.review(run!.id, "p:" + next.id))}>Next: {next.name} <ArrowRight /></Button> : <Button variant="outline" size="sm" onClick={() => go(routes.review(run!.id))}>Overview</Button>}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Kbd>j</Kbd><Kbd>k</Kbd> move <Kbd>x</Kbd> tick <Kbd>n</Kbd><Kbd>p</Kbd> next or previous page</p>
        </div>
      </div>
      <div className="hidden min-h-0 flex-col border-l lg:flex">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-xs text-muted-foreground"><Tag tone="muted">Preview</Tag><span className="truncate">Numbers match the list</span></div>
        <Screenshot src={shotUrl(run!, page.id)} markers={markers} active={active} onPick={pick} className="flex-1" />
      </div>
    </div>
  )
}

function TaskRow({ rowKey, r, n, done, locked, verified, active, focused, onToggle, onHover, onPick }: { rowKey: string; r: PRow; n?: number; done: boolean; locked: boolean; verified?: "done" | "todo"; active: boolean; focused: boolean; onToggle: (v: boolean) => void; onHover: (k: string | null) => void; onPick: () => void }) {
  const task = isTask(r)
  const from = r.from ?? r.cur
  const change = r.act === "keep" || r.act === "none" ? <HTag tag={r.cur} /> : r.act === "add" ? <HTag tag={r.rec} to /> : from === r.rec ? <HTag tag={r.rec} to /> : <><HTag tag={from} /><ArrowRight className="size-3 text-muted-foreground" /><HTag tag={r.rec} to /></>
  const copy = r.to || r.text || ""
  return (
    <div
      data-row={rowKey}
      onMouseEnter={() => onHover(rowKey)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button,[role=checkbox],a")) onPick() }}
      className={cn("group relative grid grid-cols-[20px_22px_minmax(0,1fr)] gap-x-3 px-4 py-2.5 transition-colors", active && "bg-muted/70", focused && "shadow-[inset_2px_0_0_var(--brand)]", !task && "opacity-75")}
    >
      {task ? <Checkbox checked={done} disabled={locked} onCheckedChange={(v) => onToggle(!!v)} className="mt-0.5" aria-label={locked ? "Waiting on client sign-off" : `Mark change ${n} done`} title={locked ? "Waiting on client sign-off" : undefined} /> : <span />}
      <span className={cn("mt-px grid h-5 min-w-5 place-items-center rounded-full tabular text-[10.5px] font-medium", !task ? "text-muted-foreground" : active ? "bg-brand text-brand-foreground" : done ? "bg-done text-background" : "border border-input")}>{task ? n : "·"}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <ActBadge act={r.act === "tag" && isH(from) ? "retag" : r.act!} />{change}
          <span className={cn("min-w-0 text-sm", done && "text-muted-foreground line-through decoration-muted-foreground/60")}>
            {r.act === "rewrite" ? <><span className="text-muted-foreground line-through">{r.text}</span> <ArrowRight className="inline size-3 text-muted-foreground" /> <b>{r.to}</b></> : r.act === "add" ? <b>{r.to}</b> : <span className="font-medium">{r.text}</span>}
          </span>
        </div>
        {r.note && <p className="mt-1 text-[13px] text-muted-foreground">{r.note}</p>}
        {(verified || r.hidden || r.zone || r.auto || (task && !r.rect && r.act !== "add")) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {verified === "done" && <Tag tone="solid"><Check className="size-3" />On the live site</Tag>}
            {verified === "todo" && !locked && <Tag tone="brand">Not on the live site yet</Tag>}
            {r.hidden && <Tag tone="muted">Hidden on the page</Tag>}
            {r.zone && <Tag tone="muted">{r.zone === "footer" ? "Footer" : "Header"} · fix once, applies everywhere</Tag>}
            {r.auto && <Tag tone="brand">Skipped by the AI · please review</Tag>}
            {task && !r.rect && r.act !== "add" && !r.hidden && <Tag tone="muted">Not in the screenshot · closed tab, slider or menu</Tag>}
          </div>
        )}
      </div>
      {copy && <Button variant="ghost" size="icon-xs" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => { navigator.clipboard.writeText(copy); toast("Copied", { duration: 1200 }) }} aria-label="Copy text"><Copy /></Button>}
    </div>
  )
}

// ---------- overview ----------
const HOWTO: Record<string, string[]> = {
  Webflow: ["Select the heading on the canvas, open Settings (D) and pick H1–H6 under Heading Settings.", "A Div, Text Block or Paragraph can’t become a heading. Drag in a Heading element, give it the same classes, paste the text and delete the old element.", "Components update everywhere at once. Rich Text headings in CMS items are edited in the CMS."],
  WordPress: ["Select the Heading block and change the level in the toolbar.", "Turn a Paragraph into a heading with Transform → Heading.", "Site title and widget titles live in the Site Editor or theme files. Page builders set the tag in the widget’s settings."],
  Shopify: ["Headings live in theme sections. Use the section’s heading-tag setting if it has one, otherwise edit its Liquid file.", "The product title is the H1 in the product template."],
  Wix: ["Select the text and pick Heading 1–6 or Paragraph in Text settings.", "Under SEO settings, “HTML tag” lets a heading keep its look while its tag changes."],
  Other: ["Change the element’s tag (h1–h6) in the page builder or template, and keep its class so the look doesn’t change."],
}

function Overview() {
  const { run, result, cstate } = useRun()
  const { status } = useApp()
  const R = result!, r = run!, s = r.settings, j = r.job
  const planned = R.pages.filter((p) => p.planned)
  const combined = R.site.modes.length > 1
  const tot = taskCounts(R.pages, cstate.done)
  const later = tot.tasks - tot.now.tasks
  const sc = siteChecks(R.pages, R.site.modes.includes("optimize") ? "optimize" : "live", R.site.sharedHeadings)
  const notes = [...sc.filter((c) => !c.ok || c.info).map((c) => ({ t: c.ok ? "Note" : "Fix", x: c.text })), ...R.sitewide.filter(([t]) => t !== "keep").map(([t, x]) => ({ t: t === "retag" ? "Re-tag" : "Idea", x }))]
  const stats: [string | number, string, boolean?][] = combined
    ? [[tot.now.tasks, "tag fixes to do now", true], [later, cstate.approved ? "rewrites, client approved" : "rewrites after client sign-off", true], [`${tot.tasks ? pct(tot.done / tot.tasks) : 0}%`, "done"], [planned.length, "pages planned"]]
    : [[tot.tasks, "changes to make", true], [`${tot.tasks ? pct(tot.done / tot.tasks) : 0}%`, "done"], [planned.length, "pages planned"], [planned.filter((p) => p.modes.live?.h1.proposed).length, "H1 ideas for later"]]
  return (
    <div>
      <Tag tone="muted">{combined ? "Tags + rewrites" : R.site.modes[0] === "live" ? "Tags only" : "Rewrites"}</Tag>
      <h1 className="mt-2 text-3xl font-medium">{R.site.name}</h1>
      {s && <p className="mt-2 text-sm text-muted-foreground">Planned {ago(j?.ended || r.updated)} with {status?.catalog[s.engine].name} · {modelName(status, s.engine, s.model)} · {status?.effort[s.effort]?.name || s.effort} effort · keywords are unverified (no keyword tool connected)</p>}
      {R.warnings.length > 0 && <div className="mt-4 rounded-xl border border-brand/40 p-3 text-sm">{R.warnings.join(" ")}</div>}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
        {stats.map(([v, l, b]) => <div key={l} className="bg-card p-4"><div className={cn("text-3xl font-medium tracking-tight tabular", b && "text-brand")}>{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}
      </div>
      <h2 className="mt-10 mb-3 text-lg font-medium">Pages</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {planned.map((p) => {
          const c = pageCounts(p, cstate.done), f = pageChecks(p, finalMode(p)).filter((x) => !x.ok).length
          return (
            <button key={p.id} onClick={() => go(routes.review(r.id, "p:" + p.id))} className="grid w-full grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(110px,24%)] items-center gap-5 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/50">
              <span className="min-w-0"><span className="block truncate font-medium">{p.name}{f ? <span className="ml-2 align-middle"><Tag tone="brand">{f} to fix</Tag></span> : null}</span><span className="block truncate tabular text-xs text-muted-foreground">{p.path}</span></span>
              <span className="min-w-0 truncate text-sm">{p.keywords ? <><span className="text-brand-ink">{p.keywords.primary[0]}</span>{p.keywords.secondary.length ? <span className="text-muted-foreground"> +{p.keywords.secondary.length}</span> : null}</> : <span className="text-muted-foreground">Brand page</span>}</span>
              <span className="flex items-center gap-2"><Bar value={c.tasks ? (100 * c.done) / c.tasks : 100} /><span className="w-9 text-right text-xs text-muted-foreground tabular">{c.tasks ? `${c.done}/${c.tasks}` : "–"}</span></span>
            </button>
          )
        })}
      </div>
      {notes.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-lg font-medium">Across the site</h2>
          <ul className="grid gap-3 rounded-2xl border bg-card p-4 text-sm">{notes.map((n, i) => <li key={i} className="grid grid-cols-[4.5rem_1fr] items-start gap-3"><Tag className="mt-px justify-self-start" tone={n.t === "Fix" ? "brand" : n.t === "Re-tag" ? "solid" : "muted"}>{n.t}</Tag><span>{n.x.replace(/~(\w[\w.-]*)~/g, "$1")}</span></li>)}</ul>
        </>
      )}
      {R.gaps.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-lg font-medium">Keyword gaps</h2>
          <ul className="grid gap-2 rounded-2xl border bg-card p-4 text-sm">{R.gaps.map((g) => <li key={g.cluster}><b>{g.cluster}</b> <span className="text-muted-foreground">{g.note}</span></li>)}</ul>
        </>
      )}
      <details className="mt-10 rounded-2xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">How to change a heading in {HOWTO[R.site.platform] ? R.site.platform : "your site builder"}</summary>
        <ol className="mt-3 grid list-decimal gap-2 pl-5">{(HOWTO[R.site.platform] || HOWTO.Other!).map((x) => <li key={x}>{x}</li>)}</ol>
      </details>
    </div>
  )
}

function SignOff({ setApproved }: { setApproved: (v: boolean) => void }) {
  const { run, result, cstate } = useRun()
  const R = result!
  const hasRewrites = R.site.modes.includes("optimize")
  const combined = R.site.modes.length > 1
  const mode = hasRewrites ? "optimize" : "live"
  const pages = R.pages.filter((p) => p.planned && p.modes[mode])
  const h1 = pages.filter((p) => p.modes[mode]!.h1.proposed)
  const rewrites = combined ? pages.reduce((a, p) => a + phases(p).rows.filter((r) => r.phase === 2 && isTask(r)).length, 0) : 0
  const msg = `Hi,\n\nFor ${R.site.name}, we recommend changing these page titles (H1s) so each page says what it offers, in the words people search for:\n\n${h1.map((p) => { const x = p.modes[mode]!.h1; return `• ${p.name} (${p.path})\n  Now: "${x.cur}"\n  New: "${x.proposed}"${x.why ? `\n  Why: ${x.why}` : ""}` }).join("\n\n")}${rewrites > h1.length ? `\n\nThere are also ${rewrites - h1.length} smaller heading rewrites on these pages. We can send the full list.` : ""}\n\nCould you confirm these, or tell us which to adjust?\n\nThanks!`
  const withNotes = pages.filter((p) => p.modes[mode]!.notes.length)
  return (
    <div>
      <Tag tone="muted">{hasRewrites ? "Needs approval" : "Not part of the tag fixes"}</Tag>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-medium">{hasRewrites ? "Client sign-off" : "Suggestions for later"}</h1>
        <span className="flex-1" />
        {combined && <ApprovalBar approved={!!cstate.approved} onChange={setApproved} />}
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {combined ? "The rewrites wait for the client. Send them this list, then tick “Client approved” to unlock the rewrites on each page." : hasRewrites ? "Every H1 change needs the client’s approval. Send them this list." : "Wording ideas the developer shouldn’t apply now. H1 changes need the client’s OK first."}
      </p>
      <div className="mt-8 flex items-center gap-3"><h2 className="text-lg font-medium">H1 changes</h2><span className="flex-1" />{h1.length > 0 && <Button onClick={() => { navigator.clipboard.writeText(msg); toast.success("Message copied", { description: "Paste it into an email or Slack." }) }}><Copy /> Copy message for the client</Button>}</div>
      {h1.length ? (
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
          {h1.map((p) => { const x = p.modes[mode]!.h1; return (
            <button key={p.id} onClick={() => go(routes.review(run!.id, "p:" + p.id))} className="grid w-full grid-cols-[140px_minmax(0,1fr)_minmax(0,1.3fr)] gap-5 border-b px-4 py-3.5 text-left text-sm last:border-b-0 hover:bg-muted/50">
              <b>{p.name}</b><span className="text-muted-foreground line-through">{x.cur}</span><span><b>{x.proposed}</b>{x.why && <span className="mt-1 block text-xs text-muted-foreground">{x.why}</span>}</span>
            </button>
          ) })}
        </div>
      ) : <p className="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">No H1 changes suggested.</p>}
      {withNotes.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-lg font-medium">{hasRewrites ? "Ideas" : "Other suggestions"}</h2>
          <div className="grid gap-3">
            {withNotes.map((p) => (
              <div key={p.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center"><b className="text-sm">{p.name}</b><span className="flex-1" /><Button variant="ghost" size="xs" onClick={() => go(routes.review(run!.id, "p:" + p.id))}>Open page <ChevronRight /></Button></div>
                <ul className="mt-2 grid gap-1.5 text-sm text-foreground/80">{p.modes[mode]!.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
