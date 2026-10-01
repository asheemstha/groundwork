import * as React from "react"
import { cn } from "cn"
import { ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useApp } from "@/hooks/useApp"
import { api, type LaunchCheckId, type LaunchReport, type Project, type SiteKey } from "@/lib/api"
import { SITE_KEYS, SITE_NAME, fmtDay, hostOfUrl, subName } from "@/lib/project"
import { ago } from "@/lib/format"
import { go, routes } from "@/lib/router"
import { platformOf } from "@/lib/platforms"
import { LATER, Progress, SpeedOption, defaultUrl, startLaunch, useLaunch, useSpeedOption } from "@/components/project/LaunchCheck"
import { RedirectCard } from "@/components/project/Redirects"
import { InventoryCard } from "@/components/project/Inventory"
import { TrafficCard } from "@/components/project/Traffic"

type Run = Project["tools"]["runs"][number]
const DONE = (s?: string | null) => s === "done" || s === "partial"
// The checks by the short names a person would use.
const SHORT: Record<LaunchCheckId, string> = { indexing: "Search engines", placeholders: "Placeholders", links: "Links", seo: "SEO basics", a11y: "Accessibility", speed: "Speed on a phone", tracking: "Tracking", canonicals: "Canonicals", legal: "Legal pages", https: "https and www" }
const day = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" })
const weekday = (t: number) => new Date(t).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
// "6 of 10": the checks that count on that site (on staging, the two that wait for the live domain don't).
const tally = (h: Project["tools"]["launchHistory"][number]) => { const ids = (Object.keys(h.checks) as LaunchCheckId[]).filter((id) => !(h.staging && LATER.includes(id))); return `${ids.filter((id) => h.checks[id]!.ok).length} of ${ids.length}` }

/** Which of the project's sites the tab opens on: the one the launch check would use, else the first there is. */
function firstSite(p: Project): SiteKey | null {
  const keys = (p.kind === "audit" ? (["live"] as SiteKey[]) : SITE_KEYS).filter((k) => p.sites[k])
  const want = defaultUrl(p)
  return keys.find((k) => hostOfUrl(p.sites[k]) === hostOfUrl(want)) || keys[0] || null
}

/**
 * The Site tab: a website's problems first, then one timeline of its scans and checks. On a redesign, "Moving from
 * the old site" holds the content inventory, the redirect map and search traffic.
 */
export function SiteTab({ p, setP, reload, onEdit, view }: { p: Project; setP: (x: Project) => void; reload: () => void; onEdit: () => void; view?: string }) {
  const audit = p.kind === "audit"
  const redesign = !audit && !!p.sites.old
  const moving = redesign && view === "moving"
  return (
    <div className="grid max-w-[920px] gap-6 px-12 pt-6 pb-12">
      {redesign && (
        <div role="group" aria-label="Site" className="flex w-fit gap-0.5 rounded-lg bg-muted p-0.5">
          {([["checks", "Checks"], ["moving", "Moving from the old site"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={(k === "moving") === moving} onClick={() => go(k === "moving" ? routes.site(p.id, "moving") : routes.site(p.id))} className={cn("h-7 rounded-md px-3 text-[13px]", (k === "moving") === moving ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
      )}
      {moving ? <Moving p={p} setP={setP} onEdit={onEdit} reload={reload} /> : <Checks p={p} setP={setP} reload={reload} onEdit={onEdit} />}
    </div>
  )
}

function Checks({ p, setP, reload, onEdit }: { p: Project; setP: (x: Project) => void; reload: () => void; onEdit: () => void }) {
  const { status, refreshRuns } = useApp()
  const audit = p.kind === "audit"
  const keys = (audit ? (["live"] as SiteKey[]) : SITE_KEYS).filter((k) => p.sites[k])
  const [site, setSite] = React.useState<SiteKey | null>(() => firstSite(p))
  const [speed, setSpeed] = useSpeedOption()
  const [busy, setBusy] = React.useState<"check" | "scan" | null>(null)
  const [plans, setPlans] = React.useState(false)
  // A project with no addresses saved can still have checks of an address typed in.
  const url = site ? p.sites[site] || "" : p.tools.launchHistory[0]?.url || ""
  const host = hostOfUrl(url)
  const checks = p.tools.launchHistory.filter((h) => hostOfUrl(h.url) === host)
  const last = checks.find((h) => h.status === "done")
  const running = p.tools.launchRunning
  const { r: live } = useLaunch(p, running?.id, reload)
  const [report, setReport] = React.useState<LaunchReport | null>(null)
  React.useEffect(() => { setReport(null); if (last) api.launch(p.id, last.id).then(setReport).catch(() => {}) }, [p.id, last?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const runs = p.tools.runs.filter((r) => r.site === site)
  const scanning = runs.find((r) => r.status === "scanning")
  const later = (id: LaunchCheckId) => !!last?.staging && LATER.includes(id)
  const counted = last ? (Object.keys(last.checks) as LaunchCheckId[]).filter((id) => !later(id)) : []
  const failing = counted.filter((id) => !last!.checks[id]!.ok)
  const waiting = last ? (Object.keys(last.checks) as LaunchCheckId[]).filter(later).length : 0
  // A same-domain redesign: the live domain shows the old site until launch day.
  const liveIsOld = site === "live" && !!p.sites.old && hostOfUrl(p.sites.old) === host && !p.launched
  const check = async () => { setBusy("check"); await startLaunch(p, url, reload, speed); setBusy(null) }
  const scan = async () => {
    if (!site) return
    setBusy("scan")
    try { const { runId } = await api.scanProject(p.id, site); await refreshRuns(); reload(); go(routes.run(runId)) } catch (e) { toast.error((e as Error).message); setBusy(null) }
  }
  if (!url) return (
    <div className="grid gap-2 py-6">
      <h1 className="text-[22px] font-medium">No website yet</h1>
      <p className="text-[14px] text-muted-foreground">Add the staging address, the live domain or the old site, and Groundwork can scan and check it.</p>
      <div><Button size="sm" variant="outline" onClick={onEdit}>Add a website</Button></div>
    </div>
  )
  // Scans, launch checks and after-launch checks of this site, newest first.
  const timeline = [
    ...checks.map((h) => ({ at: h.at, key: "c" + h.id, text: h.status === "cancelled" ? "Launch check stopped" : h.status === "failed" ? "Launch check didn’t finish" : `${h.watch ? `Day ${h.watch} after launch` : h.oldSite ? "Check of the old site" : "Launch check"}: ${tally(h)} passed`, bad: h.status !== "done", open: () => go(routes.launch(p.id, h.id)) })),
    ...runs.filter((r) => r.status !== "scanning").map((r) => ({ at: r.created, key: "r" + r.id, text: r.status === "scan_failed" ? `Scan stopped: ${r.error || "the site didn’t load"}` : `Scan: ${plural(r.pages, "page", "pages")}${DONE(r.status) ? ", with a heading plan" : ""}`, bad: r.status === "scan_failed", open: () => go(routes.run(r.id)) })),
  ].sort((a, b) => b.at - a.at).slice(0, 10)
  const rn = site === "live" ? p.renewals : null
  const engine = status?.engines.claude.loggedIn || status?.engines.codex.loggedIn
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {keys.length > 1 && (
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">Website
            <select value={site || ""} onChange={(e) => setSite(e.target.value as SiteKey)} className="h-8 rounded-lg border border-input bg-card px-2 text-[13px] text-foreground">
              {keys.map((k) => <option key={k} value={k}>{SITE_NAME[k]}, {hostOfUrl(p.sites[k])}</option>)}
            </select>
          </label>
        )}
        {!keys.length && <span className="text-[13px] text-muted-foreground"><a href={url} target="_blank" rel="noreferrer" className="text-foreground hover:underline">{host}</a>, not saved to the project yet</span>}
        {keys.length === 1 && <span className="text-[13px] text-muted-foreground">{audit ? "" : `${SITE_NAME[keys[0]]}, `}<a href={url} target="_blank" rel="noreferrer" className="text-foreground hover:underline">{host}</a></span>}
        <span className="flex-1" />
        <button onClick={onEdit} className="text-[12.5px] text-muted-foreground hover:text-foreground">Edit addresses</button>
        {!audit && !p.repeat && !p.launched && !p.closed && <Button size="sm" onClick={() => go(routes.markLaunched(p.id))}>Mark launched</Button>}
      </div>

      {liveIsOld ? (
        <div className="grid gap-1.5">
          <h1 className="text-[22px] font-medium">The old site is still here</h1>
          <p className="text-[14px] text-muted-foreground">{host} is the same address as the old site, so it shows the old site until launch day{p.launch ? ` (${fmtDay(p.launch)})` : ""}. Check staging until then, and this address from launch day.</p>
        </div>
      ) : running && live?.status === "running" && hostOfUrl(live.url || "") === host ? (
        <div className="grid gap-3">
          <h1 className="text-[22px] font-medium">Checking {host}</h1>
          <button onClick={() => go(routes.launch(p.id, running.id))} className="rounded-xl border bg-card px-4 py-3.5 text-left"><Progress r={live} /></button>
          <div><Button size="sm" variant="outline" onClick={() => api.cancelLaunch(p.id, running.id).catch(() => {})}>Stop</Button></div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <h1 className="text-[22px] font-medium">{!last ? "Not checked yet" : failing.length ? `${plural(failing.length, "check needs", "checks need")} fixing` : "Every check passed"}</h1>
            <p className="text-[14px] text-muted-foreground">
              {!last ? `The launch check reads ${host} the way Google and a visitor would: search engines, placeholders, links, SEO basics, accessibility, speed on a phone, tracking, canonicals, legal pages and redirects. About 3 minutes, on your Mac, with no AI.`
                : <>{last.staging ? "Staging" : last.watch ? `Day ${last.watch} after launch` : site ? SITE_NAME[site] : host}, checked {weekday(last.at)}. <button onClick={() => go(routes.launch(p.id, last.id))} className="underline underline-offset-2 hover:text-foreground">{counted.length - failing.length} passed</button>{waiting ? `, and ${waiting} wait for the live domain` : ""}.</>}
            </p>
          </div>
          {failing.length > 0 && (
            <div className="grid border-t">
              {failing.map((id) => {
                const c = report?.checks?.find((x) => x.id === id), hard = (c?.issues || []).filter((i) => !i.soft)
                const n = last!.checks[id]!.count || hard.length
                return (
                  <button key={id} onClick={() => go(routes.launch(p.id, last!.id, id))} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-3 border-b px-1 py-2 text-left hover:bg-muted/30">
                    <span className="grid min-w-0 gap-0.5"><span className="text-[14px]">{SHORT[id]}: {plural(n, "problem", "problems")}</span>{hard.length > 0 && <span className="truncate text-[13px] text-muted-foreground">{hard.slice(0, 2).map((i) => i.text).join(", ")}</span>}</span>
                    <span className="text-[13px] text-destructive">{p.launched ? "Fix now" : "Fix before launch"}</span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant={last ? "outline" : "default"} onClick={check} disabled={!!busy || !!running}>{busy === "check" && <Loader2 className="animate-spin" />}{last ? "Check again" : "Run the launch check"}</Button>
            {scanning ? <Button size="sm" variant="ghost" onClick={() => go(routes.run(scanning.id))}><Loader2 className="animate-spin" />Scanning</Button>
              : <Button size="sm" variant="ghost" onClick={scan} disabled={!!busy}>{busy === "scan" && <Loader2 className="animate-spin" />}{runs.some((r) => r.pages > 0) ? "Scan again" : "Scan the pages"}</Button>}
            <SpeedOption speed={speed} setSpeed={setSpeed} />
          </div>
        </div>
      )}

      {timeline.length > 0 && (
        <section className="grid gap-0.5 border-t pt-3">
          <h2 className="mb-1 text-[13px] font-medium text-muted-foreground">Earlier</h2>
          {timeline.map((x) => (
            <button key={x.key} onClick={x.open} className="grid min-h-8 grid-cols-[70px_minmax(0,1fr)] items-center gap-3 rounded-md px-1 text-left text-[13.5px] hover:bg-muted/30">
              <span className="text-muted-foreground">{day(x.at)}</span><span className={cn("truncate", x.bad && "text-destructive")}>{x.text}</span>
            </button>
          ))}
        </section>
      )}

      <section className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
        {platformOf(p.platform) && <span>Built with {platformOf(p.platform)!.name}</span>}
        {rn && !rn.ssl.error && rn.ssl.expires && <span className={cn(rn.warnings.some((w) => w.what === "ssl" && w.late) && "text-destructive")}>SSL {rn.ssl.auto || rn.hosted ? "renews itself, next" : "runs out"} {fmtDay(rn.ssl.expires)}</span>}
        {rn && rn.domain.expires && <span className={cn(rn.warnings.some((w) => w.what === "domain" && w.late) && "text-destructive")}>Domain renews by {new Date(rn.domain.expires + "T00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>}
        {site === "live" && p.uptime && <span className={cn(!p.uptime.last.ok && "text-destructive")}>{p.uptime.last.ok ? `Answered ${ago(p.uptime.last.at)}` : `Didn’t answer ${ago(p.uptime.last.at)}`}{p.uptime.down.length ? `, ${p.uptime.down.length} of ${p.uptime.checks} hourly checks failed in 30 days` : ""}</span>}
        {!audit && <button onClick={() => setPlans(!plans)} className="underline-offset-2 hover:text-foreground hover:underline">{plans ? "Hide" : "Optional:"} AI heading and SEO plans</button>}
      </section>
      {plans && site && (
        <section className="grid gap-2">
          {engine ? <div className="rounded-xl border bg-card"><SiteTools p={p} k={site} /></div>
            : <p className="text-[13.5px] text-muted-foreground">The heading and SEO plans use your own Claude Code or Codex. <button onClick={() => go(routes.settings("claude"))} className="underline underline-offset-2 hover:text-foreground">Set one up in Settings</button> to use them; everything else works without AI.</p>}
          {engine && <p className="text-[12.5px] text-muted-foreground">Optional. They use your {subName(status)} subscription, and you review every change before it goes in.</p>}
        </section>
      )}
      {!p.sites.old && !audit && <TrafficCard p={p} setP={setP} />}
    </>
  )
}

/** On a redesign: the old site's scan, then the content inventory, the redirect map and search traffic, in order. */
function Moving({ p, setP, onEdit, reload }: { p: Project; setP: (x: Project) => void; onEdit: () => void; reload: () => void }) {
  const { refreshRuns } = useApp()
  const [busy, setBusy] = React.useState(false)
  const old = p.tools.oldScan
  const scanning = p.tools.runs.find((r) => r.site === "old" && r.status === "scanning")
  const scan = async () => { setBusy(true); try { const { runId } = await api.scanProject(p.id, "old"); await refreshRuns(); reload(); go(routes.run(runId)) } catch (e) { toast.error((e as Error).message); setBusy(false) } }
  const step = (n: number, title: string) => <h2 className="mt-2 flex items-baseline gap-2 text-[13px] font-medium text-muted-foreground"><span className="tabular">{n}.</span>{title}</h2>
  return (
    <>
      <div className="grid gap-1.5">
        <h1 className="text-[22px] font-medium">Moving from {hostOfUrl(p.sites.old)}</h1>
        <p className="text-[14px] text-muted-foreground">Keep the old site’s pages, links and search traffic: decide what happens to each page, map every old address to a new one, and test the redirects after launch.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[13.5px]">
        <span className="text-muted-foreground">{scanning ? "Scanning the old site now." : old ? `Old site scanned ${ago(old.at)}: ${plural(old.urls, "address", "addresses")}.` : "Scan the old site first: everything here starts from its list of pages."}</span>
        {scanning ? <Button size="sm" variant="outline" onClick={() => go(routes.run(scanning.id))}><Loader2 className="animate-spin" />Scanning</Button>
          : <Button size="sm" variant={old ? "ghost" : "default"} onClick={scan} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{old ? "Scan again" : "Scan the old site"}</Button>}
      </div>
      {step(1, "Content inventory")}
      <InventoryCard p={p} />
      {step(2, "Redirect map, tests and before and after")}
      <RedirectCard p={p} onEdit={onEdit} />
      {step(3, "Search traffic")}
      <TrafficCard p={p} setP={setP} />
    </>
  )
}

/** A site's scan and the heading and SEO plans made from its scans. */
function SiteTools({ p, k }: { p: Project; k: SiteKey }) {
  const runs = p.tools.runs.filter((r) => r.site === k)
  const scan = runs.find((r) => r.pages > 0 && r.status !== "scanning" && r.status !== "scan_failed")
  const heading = runs.find((r) => DONE(r.status) || r.status === "running")
  const seo = runs.find((r) => r.seo && (DONE(r.seo.status) || r.seo.status === "running"))
  const date = (r: Run) => day(r.created)
  const counts = (r: Run) => { const c = r.progress?.now || r.progress?.all || r.progress?.live; return c ? `${c.done} of ${c.tasks} tag fixes done` : "Ready" }
  const Row = ({ name, status, children }: { name: string; status: React.ReactNode; children?: React.ReactNode }) => (
    <div className="grid min-h-11 grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 border-t px-4 text-[13.5px] first:border-t-0">
      <span className="text-muted-foreground">{name}</span>
      <span className="min-w-0 truncate text-muted-foreground">{status}</span>
      <span className="flex items-center gap-1.5">{children}</span>
    </div>
  )
  return (
    <>
      <Row name="Heading plan" status={heading ? <>{heading.status === "running" ? "Planning now" : counts(heading)}{scan && heading.id !== scan.id ? `, from the ${date(heading)} scan` : ""}</> : scan ? "Not planned yet" : "Scan first"}>
        {heading && <Button size="xs" variant="ghost" onClick={() => go(heading.status === "running" ? routes.run(heading.id, "headings") : routes.review(heading.id))}>Open</Button>}
        {scan && (!heading || heading.id !== scan.id) && <Button size="xs" variant="outline" onClick={() => go(routes.run(scan.id, "headings"))}>{heading ? "Plan the latest scan" : "Plan headings"}</Button>}
      </Row>
      <Row name="SEO plan" status={seo ? <>{seo.seo!.status === "running" ? "Planning now" : seo.seo!.progress ? `${seo.seo!.progress.done} of ${seo.seo!.progress.tasks} changes done` : "Ready"}{scan && seo.id !== scan.id ? `, from the ${date(seo)} scan` : ""}</> : scan ? "Not planned yet" : "Scan first"}>
        {seo && <Button size="xs" variant="ghost" onClick={() => go(seo.seo!.status === "running" ? routes.run(seo.id, "seo") : routes.seo(seo.id))}>Open</Button>}
        {scan && (!seo || seo.id !== scan.id) && <Button size="xs" variant="outline" onClick={() => go(routes.run(scan.id, "seo"))}>{seo ? "Plan the latest scan" : "Plan SEO"}</Button>}
      </Row>
    </>
  )
}
