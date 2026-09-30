import * as React from "react"
import { cn } from "cn"
import { AlertTriangle, ArrowRight, Check, ChevronDown, CircleStop, Download, Eye, FileText, PenLine, RefreshCw, Sparkles, Wrench, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Bar, HTag, Spinner, Tag } from "@/components/common/bits"
import { Screenshot, type Marker } from "@/components/common/Screenshot"
import { useApp } from "@/hooks/useApp"
import { api, exportUrl, seoCsvUrl, shotUrl, type CrawlData, type LogEntry, type Progress, type Run, type ScanPage, type Result, type Mode, type SeoResult, type SeoState } from "@/lib/api"
import { ago, fmtClock, fmtDur, pct, plural } from "@/lib/format"
import { go, routes } from "@/lib/router"
import { finalMode, isTask, pageChecks, phases, siteChecks } from "@/lib/checks"
import * as SEO from "@/lib/seo"

/** A block in the run thread: mono label, title, optional right side, body. */
export function Block({ label, title, right, children, className }: { label: string; title: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-muted-foreground">{label}</div>
          <h2 className="mt-0.5 truncate text-[17px] font-medium">{title}</h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}

export function StepIcon({ state }: { state: "done" | "active" | "todo" }) {
  if (state === "done") return <span className="grid size-5 place-items-center rounded-full bg-done text-background"><Check className="size-3" strokeWidth={2.5} /></span>
  if (state === "active") return <span className="grid size-5 place-items-center"><Spinner className="size-4" /></span>
  return <span className="size-5 rounded-full border border-dashed border-input" />
}

// ---------- scan ----------
export function ScanBlock({ run, progress }: { run: Run; progress: Progress | null }) {
  const s = run.scan
  const pages = run.pages || []
  const ok = pages.filter((p) => p.status && p.status < 400)
  const steps: [string, string][] = [["open", "Open the site"], ["nav", "Read the navigation"], ["sitemap", "Find every page"], ["pages", "Wait for preloaders, record headings, take screenshots"]]
  const at = steps.findIndex((x) => x[0] === s?.step)
  const scanning = run.status === "scanning"
  const tookSec = s?.ended && s?.started ? (s.ended - s.started) / 1000 : null
  const stepsList = (
    <ol className="grid gap-1 px-5 pb-4">
      {steps.map(([k, l], i) => {
        const state = !scanning || i < at ? "done" : i === at ? "active" : "todo"
        const sub = k === "pages" && s?.total ? `${s.done} of ${s.total}` : k === "sitemap" && pages.length ? plural(pages.length, "page") + " found" : ""
        return (
          <li key={k} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm", state === "active" && "bg-muted/70", state === "todo" && "text-muted-foreground")}>
            <StepIcon state={state} /><span className="flex-1">{l}</span><span className="text-xs text-muted-foreground tabular">{sub}</span>
          </li>
        )
      })}
    </ol>
  )
  if (scanning)
    return (
      <Block label="Scan · runs on your Mac" title={<>Scanning {run.name}</>}>
        <div className="px-5 pb-3">
          <Bar value={progress?.percent || 3} tone="brand" className="h-1.5" />
          <div className="mt-2 flex items-baseline justify-between text-sm"><span className="text-2xl font-medium tracking-tight tabular">{progress?.percent || 0}%</span><span className="text-muted-foreground">{progress?.etaSec != null && s?.step === "pages" ? `About ${fmtDur(progress.etaSec)} left` : "Starting…"}</span></div>
        </div>
        {stepsList}
      </Block>
    )
  const noH1 = ok.filter((p) => p.counts && p.counts.H1 === 0).length
  const multi = ok.filter((p) => p.counts && (p.counts.H1 || 0) > 1).length
  const styled = ok.reduce((a, p) => a + (p.styled || 0), 0)
  const stats: [number, string, boolean][] = [
    [ok.length, ok.length === 1 ? "page scanned" : "pages scanned", false],
    [noH1, noH1 === 1 ? "page with no H1" : "pages with no H1", noH1 > 0],
    [multi, multi === 1 ? "page with several H1s" : "pages with several H1s", multi > 0],
    [styled, "look like headings but aren’t tagged", styled > 0],
  ]
  return (
    <Block label="Scan · runs on your Mac" title={<>{pages.length > ok.length ? <>Read {ok.length} of the {pages.length} pages found</> : <>Scanned {plural(ok.length, "page")}</>}{tookSec ? <span className="font-normal text-muted-foreground"> in {fmtDur(tookSec)}</span> : null}</>} right={<span className="text-xs text-muted-foreground">{ago(run.crawledAt || run.created)}</span>}>
      <div className="grid grid-cols-2 gap-px overflow-hidden border-y bg-border sm:grid-cols-4">
        {stats.map(([n, l]) => (
          <div key={l} className="bg-card px-5 py-3.5">
            <div className="text-2xl font-medium tracking-tight tabular">{n}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-2 px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" /> What the scan did
          {run.platform && run.platform !== "Other" && <span className="ml-auto">Built with {run.platform}</span>}
        </CollapsibleTrigger>
        <CollapsibleContent>{stepsList}</CollapsibleContent>
      </Collapsible>
    </Block>
  )
}

// ---------- pages ----------
function groupOf(p: ScanPage) {
  if (p.status === 0 || (p.status || 0) >= 400) return "broken"
  if (p.status == null) return "unscanned"
  if (p.legal) return "legal"
  if (p.collection) return "col:" + p.collection
  if (p.sources.includes("header")) return "header"
  if (p.sources.includes("footer")) return "footer"
  if (p.sources.includes("home")) return "home"
  return "sitemap"
}
const GROUP: Record<string, [string, string?]> = {
  header: ["Main navigation"], footer: ["Footer"], home: ["Linked from the home page"], legal: ["Legal", "Rarely need work. Add them if you want them checked."],
  sitemap: ["Only in the sitemap", "Not linked from the navigation."], unscanned: ["Not scanned", "Over the 60-page limit."], broken: ["Couldn’t load"],
}

/**
 * The scan's pages. On a plan's page you pick which ones to plan; with `browse` it's a plain list of what was found,
 * folded until you open it.
 */
export function PagesBlock({ run, selected, setSelected, locked, browse }: { run: Run; selected: Set<string>; setSelected: (s: Set<string>) => void; locked?: boolean; browse?: boolean }) {
  const [peek, setPeek] = React.useState<ScanPage | null>(null)
  const [expanded, setExpanded] = React.useState(!run.settings && !browse)
  const pages = run.pages || []
  const usable = pages.filter((p) => p.status && p.status < 400)
  const groups = new Map<string, ScanPage[]>()
  pages.forEach((p) => { const g = groupOf(p); groups.set(g, [...(groups.get(g) || []), p]) })
  const order = ["header", "footer", "home", ...[...groups.keys()].filter((g) => g.startsWith("col:")), "legal", "sitemap", "unscanned", "broken"].filter((g) => groups.has(g))
  const toggle = (id: string, v: boolean) => { const n = new Set(selected); if (v) n.add(id); else n.delete(id); setSelected(n) }
  const pick = (f: (p: ScanPage) => boolean) => setSelected(new Set(usable.filter(f).map((p) => p.id)))
  return (
    <Block
      label="Pages"
      title={browse ? <>{plural(pages.length, "page")} found</> : <>{run.settings && !expanded ? "Planned" : "Plan"} {selected.size} of {plural(usable.length, "page")}</>}
      right={browse ? (
        <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide pages" : "Show pages"}</Button>
      ) : !expanded ? (
        <Button variant="outline" size="sm" disabled={locked} onClick={() => setExpanded(true)}>Change pages</Button>
      ) : !locked && (
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 text-xs">
          <button className="rounded-md px-2 py-1 hover:bg-card" onClick={() => pick((p) => p.selected)}>Main pages</button>
          <button className="rounded-md px-2 py-1 hover:bg-card" onClick={() => pick(() => true)}>All</button>
          <button className="rounded-md px-2 py-1 hover:bg-card" onClick={() => pick(() => false)}>None</button>
        </div>
      )}
    >
      {expanded && <div className="border-t">
        {order.map((g) => {
          const list = groups.get(g)!
          const col = g.startsWith("col:") ? g.slice(4) : null
          const [name, hint] = col ? [`${col.slice(1)} (${list.length})`, "These share one template, so planning one is usually enough."] : GROUP[g]!
          return (
            <div key={g} className="border-b last:border-b-0">
              <div className="flex items-baseline gap-2 px-5 pt-3 pb-1"><span className="text-xs font-medium">{name}</span>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>
              {list.map((p) => {
                const bad = p.status === 0 || (p.status || 0) >= 400, uns = p.status == null, c = p.counts || {}
                const on = selected.has(p.id)
                return (
                  <div key={p.id} className={cn("group grid items-center gap-3 px-5 py-2 hover:bg-muted/50", browse ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[20px_minmax(0,1fr)_auto_auto]", !on && !browse && "text-muted-foreground")}>
                    {!browse && <Checkbox checked={on} disabled={bad || uns || locked} onCheckedChange={(v) => toggle(p.id, !!v)} aria-label={`Plan ${p.name}`} />}
                    <button className="min-w-0 text-left" onClick={() => !bad && !uns && setPeek(p)}>
                      <span className={cn("block truncate text-sm font-medium", (on || browse) && "text-foreground")}>{p.navGroup ? <span className="text-muted-foreground">{p.navGroup} › </span> : null}{p.name}</span>
                      <span className="block truncate tabular text-xs text-muted-foreground">{p.path}</span>
                    </button>
                    <span className="flex items-center gap-1.5">
                      {bad ? <Tag tone="bad">{p.status ? `HTTP ${p.status}` : "Didn’t load"}</Tag> : uns ? <Tag tone="muted">Not scanned</Tag> : (
                        <>
                          {c.H1 === 0 && <Tag tone="bad">No H1</Tag>}
                          {(c.H1 || 0) > 1 && <Tag tone="bad">{c.H1} H1s</Tag>}
                          <span className="text-xs text-muted-foreground tabular">{plural(p.headings || 0, "heading")}</span>
                        </>
                      )}
                    </span>
                    {!bad && !uns ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => setPeek(p)} aria-label={`Preview ${p.name}`} className="opacity-60 group-hover:opacity-100"><Eye /></Button>
                    ) : <span />}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>}
      <PreviewSheet run={run} page={peek} onClose={() => setPeek(null)} />
    </Block>
  )
}

/** Preview of a scanned page (no AI): current heading outline beside the screenshot. */
export function PreviewSheet({ run, page, onClose }: { run: Run; page: ScanPage | null; onClose: () => void }) {
  const [data, setData] = React.useState<CrawlData | null>(null)
  const [active, setActive] = React.useState<string | null>(null)
  React.useEffect(() => {
    setData(null); setActive(null)
    if (page) api.crawl(run.id, page.id).then(setData).catch(() => {})
  }, [run.id, page])
  const items = (data?.items || []).map((it, i) => ({ ...it, key: it.ref || "x" + i }))
  const markers: Marker[] = items.map((it, i) => ({ key: it.key, n: i + 1, rect: it.rect, label: it.text, quiet: false }))
  return (
    <Sheet open={!!page} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[min(1080px,94vw)]! max-w-none! gap-0 p-0" side="right">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>{page?.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-2 tabular text-xs">
            {page?.path}
            <a href={(run.origin || "") + (page?.path || "")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><ExternalLink className="size-3" />Open</a>
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,340px)_1fr]">
          <div className="scrollbar-thin min-h-0 overflow-auto border-r py-3">
            <div className="px-5 pb-2"><Tag tone="muted">Headings as they are now</Tag></div>
            {!data && <div className="px-5 py-2"><Spinner /></div>}
            {items.map((it, i) => {
              const h = /^H[1-6]$/.test(it.kind), lvl = h ? +it.kind[1]! : 0
              return (
                <button key={it.key} onMouseEnter={() => setActive(it.key)} onClick={() => setActive(it.key)} className={cn("flex w-full items-start gap-2 py-1.5 pr-4 text-left text-sm hover:bg-muted/60", active === it.key && "bg-muted")} style={{ paddingLeft: 20 + (h ? (lvl - 1) * 12 : 0) }}>
                  <span className="mt-px text-[10.5px] text-muted-foreground tabular">{i + 1}</span>
                  {h ? <HTag tag={it.kind} /> : <Tag tone="muted">styled</Tag>}
                  <span className={cn("min-w-0 flex-1", it.hidden && "opacity-50")}>{it.text.slice(0, 120)}{it.hidden && <span className="text-muted-foreground"> · hidden</span>}{it.zone && <span className="text-muted-foreground"> · {it.zone}</span>}{!it.rect && !it.hidden && <span className="text-muted-foreground"> · not in the screenshot (closed tab or menu)</span>}</span>
                </button>
              )
            })}
            {data && !items.length && <p className="px-5 text-sm text-muted-foreground">No headings on this page.</p>}
          </div>
          {page && <Screenshot src={shotUrl(run, page.id)} markers={markers} active={active} onPick={setActive} className="h-full" />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------- planning ----------
export function modelName(status: ReturnType<typeof useApp>["status"], engine: string, model: string) {
  const m = status?.catalog[engine as "claude"]?.models.find((x) => x.id === model)
  return m ? m.name : model
}

export function PlanBlock({ run, progress, log: all, result, onStop }: { run: Run; progress: Progress | null; log: LogEntry[]; result: Result | null; onStop: () => void }) {
  const { status } = useApp()
  const log = all.filter((e) => !e.job)
  const s = run.settings!, j = run.job
  const sel = run.pages.filter((p) => run.selected.includes(p.id))
  const planned = new Set(progress?.plannedIds || [])
  const running = run.status === "running"
  const done = (run.status === "done" || run.status === "partial") && result
  const eng = status?.catalog[s.engine]?.name || s.engine
  const lim = progress?.limits || j?.limits
  const f5 = lim?.first?.five_hour, l5 = lim?.last?.five_hour
  const took = j?.ended && j?.started ? fmtDur((j.ended - j.started) / 1000) : null
  const title = running ? <>Planning {plural(sel.length, "page")}</>
    : done ? (run.status === "partial" ? "Plan ready, some pages missing" : "Plan ready")
    : run.status === "cancelled" ? "Plan stopped" : "The plan didn’t finish"
  return (
    <Block
      label={`Heading plan${s.skill && s.skill !== "h-tag-planner" && s.skillName ? ` · ${s.skillName}` : ""} · ${eng} · ${modelName(status, s.engine, s.model)} · ${status?.effort[s.effort]?.name || s.effort} effort`}
      title={title}
      className={cn(done && "border-foreground/25")}
      right={running ? <Button variant="outline" size="sm" onClick={onStop}><CircleStop /> Stop</Button> : done ? (
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}><Download /> Export</DropdownMenuTrigger>
            <ExportItems id={run.id} modes={result!.site.modes} />
          </DropdownMenu>
          <Button size="sm" onClick={() => go(routes.review(run.id))}>Open the plan <ArrowRight /></Button>
        </div>
      ) : null}
    >
      {running && (
        <>
          <div className="px-5 pt-1 pb-2">
            <Bar value={progress?.percent || 1} tone="brand" className="h-1.5" />
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className="text-2xl font-medium tracking-tight tabular">{progress?.percent || 0}%</span>
              <span className="text-muted-foreground">{progress?.etaSec != null ? `About ${fmtDur(progress.etaSec)} left · ` : ""}{fmtClock(progress?.elapsedSec)} elapsed</span>
            </div>
          </div>
          <ol className="grid gap-1 px-5 pb-3">
            {(progress?.stages || []).map((st) => (
              <li key={st.key} className={cn("grid grid-cols-[20px_1fr_auto] items-start gap-3 rounded-lg px-2 py-2 text-sm", st.state === "active" && "bg-muted/70", st.state === "todo" && "text-muted-foreground")}>
                <StepIcon state={st.state} />
                <div className="min-w-0">
                  <div>{st.label}</div>
                  {st.key === "fix" && <p className="mt-0.5 text-xs text-muted-foreground">Some automatic checks failed, so the AI is fixing them.</p>}
                  {st.key === "plan" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sel.map((p) =>
                        planned.has(p.id) ? (
                          <button key={p.id} onClick={() => go(routes.review(run.id, "p:" + p.id))} className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-foreground hover:bg-muted" title="Review this page now"><Check className="size-3" />{p.name}</button>
                        ) : progress?.current?.id === p.id ? (
                          <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-2 py-0.5 text-xs text-brand-ink"><Spinner className="size-3" />{p.name}</span>
                        ) : <span key={p.id} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{p.name}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular">{st.key === "plan" ? `${st.done} of ${st.total}` : st.key === "keywords" && st.at != null ? fmtClock(st.at) : ""}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {done && <ResultStats result={result!} />}
      {!running && !done && run.error && <p className="border-t px-5 py-3 text-sm text-muted-foreground">{run.error}</p>}
      {(run.warnings || []).length > 0 && done && <div className="flex gap-2 border-t px-5 py-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" />{run.warnings!.join(" ")}</div>}
      <Collapsible defaultOpen={running}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-2.5 text-xs text-muted-foreground">
          <CollapsibleTrigger className="group inline-flex items-center gap-1.5 hover:text-foreground">
            <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
            Activity{running && log.length ? <span className="max-w-[26ch] truncate">· {log[log.length - 1]!.text}</span> : null}
          </CollapsibleTrigger>
          <span className="flex-1" />
          {took && !running && <span>Took {took}</span>}
          {running && f5 && l5 ? <span>5-hour window <b className="text-foreground tabular">{pct(f5.utilization)}% → {pct(l5.utilization)}%</b></span>
            : j?.limitDelta != null ? <span><b className="text-foreground tabular">{Math.max(1, pct(j.limitDelta))}%</b> of your 5-hour window</span> : null}
        </div>
        <CollapsibleContent><ActivityLog log={log} /></CollapsibleContent>
      </Collapsible>
    </Block>
  )
}

function ResultStats({ result }: { result: Result }) {
  const pages = result.pages.filter((p) => p.planned)
  const rows = pages.flatMap((p) => phases(p).rows.filter(isTask))
  const now = rows.filter((r) => r.phase === 1).length, later = rows.filter((r) => r.phase === 2).length
  const combined = result.site.modes.length > 1
  const fails = pages.reduce((a, p) => a + pageChecks(p, finalMode(p)).filter((c) => !c.ok).length, 0) + siteChecks(result.pages, result.site.modes.includes("optimize") ? "optimize" : "live", result.site.sharedHeadings).filter((c) => !c.ok).length
  const cells: [React.ReactNode, string, boolean?][] = combined
    ? [[now, "tag fixes to do now", true], [later, "rewrites after client sign-off", true]]
    : [[now, result.site.modes[0] === "live" ? "tag fixes to do now" : "changes", true], [pages.filter((p) => p.modes.live?.h1.proposed).length, "H1 ideas for later"]]
  cells.push([fails || "All", fails ? (fails === 1 ? "automatic check to look at" : "automatic checks to look at") : "automatic checks pass", !!fails])
  return (
    <div className="grid gap-px border-t bg-border" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map(([v, l]) => <div key={l} className="bg-card px-5 py-3.5"><div className="text-2xl font-medium tabular">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}
    </div>
  )
}

export function ExportItems({ id, modes }: { id: string; modes: Mode[] }) {
  return (
    <DropdownMenuContent align="end" className="w-72">
      <DropdownMenuGroup>
        <DropdownMenuLabel>A single HTML page for the developer or client</DropdownMenuLabel>
        {modes.map((m) => (
          <DropdownMenuItem key={m} render={<a href={exportUrl(id, m, true)} download />}><Download /> {m === "live" ? "Tag fixes (Live H-tag map)" : "With rewrites (Optimization plan)"}</DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  )
}

export function FailedBlock({ run, onRetry }: { run: Run; onRetry: () => void }) {
  return (
    <Block label="Problem" title={run.status === "scan_failed" ? "Groundwork couldn’t scan this site" : "The plan didn’t finish"} right={<Button size="sm" variant="outline" onClick={onRetry}><RefreshCw /> Try again</Button>}>
      <p className="border-t px-5 py-3 text-sm text-muted-foreground">{run.status === "scan_failed" ? run.scan?.error : run.error || "Unknown error."}</p>
    </Block>
  )
}

// ---------- activity ----------
const LOG_ICON: Record<string, React.ElementType> = { tool: FileText, ai: Sparkles, step: Check, error: AlertTriangle, stderr: Wrench }
export function ActivityLog({ log }: { log: LogEntry[] }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const items = log.filter((e) => e.kind !== "stderr")
  React.useEffect(() => { const el = ref.current; if (el && el.scrollTop + el.clientHeight > el.scrollHeight - 80) el.scrollTop = el.scrollHeight }, [items.length])
  React.useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight }, [])
  return (
    <div ref={ref} className="scrollbar-thin max-h-72 overflow-auto border-t bg-surface px-5 py-3">
      {!items.length && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
      <ol className="grid gap-2.5">
        {items.map((e, i) => {
          const Icon = e.kind === "tool" && /^Wrote|^Updated/.test(e.text) ? PenLine : e.kind === "tool" && /screenshot/.test(e.text) ? Eye : LOG_ICON[e.kind] || FileText
          return (
            <li key={i} className="grid grid-cols-[16px_1fr_auto] gap-2.5 text-[13px]">
              <Icon className={cn("mt-0.5 size-4", e.kind === "error" ? "text-destructive" : e.kind === "step" ? "text-foreground/70" : "text-muted-foreground")} />
              <p className={cn("min-w-0 break-words", e.kind === "ai" ? "whitespace-pre-wrap text-foreground" : e.kind === "step" ? "font-medium" : "text-muted-foreground")}>{e.kind === "ai" ? e.text.slice(0, 700) : e.text}</p>
              <time className="tabular text-[10.5px] text-muted-foreground/80">{new Date(e.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------- SEO plan ----------
export function SeoBlock({ run, progress, log: all, result, state, onStop }: { run: Run; progress: Progress | null; log: LogEntry[]; result: SeoResult | null; state: SeoState; onStop: () => void }) {
  const { status } = useApp()
  const sq = run.seo!, s = sq.settings, j = sq.job
  const log = all.filter((e) => e.job === "seo")
  const sel = run.pages.filter((p) => sq.selected.includes(p.id))
  const planned = new Set(progress?.plannedIds || [])
  const running = sq.status === "running"
  const done = (sq.status === "done" || sq.status === "partial") && result
  const eng = status?.catalog[s.engine]?.name || s.engine
  const took = j?.ended && j?.started ? fmtDur((j.ended - j.started) / 1000) : null
  const title = running ? <>Writing SEO for {plural(sel.length, "page")}</>
    : done ? (sq.status === "partial" ? "SEO plan ready, some pages missing" : "SEO plan ready")
    : sq.status === "cancelled" ? "SEO plan stopped" : "The SEO plan didn’t finish"
  return (
    <Block
      label={`SEO plan${s.skill && s.skill !== "seo-builtin" && s.skillName ? ` · ${s.skillName}` : ""} · ${eng} · ${modelName(status, s.engine, s.model)} · ${status?.effort[s.effort]?.name || s.effort} effort`}
      title={title}
      className={cn(done && "border-foreground/25")}
      right={running ? <Button variant="outline" size="sm" onClick={onStop}><CircleStop /> Stop</Button> : done ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={seoCsvUrl(run.id)} download />}><Download /> Export</Button>
          <Button size="sm" onClick={() => go(routes.seo(run.id))}>Open SEO plan <ArrowRight /></Button>
        </div>
      ) : null}
    >
      {running && (
        <>
          <div className="px-5 pt-1 pb-2">
            <Bar value={progress?.percent || 1} tone="brand" className="h-1.5" />
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className="text-2xl font-medium tracking-tight tabular">{progress?.percent || 0}%</span>
              <span className="text-muted-foreground">{progress?.etaSec != null ? `About ${fmtDur(progress.etaSec)} left · ` : ""}{fmtClock(progress?.elapsedSec)} elapsed</span>
            </div>
          </div>
          <ol className="grid gap-1 px-5 pb-3">
            {(progress?.stages || []).map((st) => (
              <li key={st.key} className={cn("grid grid-cols-[20px_1fr_auto] items-start gap-3 rounded-lg px-2 py-2 text-sm", st.state === "active" && "bg-muted/70", st.state === "todo" && "text-muted-foreground")}>
                <StepIcon state={st.state} />
                <div className="min-w-0">
                  <div>{st.label}</div>
                  {st.key === "fix" && <p className="mt-0.5 text-xs text-muted-foreground">Some automatic checks failed, so the AI is fixing them.</p>}
                  {st.key === "plan" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sel.map((p) =>
                        planned.has(p.id) ? <span key={p.id} className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-foreground"><Check className="size-3" />{p.name}</span>
                        : progress?.current?.id === p.id ? <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-2 py-0.5 text-xs text-brand-ink"><Spinner className="size-3" />{p.name}</span>
                        : <span key={p.id} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{p.name}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular">{st.key === "plan" || (st.key === "refresh" && st.state === "active") ? `${st.done} of ${st.total}` : st.key === "keywords" && st.at != null ? fmtClock(st.at) : ""}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {done && <SeoStats result={result!} state={state} />}
      {!running && !done && sq.error && <p className="border-t px-5 py-3 text-sm text-muted-foreground">{sq.error}</p>}
      {(sq.warnings || []).length > 0 && done && <div className="flex gap-2 border-t px-5 py-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" />{sq.warnings!.join(" ")}</div>}
      <Collapsible defaultOpen={running}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-2.5 text-xs text-muted-foreground">
          <CollapsibleTrigger className="group inline-flex items-center gap-1.5 hover:text-foreground">
            <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
            Activity{running && log.length ? <span className="max-w-[26ch] truncate">· {log[log.length - 1]!.text}</span> : null}
          </CollapsibleTrigger>
          <span className="flex-1" />
          {took && !running && <span>Took {took}</span>}
        </div>
        <CollapsibleContent><ActivityLog log={log} /></CollapsibleContent>
      </Collapsible>
    </Block>
  )
}

function SeoStats({ result, state }: { result: SeoResult; state: SeoState }) {
  const pages = result.pages.filter((p) => p.planned)
  const all = pages.flatMap((p) => SEO.tasks(p, state.edits))
  const n = (f: string) => all.filter((t) => t.field === f).length
  const fails = pages.reduce((a, p) => a + SEO.pageChecks(p, state.edits).filter((c) => !c.ok && !c.info).length, 0) + SEO.siteChecks(result.pages, state.edits).filter((c) => !c.ok).length
  const cells: [React.ReactNode, string, boolean?][] = [[n("title"), "new titles", true], [n("description"), "new descriptions", true], [n("slug"), n("slug") === 1 ? "URL change" : "URL changes"], [fails || "All", fails ? "checks to look at" : "checks pass", !!fails]]
  return (
    <div className="grid grid-cols-4 gap-px border-t bg-border">
      {cells.map(([v, l]) => <div key={l} className="bg-card px-5 py-3.5"><div className="text-2xl font-medium tabular">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}
    </div>
  )
}
