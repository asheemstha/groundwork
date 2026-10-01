import * as React from "react"
import { cn } from "cn"
import { ChevronDown, ChevronRight, Copy, ExternalLink, Info, Loader2, Play, RotateCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/common/bits"
import { ToolCard } from "@/components/project/ToolCard"
import { useApp } from "@/hooks/useApp"
import { Checkbox } from "@/components/ui/checkbox"
import { api, type LaunchCheck, type LaunchCheckId, type LaunchIssue, type LaunchReport, type LaunchSummary, type PItem, type Project, type Rating, type SpeedResult, type TrackingInfo } from "@/lib/api"
import { store } from "@/lib/store"
import { go, routes } from "@/lib/router"
import { hostOfUrl, today } from "@/lib/project"
import { stagingExample } from "@/lib/platforms"
import { CloudflareHelp, isCloudflare } from "@/components/common/CloudflareHelp"

const ORDER: LaunchCheckId[] = ["indexing", "placeholders", "links", "seo", "a11y", "speed", "tracking", "canonicals", "legal", "https"]
const STEPS = [
  { id: "site", label: "robots.txt, sitemap and redirects" },
  { id: "pages", label: "Opening pages and checking accessibility" },
  { id: "links", label: "Testing links" },
  { id: "tracking", label: "Tags and cookie consent" },
  { id: "speed", label: "Speed test of three key pages on a phone" },
] as const
/** Whether the next check runs the speed test. It adds a minute or two, so quick re-runs can skip it. */
const useSpeedOption = () => {
  const [speed, set] = React.useState(() => store.get("launchSpeed", true))
  return [speed, (v: boolean) => { store.set("launchSpeed", v); set(v) }] as const
}
function SpeedOption({ speed, setSpeed }: { speed: boolean; setSpeed: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Checkbox checked={speed} onCheckedChange={(v) => setSpeed(!!v)} />Include the speed test (adds a minute or two; without it, the last result is kept)</label>
}

const when = (at: number) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const day = (at: number) => new Date(at).toLocaleDateString([], { month: "short", day: "numeric" })
const hostOf = (u: string) => { try { return new URL(/^https?:/i.test(u) ? u : "https://" + u).hostname } catch { return u } }
/** On staging, indexing and redirects are meant to fail, so they wait for a check of the live domain. */
const LATER: LaunchCheckId[] = ["indexing", "https"]
const counted = (s: Pick<LaunchSummary, "checks" | "staging">) => (Object.entries(s.checks) as [LaunchCheckId, { ok: boolean }][]).filter(([id]) => !(s.staging && LATER.includes(id)))
const passed = (s: Pick<LaunchSummary, "checks" | "staging">) => counted(s).filter(([, c]) => c.ok).length
const total = (s: Pick<LaunchSummary, "checks" | "staging">) => counted(s).length
const itemsOf = (p: Project) => p.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items])
/**
 * The address to check next. Before launch day that's staging; from launch day on, the live domain. In a same-domain
 * redesign the live domain still shows the old site before launch, so it isn't offered then.
 */
const defaultUrl = (p: Project) => {
  const launched = !!p.launch && today() >= p.launch
  const liveIsOld = !!p.sites.old && !!p.sites.live && hostOfUrl(p.sites.old) === hostOfUrl(p.sites.live) && !launched
  const live = liveIsOld ? null : p.sites.live
  return (launched ? live || p.sites.staging : p.sites.staging || live) || p.tools.launchHistory.find((h) => !h.oldSite)?.url || ""
}
const where = (h: { staging?: boolean; oldSite?: boolean; watch?: number | null }) => (h.oldSite ? ", old site" : h.staging ? ", staging" : h.watch ? `, day ${h.watch} after launch` : "")

/** Follows a running check until it finishes, then reloads the project so the checklist picks it up. */
export function useLaunch(p: Project, checkId: string | undefined, reload: () => void) {
  const [r, setR] = React.useState<LaunchReport | null>(null)
  const [missing, setMissing] = React.useState(false)
  React.useEffect(() => {
    setR(null); setMissing(false)
    if (!checkId) return
    let stop = false, timer = 0, ran = false
    const tick = async () => {
      try {
        const x = await api.launch(p.id, checkId)
        if (stop) return
        setR(x)
        if (x.status === "running") { ran = true; timer = window.setTimeout(tick, 1000) }
        else if (ran) reload()
      } catch { if (!stop) setMissing(true) }
    }
    tick()
    return () => { stop = true; clearTimeout(timer) }
  }, [p.id, checkId]) // eslint-disable-line react-hooks/exhaustive-deps
  return { r, missing }
}

export async function startLaunch(p: Project, url: string, reload: () => void, speed = store.get("launchSpeed", true)) {
  try {
    const { checkId } = await api.startLaunch(p.id, url.trim() || undefined, speed)
    reload()
    go(routes.launch(p.id, checkId))
  } catch (e) { toast.error((e as Error).message) }
}

function CheckMark({ ok, size = 18 }: { ok: boolean; size?: number }) {
  return ok
    ? <svg width={size} height={size} viewBox="0 0 18 18" className="shrink-0"><circle cx="9" cy="9" r="8.5" className="fill-done" /><path d="m5.5 9.2 2.3 2.3 4.7-4.7" fill="none" className="stroke-background" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg width={size} height={size} viewBox="0 0 18 18" className="shrink-0"><circle cx="9" cy="9" r="7.75" fill="none" className="stroke-destructive/70" strokeWidth="1.5" /><path d="M9 5.2v4.6" className="stroke-destructive" strokeWidth="1.7" strokeLinecap="round" /><circle cx="9" cy="12.4" r="1" className="fill-destructive" /></svg>
}

const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }
function Progress({ r }: { r: LaunchReport }) {
  const steps = STEPS.filter((s) => s.id !== "speed" || r.speed !== false)
  const at = steps.findIndex((s) => s.id === r.progress.step)
  const { done, total: all, times = {}, stepAt } = r.progress
  // Re-render every second so the running step's timer moves.
  const [, tick] = React.useState(0)
  React.useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  return (
    <div className="grid gap-2.5">
      {steps.map((s, i) => (
        <div key={s.id} className="grid grid-cols-[18px_minmax(0,1fr)_110px_44px] items-center gap-3 text-[13.5px]">
          {i < at ? <CheckMark ok size={16} /> : i === at ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <span className="size-4 rounded-full border border-dashed border-input" />}
          <span className={cn(i > at && "text-muted-foreground")}>{s.label}</span>
          <span className="text-right text-[12.5px] text-muted-foreground tabular">{i === at && all ? `${done} of ${all}` : ""}</span>
          <span className="text-right text-[12.5px] text-muted-foreground tabular">{i < at && times[s.id] != null ? clock(times[s.id]!) : i === at && stepAt ? clock(Date.now() - stepAt) : ""}</span>
        </div>
      ))}
      {at > 0 && all > 0 && <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand transition-[width]" style={{ width: `${(100 * done) / all}%` }} /></div>}
    </div>
  )
}

// ---------- Tools tab card ----------
export function LaunchCard({ p, reload }: { p: Project; reload: () => void }) {
  const [url, setUrl] = React.useState(defaultUrl(p))
  const [speed, setSpeed] = useSpeedOption()
  const [busy, setBusy] = React.useState(false)
  const running = p.tools.launchRunning
  const { r } = useLaunch(p, running?.id, reload)
  const last = p.tools.launch
  const history = p.tools.launchHistory
  const fails = last ? Object.entries(last.checks).filter(([id, c]) => !c!.ok && !(last.staging && LATER.includes(id as LaunchCheckId))).length : 0
  return (
    <ToolCard
      title="Launch check" cost="runs on your Mac, no AI"
      status={running ? "Checking now." : last ? <>Last check {day(last.at)}{last.staging ? " on staging" : ""}: {fails ? `${fails} ${fails === 1 ? "check needs" : "checks need"} fixing` : "ready"}. <button onClick={() => go(routes.launch(p.id, last.id))} className="text-foreground/80 underline underline-offset-2 hover:text-foreground">Open the report</button></> : "Reads the site the way Google and a visitor would: noindex, placeholder text, broken links, titles, accessibility, speed on a phone, analytics tags and cookie consent, canonicals, legal pages and redirects. Use staging before launch and the live domain after. After launch, Groundwork checks the live site again on days 3, 7 and 30 while the app is open."}
      action={running ? <Button size="sm" variant="outline" onClick={() => api.cancelLaunch(p.id, running.id).catch(() => {})}>Stop</Button> : <Button size="sm" variant="outline" onClick={async () => { setBusy(true); await startLaunch(p, url, reload, speed); setBusy(false) }} disabled={busy || !url.trim()}>{busy && <Loader2 className="animate-spin" />}{last ? "Run again" : "Run the check"}</Button>}
    >
      {running && r?.status === "running" ? (
        <button onClick={() => go(routes.launch(p.id, running.id))} className="rounded-lg bg-muted/50 px-3.5 py-3 text-left"><Progress r={r} /></button>
      ) : (
        <div className="grid gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={stagingExample(p.platform)} className="h-8" /><SpeedOption speed={speed} setSpeed={setSpeed} /></div>
      )}
      {history.length > 1 && (
        <div className="grid">
          {history.slice(0, 4).map((h) => (
            <button key={h.id} onClick={() => go(routes.launch(p.id, h.id))} className="grid h-9 grid-cols-[minmax(0,1fr)_110px_90px_120px] items-center gap-3 border-t text-left text-[13px] hover:bg-muted/30">
              <span className="truncate">{hostOf(h.url)}<span className="text-muted-foreground">{where(h)}</span></span>
              <span className={cn("tabular", h.status !== "done" ? "text-muted-foreground" : passed(h) === total(h) ? "text-muted-foreground" : "")}>{h.status === "cancelled" ? "Stopped" : h.status === "failed" ? "Didn’t finish" : `${passed(h)} of ${total(h)} pass`}</span>
              <span className="text-muted-foreground tabular">{h.pages} pages</span>
              <span className="text-right text-muted-foreground">{when(h.at)}</span>
            </button>
          ))}
        </div>
      )}
    </ToolCard>
  )
}

// ---------- the report ----------
export function LaunchReportPage({ p, sub, reload }: { p: Project; sub?: string; reload: () => void }) {
  const [idPart, focus] = (sub || "").split("?") as [string, LaunchCheckId | undefined]
  const checkId = idPart || p.tools.launchRunning?.id || p.tools.launchHistory[0]?.id
  const { r, missing } = useLaunch(p, checkId, reload)
  const [url, setUrl] = React.useState(defaultUrl(p))
  const [busy, setBusy] = React.useState(false)
  const [speed, setSpeed] = useSpeedOption()
  const run = async (u: string) => { setBusy(true); await startLaunch(p, u, reload, speed); setBusy(false) }
  const head = null

  if (!checkId || missing) return (
    <div className="grid mx-auto w-full max-w-4xl gap-5 px-12 pt-8 pb-10">
      {head}
      <div><h1 className="text-[24px] leading-tight font-medium">Launch check</h1><p className="mt-1.5 text-sm text-muted-foreground">{missing ? "That report isn’t on this Mac any more." : `Not run for ${p.name} yet.`} Use the staging address before launch and the live one after.</p></div>
      <div className="flex gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={stagingExample(p.platform)} /><Button onClick={() => run(url)} disabled={busy || !url.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Play />}Run the check</Button></div>
      <SpeedOption speed={speed} setSpeed={setSpeed} />
    </div>
  )
  if (!r) return <div className="grid h-full place-items-center py-24"><Spinner /></div>

  if (r.status === "running") return (
    <div className="grid mx-auto w-full max-w-4xl gap-5 px-12 pt-8 pb-10">
      {head}
      <div className="flex items-start gap-3">
        <div className="flex-1"><h1 className="text-[24px] leading-tight font-medium">Checking {hostOf(r.url)}</h1><p className="mt-1.5 text-sm text-muted-foreground">Up to 60 pages, then every link on them{r.speed !== false ? ", then a speed test of three key pages" : ""}. It usually takes {r.speed !== false ? "three to five minutes" : "a minute or two"}. You can leave this page, the check keeps going.</p></div>
        <Button variant="outline" size="sm" onClick={() => api.cancelLaunch(p.id, r.id).then(() => toast("Stopping the check…")).catch(() => {})}>Stop</Button>
      </div>
      <section className="rounded-xl border bg-card p-4"><Progress r={r} /></section>
    </div>
  )

  if (r.status === "failed" || r.status === "cancelled") return (
    <div className="grid mx-auto w-full max-w-4xl gap-5 px-12 pt-8 pb-10">
      {head}
      <div><h1 className="text-[24px] leading-tight font-medium">{r.status === "cancelled" ? "The check was stopped" : "The check didn’t finish"}</h1><p className="mt-1.5 text-sm text-muted-foreground">{hostOf(r.url)}, {when(r.started)}. {r.error}</p>{isCloudflare(r.error) && <CloudflareHelp open className="mt-3" />}</div>
      <div><Button onClick={() => run(r.url)} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RotateCw />}Try again</Button></div>
    </div>
  )

  return <Report p={p} r={r} focus={focus} busy={busy} onRun={() => run(r.url)} head={head} speed={speed} setSpeed={setSpeed} />
}

function Report({ p, r, focus, busy, onRun, head, speed, setSpeed }: { p: Project; r: LaunchReport; focus?: LaunchCheckId; busy: boolean; onRun: () => void; head: React.ReactNode; speed: boolean; setSpeed: (v: boolean) => void }) {
  const checks = ORDER.map((id) => r.checks!.find((c) => c.id === id)).filter(Boolean) as LaunchCheck[]
  const later = (c: LaunchCheck) => !!r.staging && LATER.includes(c.id)
  const now = checks.filter((c) => !later(c)), ok = now.filter((c) => c.ok).length
  const failing = now.filter((c) => !c.ok), passedChecks = now.filter((c) => c.ok), afterChecks = checks.filter(later)
  const newCount = now.reduce((n, c) => n + c.issues.filter((i) => i.isNew).length, 0)
  const items = itemsOf(p)
  const history = p.tools.launchHistory.filter((h) => h.status === "done")
  const copy = () => { navigator.clipboard.writeText(toMarkdown(r, checks)); toast("Copied the issues as a checklist", { description: "Paste it into Slack or a task." }) }
  const info = r.info!
  const year = new Date().getFullYear()
  return (
    <div className="grid mx-auto w-full max-w-4xl gap-5 px-12 pt-8 pb-10">
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {head}
        <span className="flex-1" />
        {history.length > 1 && (
          <select value={r.id} onChange={(e) => go(routes.launch(p.id, e.target.value))} aria-label="Earlier checks" className="h-8 rounded-lg border border-input bg-card px-2 text-[13px]">
            {history.map((h) => <option key={h.id} value={h.id}>{when(h.at)}{where(h)}</option>)}
          </select>
        )}
        {ok < now.length && <Button variant="outline" size="sm" onClick={copy}><Copy />Copy issues</Button>}
        <Button size="sm" onClick={onRun} disabled={busy || !!p.tools.launchRunning}>{busy ? <Loader2 className="animate-spin" /> : <RotateCw />}Run again</Button>
      </div>
      <div className="-mt-3 flex justify-end"><SpeedOption speed={speed} setSpeed={setSpeed} /></div>
      <div>
        <h1 className="text-[24px] leading-tight font-medium">{r.oldSite ? "The old site" : failing.length ? `${failing.length} ${failing.length === 1 ? "check needs" : "checks need"} fixing` : r.staging ? "Staging is ready" : "Ready to launch"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          <a href={r.url} target="_blank" rel="noreferrer" className="text-foreground/80 underline-offset-2 hover:underline">{r.host}</a>{where(r)}. {r.pagesChecked} pages and {r.linksChecked?.toLocaleString()} links, {when(r.started)}.
          {r.watch ? <> The day {r.watch} check after launch.</> : null}
          {r.previous && <> Since the {day(r.previous.at)} check: {newCount} new {newCount === 1 ? "issue" : "issues"}, {(r.fixed || []).length} fixed.</>}
        </p>
      </div>
      {r.oldSite && (
        <p className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />Before launch day, {r.host} still shows the old site, so this is a check of the old site. It’s useful for spotting what to carry over, but nothing on the checklist is ticked from it. Check staging before launch, and the live domain from launch day.</p>
      )}
      {r.staging && !r.oldSite && (
        <p className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />This is the staging site. {r.liveHost !== r.host ? `Canonicals are compared to ${r.liveHost}, the live domain.` : "Add the live domain in the project details to check where canonicals point."}</p>
      )}
      {([["Needs fixing", failing], ["Passed", passedChecks], ["After launch", afterChecks]] as [string, LaunchCheck[]][]).filter(([, list]) => list.length).map(([title, list]) => (
        <section key={title} className="grid gap-1">
          <h2 className="mb-1 flex items-baseline gap-2 text-sm font-medium">{title}<span className="text-[12.5px] font-normal text-muted-foreground tabular">{list.length}</span>{title === "After launch" && <span className="text-[12.5px] font-normal text-muted-foreground">staging is hidden and redirected on purpose, so these wait for the live domain</span>}</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {list.map((c) => <CheckRow key={c.id} r={r} c={c} later={later(c)} items={items.filter((x) => x.check === c.id)} open={focus ? focus === c.id : title === "Needs fixing"} />)}
          </div>
        </section>
      ))}
      {(r.fixed || []).length > 0 && <Fixed r={r} />}
      {!!info.speed?.length && <Speed r={r} list={info.speed} carried={r.checks!.find((c) => c.id === "speed")?.carried} />}
      {info.tracking && <Tracking t={info.tracking} error={info.trackingError} />}

      <section className="grid gap-1">
        <h2 className="mb-1 text-sm font-medium">Also found</h2>
        <div className="overflow-hidden rounded-xl border bg-card text-[13.5px]">
          <Fact label="Sitemap" bad={!info.sitemap?.found && !r.staging}>{info.sitemap?.found ? <>Found, {info.sitemap.urls?.toLocaleString()} URLs <Out href={info.sitemap.url!} /></> : r.staging ? "Not found on staging. Check it’s there on the live domain." : "Not found at /sitemap.xml. Webflow makes one when it’s switched on in SEO settings."}</Fact>
          <Fact label="robots.txt" bad={!!info.robots?.blocksAll && !r.staging}>{!info.robots?.found ? "None. That’s fine, everything can be indexed." : info.robots.blocksAll ? (r.staging ? "Blocks every page, as staging should" : "Blocks every page") : "Found, allows indexing"}</Fact>
          <Fact label="Copyright year" bad={!!info.copyright && info.copyright < year}>{info.copyright ? (info.copyright < year ? `${info.copyright}, update it to ${year}` : String(info.copyright)) : "No copyright line found"}</Fact>
          <Fact label="Phone numbers" bad={info.phones.length > 0} list={info.phones.map((x) => ({ page: x.page, text: x.number }))} base={r.url}>{info.phones.length ? `${info.phones.length} ${info.phones.length === 1 ? "page shows" : "pages show"} a number that isn’t a tap-to-call link` : "Every number found is a tap-to-call link"}</Fact>
          <Fact label="Forms" list={info.forms.map((x) => ({ page: x.page, text: x.count === 1 ? "1 form" : `${x.count} forms` }))} base={r.url}>{info.forms.length ? `${info.forms.reduce((n, x) => n + x.count, 0)} on ${info.forms.length} ${info.forms.length === 1 ? "page" : "pages"}. Submit each one once before launch.` : "No forms found"}</Fact>
          <Fact label="Other sites" bad={info.external.broken.length > 0} list={info.external.broken.map((x) => ({ page: x.page, text: `${x.url} (${x.status ? "HTTP " + x.status : "no response"})` }))} base={r.url}>
            {info.external.checked} links checked, {info.external.broken.length ? `${info.external.broken.length} broken` : "none broken"}.{info.external.social > 0 && ` ${info.external.social} social links skipped, those sites block automated checks.`}
          </Fact>
          {!r.staging && <Fact label="Search Console">{info.searchConsole ? "Verified with a meta tag on the home page. Keep it, or the verification stops." : "No verification tag on the home page. It may be verified through DNS instead: check Search Console lists the live domain."}</Fact>}
          <Fact label="Mixed content" bad={info.mixed.length > 0} list={info.mixed.map((x) => ({ page: x.page, text: `${x.count} http:// ${x.count === 1 ? "file" : "files"}` }))} base={r.url}>{info.mixed.length ? `${info.mixed.length} ${info.mixed.length === 1 ? "page loads" : "pages load"} files over http://` : "None"}</Fact>
        </div>
      </section>
      <Pages r={r} />
    </div>
  )
}

function CheckRow({ r, c, later, items, open: initial }: { r: LaunchReport; c: LaunchCheck; later: boolean; items: PItem[]; open: boolean }) {
  const [open, setOpen] = React.useState(initial)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (initial) ref.current?.scrollIntoView({ block: "center" }) }, [initial])
  const hard = c.issues.filter((i) => !i.soft).length, soft = c.issues.length - hard
  return (
    <div ref={ref} className="border-t first:border-t-0">
      <button onClick={() => c.issues.length && setOpen(!open)} className={cn("grid min-h-12 w-full grid-cols-[18px_minmax(0,1fr)_120px_16px] items-center gap-3 px-4 py-2.5 text-left", c.issues.length && "hover:bg-muted/30")}>
        {later ? <span className="size-[18px] rounded-full border-[1.5px] border-dashed border-input" /> : <CheckMark ok={c.ok} />}
        <span className="grid gap-0.5"><span className="text-[13.5px] font-medium">{c.name}</span>{items.length > 0 && <span className="truncate text-[12.5px] text-muted-foreground">Checklist: {items.map((x) => x.title).join("; ")}</span>}</span>
        <span className={cn("text-right text-[13px] tabular", hard && !later ? "text-destructive" : "text-muted-foreground")}>{later ? "After launch" : hard ? `${hard} ${hard === 1 ? "issue" : "issues"}` : soft ? `Passed, ${soft} to look at` : "Passed"}</span>
        {c.issues.length ? <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} /> : <span />}
      </button>
      {open && (
        <div className="border-t border-border/60 bg-muted/20 px-4 pt-1 pb-3 pl-[46px]">
          {c.carried && <p className="pt-2 text-[12.5px] text-muted-foreground">From the {day(c.carried)} check. This check skipped the speed test.</p>}
          {c.note && <p className="py-2 text-[12.5px] text-muted-foreground">{c.note}</p>}
          {c.issues.map((i) => <IssueRow key={i.text} i={i} base={r.url} />)}
        </div>
      )}
    </div>
  )
}

function IssueRow({ i, base }: { i: LaunchIssue; base: string }) {
  const [all, setAll] = React.useState(false)
  const shown = all ? i.pages : i.pages.slice(0, i.pages.length > 3 ? 2 : 3)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,260px)] gap-4 border-b border-border/60 py-2.5 text-[13px] last:border-b-0">
      <span className="grid gap-0.5">
        <span className={cn(i.soft && "text-muted-foreground")}>{i.text}{i.isNew && <span className="ml-2 rounded-full border border-input px-1.5 py-px text-[11px] text-foreground">New</span>}{i.soft && <span className="ml-2 text-xs">worth a look</span>}</span>
        {i.fix && <span className="text-[12.5px] text-muted-foreground">{i.fix}</span>}
        {!!i.examples?.length && (
          <span className="mt-1 grid gap-1">
            {i.examples.map((x, n) => (
              <span key={n} className="grid gap-0.5 rounded-md bg-muted/60 px-2 py-1.5 text-[12px] text-muted-foreground">
                <span><PageLink base={base} path={x.page} /> · {x.text}</span>
                {x.html && <span className="line-clamp-2 break-all text-foreground/70">{x.html}</span>}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="text-right text-[12.5px] leading-relaxed text-muted-foreground">
        {i.pages.length === 0 ? "Whole site" : <>
          {shown.map((pg, n) => <React.Fragment key={pg}>{n ? ", " : ""}<PageLink base={base} path={pg} /></React.Fragment>)}
          {i.pages.length > 3 && <> {all ? "" : "and "}<button onClick={() => setAll(!all)} className="whitespace-nowrap text-foreground/70 hover:text-foreground">{all ? "show fewer" : `${i.pages.length - 2} more`}</button></>}
        </>}
      </span>
    </div>
  )
}

function Fixed({ r }: { r: LaunchReport }) {
  const [open, setOpen] = React.useState(false)
  const list = r.fixed || []
  return (
    <section>
      <button onClick={() => setOpen(!open)} className="flex h-8 items-center gap-2 text-sm font-medium"><ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />Fixed since the {day(r.previous!.at)} check <span className="text-[12.5px] font-normal text-muted-foreground tabular">{list.length}</span></button>
      {open && (
        <div className="mt-1 overflow-hidden rounded-xl border bg-card">
          {list.map((x, n) => (
            <div key={n} className="grid min-h-10 grid-cols-[18px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-t px-4 py-2 text-[13px] first:border-t-0">
              <CheckMark ok size={16} /><span className="text-muted-foreground line-through decoration-muted-foreground/50">{x.text}</span><span className="text-[12.5px] text-muted-foreground">{CHECK_NAMES[x.check]}{x.pages > 1 ? `, was on ${x.pages} pages` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
const CHECK_NAMES: Record<LaunchCheckId, string> = { indexing: "Google can index the site", placeholders: "No placeholder text or dummy links", links: "Links work", seo: "Titles, descriptions, H1s, alt text, OG images, favicon", a11y: "Accessibility basics (WCAG 2.2 AA)", speed: "Speed on a phone (Core Web Vitals)", tracking: "Tracking: tags, cookie consent and ad clicks", canonicals: "Canonicals point to the live domain", legal: "Legal pages linked", https: "SSL and redirects" }

// ---------- tracking ----------
/** What's installed, and what the home page did with no cookie choice, after Reject and after Accept. */
function Tracking({ t, error }: { t: TrackingInfo; error?: string }) {
  const names = (x: string[]) => x.join(", ")
  const verb = (x: string[], one: string, many: string) => (x.length === 1 ? one : many)
  const dropped = t.redirects.filter((x) => !x.kept)
  return (
    <section className="grid gap-1">
      <h2 className="mb-1 flex items-baseline gap-2 text-sm font-medium">What’s installed<span className="text-[12.5px] font-normal text-muted-foreground">{t.blocked ? `${t.blocked} tracking requests blocked during the check, so nothing reached the client’s accounts` : "as a visitor’s browser sees it"}</span></h2>
      <div className="overflow-hidden rounded-xl border bg-card text-[13.5px]">
        {t.tags.length ? t.tags.map((x) => (
          <div key={x.tag} className="grid min-h-10 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] items-center gap-3 border-t px-4 py-2 first:border-t-0">
            <span>{x.name}</span>
            <span className="truncate text-muted-foreground">{x.ids.join(", ") || "No ID seen"}</span>
            <span className={cn("text-right tabular", x.pages < x.of && x.tag !== "ads" ? "text-foreground" : "text-muted-foreground")}>{x.pages === x.of ? `Every page (${x.of})` : `${x.pages} of ${x.of} pages`}</span>
          </div>
        )) : <p className="px-4 py-3 text-muted-foreground">No analytics or ad tags found on the pages checked.</p>}
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border bg-card text-[13.5px]">
        <Fact label="Cookie banner">{t.banner ? `${t.banner}${t.buttons && !t.buttons.reject ? ", with no Reject button on its first screen" : ""}` : "None found"}</Fact>
        <Fact label="First visit" bad={!!t.banner && !!t.firstVisit?.length}>{t.firstVisit == null ? "Not tested" : t.firstVisit.length ? `${names(t.firstVisit)} ${t.banner ? verb(t.firstVisit, "tracks", "track") + " before a choice is made" : verb(t.firstVisit, "tracks", "track") + " straight away"}` : "Nothing tracks before a choice"}</Fact>
        {t.banner && <Fact label="After Reject" bad={!!t.afterReject?.length}>{t.afterReject == null ? "Couldn’t find a Reject button to press" : t.afterReject.length ? `${names(t.afterReject)} still ${verb(t.afterReject, "tracks", "track")}` : "Nothing tracks"}</Fact>}
        {t.banner && <Fact label="After Accept">{t.afterAccept == null ? "Couldn’t find an Accept button to press" : t.afterAccept.length ? `${names(t.afterAccept)} ${verb(t.afterAccept, "starts", "start")}` : "Nothing starts"}</Fact>}
        <Fact label="Consent mode">{t.consentMode ? "Google tags send consent mode signals" : "Not in use"}</Fact>
        <Fact label="Ad click IDs" bad={dropped.length > 0}>{!t.redirects.length ? "No redirects to test" : dropped.length ? `${dropped.length} of ${t.redirects.length} redirects drop gclid and UTM tags` : `Kept through ${t.redirects.length} ${t.redirects.length === 1 ? "redirect" : "redirects"}`}</Fact>
      </div>
      {error && <p className="text-[12.5px] text-muted-foreground">The cookie test couldn’t finish: {error}</p>}
    </section>
  )
}

// ---------- speed ----------
const TONE: Record<string, string> = { good: "text-muted-foreground", fix: "text-foreground", poor: "text-destructive" }
const Val = ({ v, rating }: { v: string; rating: Rating }) => <span className={cn("text-right tabular", rating ? TONE[rating] : "text-muted-foreground")}>{v}</span>
/** The speed test's numbers, page by page, against Google's targets. */
function Speed({ r, list, carried }: { r: LaunchReport; list: SpeedResult[]; carried?: number }) {
  const cols = "grid-cols-[minmax(0,1fr)_88px_88px_96px_72px]"
  const psi = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(r.url)}&form_factor=mobile`
  return (
    <section className="grid gap-1">
      <h2 className="mb-1 flex items-baseline gap-2 text-sm font-medium">Speed on a phone<span className="text-[12.5px] font-normal text-muted-foreground">{carried ? `from the ${day(carried)} check. ` : ""}Targets: main content in 2.5 s, layout shift under 0.1, blocked under 200 ms</span></h2>
      <div className="overflow-hidden rounded-xl border bg-card text-[13px]">
        <div className={cn("grid h-9 items-center gap-3 border-b px-4 text-[12.5px] text-muted-foreground", cols)}><span>Page</span><span className="text-right">Main content</span><span className="text-right">Layout shift</span><span className="text-right">Blocked by scripts</span><span className="text-right">Size</span></div>
        {list.map((m) => (
          <div key={m.path} className={cn("grid min-h-10 items-center gap-3 border-t px-4 py-2 first:border-t-0", cols)}>
            <span className="grid min-w-0"><PageLink base={r.url} path={m.path} />{m.lcpEl && <span className="truncate text-[12px] text-muted-foreground">{m.lcpEl}</span>}{m.error && <span className="truncate text-[12px] text-destructive">{m.error}</span>}</span>
            {m.error ? <><span /><span /><span /><span /></> : <>
              <Val v={m.lcp != null ? `${(m.lcp / 1000).toFixed(1)} s` : "None"} rating={m.rating.lcp} />
              <Val v={m.cls.toFixed(2)} rating={m.rating.cls} />
              <Val v={`${m.tbt.toLocaleString()} ms`} rating={m.rating.tbt} />
              <span className="text-right text-muted-foreground tabular">{(m.bytes / 1048576).toFixed(1)} MB</span>
            </>}
          </div>
        ))}
      </div>
      <p className="text-[12.5px] text-muted-foreground">A lab test on this Mac, set up like a mid-range phone on slow 4G, as in Lighthouse’s mobile test. Red is in Google’s “poor” range. For a live site with enough visitors, <a href={psi} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">PageSpeed Insights</a> shows what real visitors get.</p>
    </section>
  )
}

const PageLink = ({ base, path }: { base: string; path: string }) => <a href={new URL(path, base).href} target="_blank" rel="noreferrer" className="break-all hover:text-foreground hover:underline underline-offset-2">{path === "/" ? "Home" : path}</a>
const Out = ({ href }: { href: string }) => <a href={href} target="_blank" rel="noreferrer" aria-label="Open" className="ml-1 inline-flex align-[-2px] text-muted-foreground hover:text-foreground"><ExternalLink className="size-3.5" /></a>

function Fact({ label, bad, list, base, children }: { label: string; bad?: boolean; list?: { page: string; text: string }[]; base?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const more = !!list && list.length > 0
  return (
    <div className="border-t first:border-t-0">
      <div className="grid min-h-11 grid-cols-[150px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(bad && "text-destructive")}>{children}</span>
        {more ? <button onClick={() => setOpen(!open)} className="text-[12.5px] text-foreground/70 hover:text-foreground">{open ? "Hide" : "Show"}</button> : <span />}
      </div>
      {open && more && (
        <div className="grid border-t border-border/60 bg-muted/20 px-4 py-1.5 pl-[178px]">
          {list!.map((x, n) => <div key={n} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 py-1 text-[12.5px]"><PageLink base={base!} path={x.page} /><span className="truncate text-muted-foreground">{x.text}</span></div>)}
        </div>
      )}
    </div>
  )
}

function Pages({ r }: { r: LaunchReport }) {
  const [open, setOpen] = React.useState(false)
  const pages = r.pages || []
  return (
    <section>
      <button onClick={() => setOpen(!open)} className="flex h-8 items-center gap-2 text-sm font-medium"><ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />Pages checked <span className="text-[12.5px] font-normal text-muted-foreground tabular">{pages.length}</span></button>
      {open && (
        <div className="mt-1 overflow-hidden rounded-xl border bg-card">
          {pages.map((pg) => (
            <div key={pg.path} className="grid h-10 grid-cols-[minmax(0,240px)_minmax(0,1fr)_72px] items-center gap-3 border-t px-4 text-[13px] first:border-t-0">
              <PageLink base={r.url} path={pg.path} />
              <span className="truncate text-muted-foreground">{pg.title || (pg.error ? pg.error : "No title")}</span>
              <span className={cn("text-right tabular", pg.status >= 400 || !pg.status ? "text-destructive" : "text-muted-foreground")}>{pg.status || "Error"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Issues as a Markdown checklist, ready for Slack. */
function toMarkdown(r: LaunchReport, checks: LaunchCheck[]) {
  const where = (i: LaunchIssue) => (i.pages.length ? ` (${i.pages.slice(0, 4).join(", ")}${i.pages.length > 4 ? ` and ${i.pages.length - 4} more` : ""})` : "")
  const out = [`**Launch check: ${r.host}${r.staging ? " (staging)" : ""}, ${day(r.started)}**`, ""]
  for (const c of checks) {
    if (r.staging && LATER.includes(c.id)) continue
    const hard = c.issues.filter((i) => !i.soft)
    if (!hard.length) continue
    out.push(`### ${c.name}`, ...hard.map((i) => `- [ ] ${i.text}${where(i)}${i.fix ? `. ${i.fix}` : ""}`), "")
  }
  return out.join("\n").trim()
}

// ---------- inside an item's sheet ----------
export function LaunchItemPanel({ p, it, reload }: { p: Project; it: PItem; reload: () => void }) {
  const t = it.toolInfo!
  const running = p.tools.launchRunning
  const [r, setR] = React.useState<LaunchReport | null>(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { setR(null); if (t.runId) api.launch(p.id, t.runId).then(setR).catch(() => {}) }, [p.id, t.runId])
  const c = r?.checks?.find((x) => x.id === it.check)
  const hard = c && !(r?.staging && LATER.includes(c.id)) ? c.issues.filter((i) => !i.soft) : []
  const url = defaultUrl(p)
  return (
    <>
      {hard.length > 0 && (
        <div className="grid">
          {hard.slice(0, 4).map((i) => (
            <div key={i.text} className="grid gap-0.5 border-t border-border/60 py-2 text-[13px]">
              <span>{i.text}</span>
              {i.pages.length > 0 && <span className="truncate text-[12px] text-muted-foreground">{i.pages.slice(0, 3).join(", ")}{i.pages.length > 3 ? ` and ${i.pages.length - 3} more` : ""}</span>}
            </div>
          ))}
          {hard.length > 4 && <span className="border-t border-border/60 pt-2 text-[12.5px] text-muted-foreground">{hard.length - 4} more in the report</span>}
        </div>
      )}
      <div className="flex gap-2">
        {t.runId && <Button size="sm" onClick={() => go(routes.launch(p.id, t.runId, it.check || undefined))}>Open the report</Button>}
        {running
          ? <Button size="sm" variant="outline" onClick={() => go(routes.launch(p.id, running.id))}><Loader2 className="animate-spin" />Checking now</Button>
          : url
            ? <Button size="sm" variant={t.runId ? "outline" : "default"} disabled={busy} onClick={async () => { setBusy(true); await startLaunch(p, url, reload); setBusy(false) }}>{busy ? <Loader2 className="animate-spin" /> : t.runId ? <RotateCw /> : <Play />}{t.runId ? "Run again" : `Check ${hostOf(url)}`}</Button>
            : <Button size="sm" variant="outline" onClick={() => go(routes.project(p.id, "tools"))}>Go to Tools</Button>}
      </div>
    </>
  )
}

/** Keeps the app's list of projects fresh while a check runs, so the sidebar and home update when it ends. */
export function useLaunchRefresh(p: Project | null) {
  const { refreshProjects } = useApp()
  const was = React.useRef(false)
  React.useEffect(() => {
    const now = !!p?.tools.launchRunning
    if (was.current && !now) refreshProjects().catch(() => {})
    was.current = now
  }, [p?.tools.launchRunning, refreshProjects])
}
