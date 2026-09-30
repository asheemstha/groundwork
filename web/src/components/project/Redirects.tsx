import * as React from "react"
import { cn } from "cn"
import { ArrowRight, Check, Copy, Download, Loader2, Play, RotateCw, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/common/bits"
import { ToolCard } from "@/components/project/ToolCard"
import { api, type Project, type RedirectMap, type RedirectProblem, type RedirectResult, type RedirectRow, type RedirectState } from "@/lib/api"
import { go, routes } from "@/lib/router"
import { hostOfUrl, today } from "@/lib/project"
import { FORMATS, formatsFor, platformOf, renderRedirects, stagingExample, type RedirectFormat } from "@/lib/platforms"
import { Checkbox } from "@/components/ui/checkbox"

const when = (at: number) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const hostOf = (u: string) => { try { return new URL(/^https?:/i.test(u) ? u : "https://" + u).hostname } catch { return u } }
const key = (p: string) => p.toLowerCase()
const moves = (r: RedirectRow) => key(r.to) !== key(r.from)
const HOW: Record<RedirectRow["how"], (r: RedirectRow) => string> = {
  same: () => "Same URL",
  seo: () => "From the SEO plan",
  slug: () => "Same slug",
  similar: (r) => `Similar, ${r.score}%`,
  parent: () => "Its section",
  home: () => "Home page",
  manual: () => "You chose",
}
const PROBLEM: Record<RedirectProblem, string> = {
  error: "No answer",
  missing: "Page not found",
  moved: "Redirects away",
  none: "Not redirected",
  loop: "Redirect loop",
  "dead-end": "Ends on a missing page",
  wrong: "Goes somewhere else",
  temporary: "Temporary, not 301",
  chain: "Several hops",
}
const BUILD_STEPS = [
  { id: "old", label: "Read the current site’s URLs" },
  { id: "new", label: "Read the new site’s pages" },
  { id: "titles", label: "Read old page titles to match renamed pages" },
  { id: "match", label: "Match them" },
] as const

/** Loads the map and follows a build or test until it finishes. */
function useRedirects(p: Project, reload: () => void) {
  const [st, setSt] = React.useState<RedirectState | null>(null)
  const was = React.useRef(false)
  const load = React.useCallback(() => api.redirects(p.id).then((x) => { setSt(x); if (was.current && !x.job) reload(); was.current = !!x.job; return x }), [p.id, reload])
  React.useEffect(() => { load().catch(() => {}) }, [load])
  React.useEffect(() => {
    if (!st?.job) return
    const t = setInterval(() => { load().catch(() => {}) }, 1000)
    return () => clearInterval(t)
  }, [st?.job, load])
  return { st, setSt, load }
}

/** The new site's address to start from: the project's staging site, or the last one the launch check used. */
const stagingGuess = (p: Project) => p.sites.staging || p.tools.launchHistory.find((h) => h.staging)?.url || ""
const oldHost = (p: Project) => hostOfUrl(p.sites.old) || p.host

// ---------- Tools tab card ----------
export function RedirectCard({ p, onEdit }: { p: Project; onEdit: () => void }) {
  const r = p.tools.redirects
  const old = p.tools.oldScan
  const [url, setUrl] = React.useState(stagingGuess(p))
  const [busy, setBusy] = React.useState(false)
  const build = async () => {
    setBusy(true)
    try { await api.buildRedirects(p.id, url); go(routes.project(p.id, "redirects")) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  // Redirects are only needed when the project replaces a site.
  if (!p.sites.old) return (
    <ToolCard title="Redirect map" cost="runs on your Mac, no AI" status="Only needed when this project replaces an old site: it matches the old site’s URLs to the new pages, exports the redirects for Webflow and tests them after launch." action={<Button size="sm" variant="outline" onClick={onEdit}>Add the old site</Button>} />
  )
  return (
    <ToolCard
      title="Redirect map" cost="runs on your Mac, no AI"
      status={p.tools.redirectsRunning ? (p.tools.redirectsRunning === "test" ? "Testing the redirects now." : "Building the map now.")
        : r ? <>{r.total} old URLs: {r.redirects} {r.redirects === 1 ? "redirect" : "redirects"}, {r.same} kept{r.review ? <>, <span className="text-foreground">{r.review} to look at</span></> : ""}. {r.test ? `Last test: ${r.test.ok} of ${r.test.total} worked${r.test.live ? "" : r.test.oldSite ? " on the old site" : " on staging"}.` : "Not tested yet."}</>
        : !old ? `Matches every URL on the old site to its page on the new one, exports the redirects for your platform, and tests them after launch. Scan ${oldHost(p)} first; it starts from that list of URLs.`
        : `Matches the ${old.urls} URLs the scan found on ${oldHost(p)} to the new site’s pages. Enter the new site’s address, usually staging.`}
      action={p.tools.redirectsRunning || r ? <Button size="sm" variant="outline" onClick={() => go(routes.project(p.id, "redirects"))}>{p.tools.redirectsRunning ? <Loader2 className="animate-spin" /> : null}Open the map</Button> : old ? <Button size="sm" variant="outline" onClick={build} disabled={busy || !url.trim()}>{busy && <Loader2 className="animate-spin" />}Build the map</Button> : undefined}
    >
      {!r && !p.tools.redirectsRunning && old && <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={stagingExample(p.platform)} className="h-8" />}
    </ToolCard>
  )
}

// ---------- the map ----------
type Filter = "review" | "moves" | "same" | "failed" | "all"
export function RedirectsPage({ p, reload }: { p: Project; reload: () => void }) {
  const { st, setSt, load } = useRedirects(p, reload)
  const [url, setUrl] = React.useState(stagingGuess(p))
  const [busy, setBusy] = React.useState(false)
  const head = null
  if (!st) return <div className="grid place-items-center py-24"><Spinner /></div>
  const build = async (u: string) => {
    setBusy(true)
    try { setSt(await api.buildRedirects(p.id, u)) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  if (st.job?.kind === "build") {
    const at = BUILD_STEPS.findIndex((s) => s.id === st.job!.progress.step)
    return (
      <div className="grid max-w-4xl gap-5 px-12 pt-8 pb-10">
        {head}
        <div className="flex items-start gap-3"><div className="flex-1"><h1 className="text-[24px] leading-tight font-medium">Building the redirect map</h1><p className="mt-1.5 text-sm text-muted-foreground">It reads both sites with plain requests. A few hundred pages take a minute or two.</p></div><Button variant="outline" size="sm" onClick={() => api.cancelRedirects(p.id).then(() => toast("Stopping…")).catch(() => {})}>Stop</Button></div>
        <section className="grid gap-2.5 rounded-xl border bg-card p-4">
          {BUILD_STEPS.map((s, i) => (
            <div key={s.id} className="grid grid-cols-[18px_minmax(0,1fr)_120px] items-center gap-3 text-[13.5px]">
              {i < at ? <Check className="size-4 text-muted-foreground" /> : i === at ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <span className="size-4 rounded-full border border-dashed border-input" />}
              <span className={cn(i > at && "text-muted-foreground")}>{s.label}</span>
              <span className="text-right text-[12.5px] text-muted-foreground tabular">{i === at && st.job!.progress.done ? (st.job!.progress.total ? `${st.job!.progress.done} of ${st.job!.progress.total}` : `${st.job!.progress.done} found`) : ""}</span>
            </div>
          ))}
        </section>
      </div>
    )
  }
  if (!p.sites.old) return (
    <div className="grid max-w-4xl gap-3 px-12 pt-8 pb-10">
      <h1 className="text-[24px] leading-tight font-medium">Redirect map</h1>
      <p className="text-sm text-muted-foreground">Redirects are only needed when a project replaces an old site. Add the old site’s address in the project details (the ⋯ menu, Edit details), scan it, and the map starts from its URLs.</p>
    </div>
  )
  if (!st.map) return (
    <div className="grid max-w-4xl gap-5 px-12 pt-8 pb-10">
      {head}
      <div><h1 className="text-[24px] leading-tight font-medium">Redirect map</h1><p className="mt-1.5 text-sm text-muted-foreground">{st.error ? st.error : p.tools.oldScan ? `Matches the ${p.tools.oldScan.urls} URLs the scan found on ${oldHost(p)} to the new site’s pages. Enter the new site’s address, usually its staging one.` : "Scan the current site first. The map starts from its list of URLs."}</p></div>
      {p.tools.oldScan && <div className="flex gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={stagingExample(p.platform)} /><Button onClick={() => build(url)} disabled={busy || !url.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Play />}Build the map</Button></div>}
    </div>
  )
  return <MapView p={p} st={st} map={st.map} head={head} setSt={setSt} load={load} rebuild={() => build(st.map!.newUrl)} busy={busy} />
}

function MapView({ p, st, map, head, setSt, load, rebuild, busy }: { p: Project; st: RedirectState; map: RedirectMap; head: React.ReactNode; setSt: (s: RedirectState) => void; load: () => Promise<RedirectState>; rebuild: () => void; busy: boolean }) {
  const rows = map.rows
  const results = map.test?.results || {}
  const review = rows.filter((r) => !r.sure)
  const failed = rows.filter((r) => results[r.from] && !results[r.from]!.ok)
  const counts: Record<Filter, number> = { review: review.length, moves: rows.filter(moves).length, same: rows.filter((r) => !moves(r)).length, failed: failed.length, all: rows.length }
  const [filter, setFilter] = React.useState<Filter>(review.length ? "review" : "moves")
  const [q, setQ] = React.useState("")
  const [limit, setLimit] = React.useState(200)
  const [exporting, setExporting] = React.useState(false)
  const launched = !!p.launch && today() >= p.launch
  const [testUrl, setTestUrl] = React.useState(launched && p.sites.live ? p.sites.live : map.newUrl)
  const testing = st.job?.kind === "test"
  const list = rows.filter((r) => (filter === "all" || (filter === "review" ? !r.sure : filter === "moves" ? moves(r) : filter === "same" ? !moves(r) : !!results[r.from] && !results[r.from]!.ok)) && (!q || (r.from + " " + r.to + " " + r.title).toLowerCase().includes(q.toLowerCase())))
  // The folders most of the list sits in, so a whole section can be sent somewhere at once.
  const folders = Object.entries(list.reduce<Record<string, number>>((a, r) => { const f = "/" + (r.from.split("/")[1] || ""); if (r.from.split("/").length > 2) a[f] = (a[f] || 0) + 1; return a }, {})).sort((x, y) => y[1] - x[1]).slice(0, 5)
  const change = async (b: { to?: Record<string, string>; checked?: Record<string, boolean> }) => { try { setSt(await api.setRedirects(p.id, b)) } catch (e) { toast.error((e as Error).message) } }
  const runTest = async () => { try { setSt(await api.testRedirects(p.id, testUrl)); load() } catch (e) { toast.error((e as Error).message) } }
  const cols = "grid-cols-[18px_minmax(0,1fr)_14px_minmax(0,1fr)_120px_150px_28px]"
  return (
    <div className="grid max-w-6xl gap-5 px-12 pt-8 pb-10">
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {head}
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={rebuild} disabled={busy || testing}>{busy ? <Loader2 className="animate-spin" /> : <RotateCw />}Rebuild</Button>
        <Button size="sm" onClick={() => setExporting(true)} disabled={!counts.moves}><Download />Export redirects</Button>
      </div>
      <div>
        <h1 className="text-[24px] leading-tight font-medium">{review.length ? `${review.length} ${review.length === 1 ? "match" : "matches"} to look at` : "Redirect map"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{rows.length} URLs from the current site ({map.oldHost}), matched to {map.newPages.length} pages on {hostOf(map.newUrl)}. Built {when(map.built)}.{!map.oldLive && " The current site didn’t answer, so the map uses the scan’s list."}</p>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {([[counts.moves, counts.moves === 1 ? "redirect" : "redirects"], [counts.same, "kept as they are"], [counts.review, "to look at"], [map.test ? `${map.test.ok} of ${map.test.total}` : "Not yet", map.test ? `worked in the ${when(map.test.at)} test` : "tested"]] as [React.ReactNode, string][]).map(([v, l]) => (
          <div key={l} className="bg-card p-4"><div className="text-2xl font-medium tabular">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
        ))}
      </div>
      <section className="grid gap-2.5 rounded-xl border bg-card p-4">
        <div className="flex items-baseline gap-2"><h2 className="text-sm font-medium">Test the redirects</h2><span className="text-[12.5px] text-muted-foreground">once they’re imported and published</span></div>
        {testing ? (
          <div className="grid gap-2"><div className="flex items-center gap-2 text-[13px]"><Loader2 className="size-4 animate-spin text-muted-foreground" />Testing {st.job!.progress.done} of {st.job!.progress.total}<span className="flex-1" /><Button variant="ghost" size="xs" onClick={() => api.cancelRedirects(p.id).catch(() => {})}>Stop</Button></div><div className="h-[5px] overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand transition-[width]" style={{ width: `${(100 * st.job!.progress.done) / Math.max(1, st.job!.progress.total)}%` }} /></div></div>
        ) : (
          <div className="flex gap-2"><Input value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder={hostOfUrl(p.sites.live) || "client-site.com"} /><Button variant="outline" onClick={runTest} disabled={!testUrl.trim()}><Play />Test {rows.length} URLs</Button></div>
        )}
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">Opens every old URL on that address and follows it. Each redirect should be one 301 to the right page, and URLs kept as they are should still load. The checklist items tick when a test of {hostOfUrl(p.sites.live) || "the live domain"} passes{p.sites.live && hostOfUrl(p.sites.live) === oldHost(p) ? ", from launch day on (before that it still shows the old site)" : ""}.</p>
      </section>
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Show" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {(([["review", "To look at"], ["moves", "Redirects"], ["same", "Kept"], ...(map.test ? [["failed", "Failed"]] : []), ["all", "All"]]) as [Filter, string][]).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => { setFilter(k); setLimit(200) }} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", filter === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}<span className="text-xs font-normal text-muted-foreground tabular">{counts[k]}</span></button>
          ))}
        </div>
        <span className="flex-1" />
        <div className="relative w-64"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a URL" className="h-8 pl-8 text-[13px]" /></div>
      </div>
      {(q || filter === "review") && list.length > 1 && (
        <div className="-mb-2 flex flex-wrap items-center gap-2 text-[13px]">
          {!q && folders.length > 1 ? <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">Mostly in {folders.map(([f, n]) => <button key={f} onClick={() => setQ(f + "/")} className="rounded-full border px-2 py-0.5 text-xs text-foreground/80 hover:bg-muted">{f}/ <span className="text-muted-foreground tabular">{n}</span></button>)}</span>
            : <span className="text-muted-foreground">{list.length} shown</span>}
          <span className="flex-1" />
          <PagePicker map={map} onPick={(to) => change({ to: Object.fromEntries(list.map((r) => [r.from, to])) })} trigger={<Button variant="outline" size="sm" />}>Send all {list.length} to…</PagePicker>
          {list.some((r) => !r.sure) && <Button variant="outline" size="sm" onClick={() => change({ checked: Object.fromEntries(list.filter((r) => !r.sure).map((r) => [r.from, true])) })}><Check />Mark all as right</Button>}
        </div>
      )}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className={cn("grid h-9 items-center gap-3 border-b px-4 text-[12.5px] text-muted-foreground", cols)}><span /><span>Current URL</span><span /><span>New URL</span><span>Match</span><span>Last test</span><span /></div>
        {list.slice(0, limit).map((r) => <Row key={r.from} r={r} res={results[r.from]} map={map} cols={cols} change={change} />)}
        {!list.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">{filter === "review" ? "Every match looks right." : filter === "failed" ? "Nothing failed in the last test." : filter === "moves" ? `No redirects needed. All ${rows.length} URLs stay the same.` : "No URLs in this list."}</p>}
        {list.length > limit && <button onClick={() => setLimit(limit + 300)} className="w-full border-t py-2.5 text-[13px] text-muted-foreground hover:text-foreground">Show {Math.min(300, list.length - limit)} more of {list.length - limit}</button>}
      </section>
      <ExportDialog open={exporting} onClose={() => setExporting(false)} map={map} platform={p.platform} />
    </div>
  )
}

function Row({ r, res, map, cols, change }: { r: RedirectRow; res?: RedirectResult; map: RedirectMap; cols: string; change: (b: { to?: Record<string, string>; checked?: Record<string, boolean> }) => void }) {
  const moving = moves(r)
  return (
    <div className={cn("group grid min-h-12 items-center gap-3 border-b border-border/60 px-4 py-2 last:border-b-0", cols)}>
      {r.sure ? <Check className="size-4 text-muted-foreground/70" /> : <span className="grid size-4 place-items-center rounded-full border-[1.5px] border-foreground/50"><span className="size-1.5 rounded-full bg-foreground/70" /></span>}
      <span className="grid min-w-0 gap-0.5"><span className="truncate text-[13.5px]">{r.from}</span>{r.title && <span className="truncate text-xs text-muted-foreground">{r.title}</span>}</span>
      <ArrowRight className={cn("size-3.5", moving ? "text-muted-foreground" : "text-muted-foreground/30")} />
      <Target r={r} map={map} onPick={(to) => change({ to: { [r.from]: to } })} />
      <span className={cn("text-[12.5px]", r.sure ? "text-muted-foreground" : "text-foreground")}>{HOW[r.how](r)}</span>
      <span className="text-[12.5px]">{res ? (res.ok ? <span className="text-muted-foreground">{moving ? "Redirects" : "Loads"}</span> : <span className="text-destructive" title={res.final ? `Ends at ${res.final} (HTTP ${res.finalStatus})` : undefined}>{PROBLEM[res.problem!]}{res.problem === "wrong" ? `: ${res.final}` : res.problem === "temporary" ? ` (${res.status})` : ""}</span>) : <span className="text-muted-foreground/60">Not tested</span>}</span>
      {!r.sure ? <Button variant="ghost" size="icon-xs" onClick={() => change({ checked: { [r.from]: true } })} aria-label="This match looks right" title="Looks right"><Check /></Button> : <span />}
    </div>
  )
}

/** Where an old URL goes: pick one of the new site's pages, keep the URL, or type a path. */
function Target({ r, map, onPick }: { r: RedirectRow; map: RedirectMap; onPick: (to: string) => void }) {
  const title = map.newPages.find((x) => key(x.path) === key(r.to))?.title
  return (
    <PagePicker map={map} current={r.to} keep={r.from} onPick={onPick} trigger={<button className="grid min-w-0 gap-0.5 rounded-md px-1.5 py-1 text-left hover:bg-muted/70 data-[popup-open]:bg-muted" />}>
      <span className={cn("truncate text-[13.5px]", !moves(r) && "text-muted-foreground")}>{moves(r) ? r.to : "Keeps its URL"}</span>
      {moves(r) && title && <span className="truncate text-xs text-muted-foreground">{title}</span>}
    </PagePicker>
  )
}

function PagePicker({ map, current, keep, onPick, trigger, children }: { map: RedirectMap; current?: string; keep?: string; onPick: (to: string) => void; trigger: React.ReactElement; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const pick = (to: string) => { setOpen(false); setTyped(""); if (!current || key(to) !== key(current)) onPick(to) }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find a page on the new site" value={typed} onValueChange={setTyped} />
          <CommandList className="max-h-72">
            <CommandEmpty>{typed.startsWith("/") ? <button onClick={() => pick(typed)} className="w-full px-2 text-left">Use {typed}</button> : "No page found. Type a path starting with /."}</CommandEmpty>
            {typed.startsWith("/") && !map.newPages.some((x) => key(x.path) === key(typed)) && <CommandGroup><CommandItem value={"use " + typed} onSelect={() => pick(typed)}>Use {typed}</CommandItem></CommandGroup>}
            {keep && <CommandGroup>
              <CommandItem value={"keep " + keep} onSelect={() => pick(keep)}><span className="flex-1">Keep {keep}</span><span className="text-xs text-muted-foreground">no redirect</span></CommandItem>
            </CommandGroup>}
            <CommandGroup heading="Pages on the new site">
              {map.newPages.map((x) => (
                <CommandItem key={x.path} value={x.path + " " + x.title} onSelect={() => pick(x.path)}>
                  <span className="grid min-w-0 flex-1"><span className="truncate">{x.path}</span>{x.title && <span className="truncate text-xs text-muted-foreground">{x.title}</span>}</span>
                  {current && key(x.path) === key(current) && <Check />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ---------- export ----------
// Webflow's import replaces every redirect on the site, so its own export can be merged in first.
function parseCsv(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim())
  const cells = (l: string) => { const out: string[] = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]!; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c } else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = "" } else cur += c } out.push(cur); return out }
  const rows = lines.map(cells).filter((c) => c.length >= 2)
  const header = rows[0] && !/^(\/|https?:)/i.test(rows[0][0]!.trim()) ? lines[0]! : null
  return { header, rows: (header ? rows.slice(1) : rows).map((c) => [c[0]!.trim(), c[1]!.trim()] as [string, string]) }
}

// ---------- folder rules ----------
// When a whole folder moved and kept its slugs (/blog/x to /articles/x), one Webflow rule covers it:
// /blog/(.*) to /articles/%1. Only offered when every old URL in the folder follows it, and nothing on the
// new site lives under the old folder (the rule would catch it).
export interface FolderRule { from: string; to: string; oldPrefix: string; newPrefix: string; rows: string[] }
const parent = (p: string) => p.split("/").slice(0, -1).join("/")
const last = (p: string) => p.split("/").pop() || ""
export function folderRules(map: RedirectMap): FolderRule[] {
  const groups = new Map<string, { oldPrefix: string; newPrefix: string; rows: string[] }>()
  for (const r of map.rows) {
    if (!moves(r)) continue
    const op = parent(r.from), np = parent(r.to)
    if (!op || !np || key(op) === key(np) || key(last(r.from)) !== key(last(r.to))) continue
    const k = key(op) + "→" + key(np)
    if (!groups.has(k)) groups.set(k, { oldPrefix: op, newPrefix: np, rows: [] })
    groups.get(k)!.rows.push(r.from)
  }
  const out: FolderRule[] = []
  for (const g of groups.values()) {
    if (g.rows.length < 3) continue
    const pre = key(g.oldPrefix) + "/"
    const inside = map.rows.filter((r) => key(r.from).startsWith(pre))
    const follows = (r: RedirectRow) => key(r.to) === key(g.newPrefix + r.from.slice(g.oldPrefix.length))
    if (!inside.every(follows)) continue
    if (map.newPages.some((x) => key(x.path).startsWith(pre))) continue
    out.push({ ...g, from: g.oldPrefix + "/(.*)", to: g.newPrefix + "/%1", rows: inside.map((r) => r.from) })
  }
  return out.sort((a, b) => b.rows.length - a.rows.length)
}

function ExportDialog({ open, onClose, map, platform }: { open: boolean; onClose: () => void; map: RedirectMap; platform: string | null }) {
  const [format, setFormat] = React.useState<RedirectFormat>(formatsFor(platform)[0]!)
  const [existing, setExisting] = React.useState<{ name: string; header: string | null; rows: [string, string][] } | null>(null)
  const rules = React.useMemo(() => folderRules(map), [map])
  const [useRules, setUseRules] = React.useState<Record<string, boolean>>({})
  React.useEffect(() => { if (open) { setFormat(formatsFor(platform)[0]!); setExisting(null); setUseRules(Object.fromEntries(rules.map((r) => [r.from, true]))) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const info = FORMATS[format]
  const ours = map.rows.filter(moves)
  const review = ours.filter((r) => !r.sure).length
  // Folder rules only where the format has patterns; otherwise every page gets its own line.
  const on = info.rules ? rules.filter((r) => useRules[r.from]) : []
  const covered = new Set(on.flatMap((r) => r.rows.map(key)))
  const lines = ours.filter((r) => !covered.has(key(r.from)))
  const pairs = () => {
    const out = new Map<string, [string, string]>()
    if (info.replaces) for (const [a, b] of existing?.rows || []) out.set(key(a), [a, b])
    for (const r of lines) out.set(key(r.from), [r.from, r.to])
    return [...out.values()]
  }
  const text = () => renderRedirects(format, pairs(), on, info.replaces ? existing?.header : null)
  const kept = info.replaces && existing ? existing.rows.filter(([a]) => !lines.some((r) => key(r.from) === key(a)) && !on.some((r) => key(r.from) === key(a))).length : 0
  const fileName = format === "netlify" || format === "vercel" ? info.file : `${map.oldHost.replace(/\W+/g, "-")}-${info.file}`
  const download = () => {
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([text()], { type: info.mime }))
    a.download = fileName
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const pickFile = (f?: File) => { if (!f) return; f.text().then((t) => { const x = parseCsv(t); setExisting({ name: f.name, ...x }); if (!x.rows.length) toast.error("That file has no redirects in it.") }) }
  const own = formatsFor(platform), mine = own.slice(0, platformOf(platform)?.redirects.length || 1)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[580px]">
        <DialogHeader className="px-6 pt-6"><DialogTitle>Export redirects</DialogTitle><DialogDescription>The old and new paths, in the format your platform imports.</DialogDescription></DialogHeader>
        <div className="scrollbar-thin grid max-h-[68vh] gap-4 overflow-auto px-6 py-5 text-[13.5px]">
          <label className="grid gap-1.5 text-[13px] font-medium">Format
            <select value={format} onChange={(e) => setFormat(e.target.value as RedirectFormat)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-[13.5px] font-normal">
              <optgroup label={platformOf(platform) ? `For ${platformOf(platform)!.name}` : "Suggested"}>{mine.map((f) => <option key={f} value={f}>{FORMATS[f].name}</option>)}</optgroup>
              <optgroup label="Other platforms and servers">{own.slice(mine.length).map((f) => <option key={f} value={f}>{FORMATS[f].name}</option>)}</optgroup>
            </select>
          </label>
          <div className="grid gap-1 rounded-lg bg-muted/60 px-3.5 py-3">
            <span><b className="font-medium tabular">{lines.length + on.length}</b> {lines.length + on.length === 1 ? "line" : "lines"} for {ours.length} {ours.length === 1 ? "redirect" : "redirects"}{on.length ? `, ${on.length} of them ${on.length === 1 ? "a folder rule" : "folder rules"}` : ""}{kept ? <>, plus <b className="font-medium tabular">{kept}</b> already on the site</> : ""}</span>
            {review > 0 && <span className="text-[12.5px] text-foreground">{review} {review === 1 ? "match still needs" : "matches still need"} a look. They’re included as they are.</span>}
            {info.note && <span className="text-[12.5px] text-muted-foreground">{info.note}</span>}
          </div>
          {info.rules && rules.length > 0 && (
            <div className="grid gap-1.5">
              <span className="font-medium">Folder rules</span>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">These folders moved with every page keeping its slug, so one rule replaces a line per page. It also catches old URLs the scan didn’t find.</p>
              <div className="overflow-hidden rounded-[10px] border bg-card">
                {rules.map((r) => (
                  <label key={r.from} className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                    <Checkbox checked={!!useRules[r.from]} onCheckedChange={(v) => setUseRules((x) => ({ ...x, [r.from]: !!v }))} />
                    <span className="min-w-0 truncate text-[13px]">{r.oldPrefix}/… <ArrowRight className="inline size-3 text-muted-foreground" /> {r.newPrefix}/…</span>
                    <span className="text-xs text-muted-foreground tabular">replaces {r.rows.length}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {info.replaces && (
            <div className="grid gap-1.5">
              <span className="font-medium">Redirects already on the site</span>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">Webflow’s import replaces every redirect on the site. If it already has some, export them in Webflow first (Site settings, Publishing, 301 redirects, Export) and add that file here, so they’re kept.</p>
              <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]) }} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-dashed bg-card px-3 py-2.5 text-[12.5px] text-muted-foreground">
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                {existing ? <span className="text-foreground">{existing.name}: {existing.rows.length} redirects</span> : "Drop Webflow’s export here, or click to choose"}
              </label>
            </div>
          )}
          <ol className="grid list-decimal gap-1 pl-5 text-[12.5px] text-muted-foreground">{info.how.map((h) => <li key={h}>{h}</li>)}</ol>
        </div>
        <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <Button variant="ghost" className="mr-auto" onClick={() => { navigator.clipboard.writeText(text()); toast("Copied the redirects") }}><Copy />Copy</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={download}><Download />Download {fileName.startsWith(".") || fileName === "_redirects" ? fileName : fileName.split(".").pop()?.toUpperCase()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
