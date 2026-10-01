import * as React from "react"
import { Loader2, RefreshCw, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ToolCard } from "@/components/project/ToolCard"
import { api, type GoogleLists, type GoogleRange, type GoogleStatus, type Project, type TrafficImport } from "@/lib/api"
import { hostOfUrl, today } from "@/lib/project"
import { go, routes } from "@/lib/router"

const day = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" })
const days = (x: TrafficImport) => (x.from && x.to ? Math.round((new Date(x.to + "T00:00").getTime() - new Date(x.from + "T00:00").getTime()) / 864e5) + 1 : null)

/**
 * Search traffic: clicks from Search Console and sessions from GA4, pulled with the user's own Google sign-in, or a
 * CSV export dropped in. It ranks the redirect map by real clicks, keeps a before-launch number to compare with one
 * from after, and gives the care report its month.
 */
export function TrafficCard({ p, setP }: { p: Project; setP: (x: Project) => void }) {
  const [busy, setBusy] = React.useState(false)
  const [g, setG] = React.useState<GoogleStatus | null>(null)
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => { api.google().then(setG).catch(() => {}) }, [])
  const list = p.traffic || []
  const pick = (f?: File) => {
    if (!f) return
    if (f.size > 20e6) return toast.error("That file is over 20 MB.")
    setBusy(true)
    f.text().then(async (text) => {
      try { const x = await api.importTraffic(p.id, f.name, text); setP(x); const i = x.traffic?.[0]; if (i) toast.success(`Imported ${i.total.toLocaleString()} ${i.metric} on ${i.pages.toLocaleString()} pages`, { description: `From ${i.source}${p.tools.redirects ? ". The redirect map now lists the URLs with the most " + i.metric + " first." : "."}` }) }
      catch (e) { toast.error((e as Error).message) } finally { setBusy(false); if (input.current) input.current.value = "" }
    })
  }
  const remove = async (id: string) => { try { setP(await api.removeTraffic(p.id, id)) } catch (e) { toast.error((e as Error).message) } }
  // Before and after launch, the same source and measure, per day when both say which days they cover.
  const before = list.find((x) => x.before), after = list.find((x) => !x.before && (!before || (x.source === before.source && x.metric === before.metric)))
  const rate = (x: TrafficImport) => (days(x) ? x.total / days(x)! : x.total)
  const perDay = !!(before && after && days(before) && days(after))
  const compare = before && after && before.metric === after.metric ? Math.round((100 * (rate(after) - rate(before))) / Math.max(1, rate(before))) : null
  const signedIn = !!g?.signedIn
  return (
    <ToolCard
      title="Search traffic" cost={signedIn ? "from Search Console and GA4, or a CSV" : "from a CSV you export, or from Google once you sign in"}
      status={list.length ? <>{before ? <>Before launch: {before.total.toLocaleString()} {before.metric} ({before.source}, {before.from ? before.name : day(before.at)}). </> : null}{after ? <>After launch: {after.total.toLocaleString()} {after.metric} ({after.source}, {after.from ? after.name : day(after.at)}){compare != null ? <>, <span className="text-foreground">{compare === 0 ? "the same as before" : `${Math.abs(compare)}% ${compare > 0 ? "more" : "fewer"}${perDay ? " a day" : ""} than before`}</span>.{perDay ? "" : " Compare exports that cover the same number of days."}</> : "."}</> : null}</>
        : signedIn ? "Pick the project’s Search Console and GA4 properties below. Groundwork gets the 3 months before launch for the redirect map, the first 28 days after to compare, and each month for a care plan’s report."
        : <>Export the Pages report from Search Console, or Landing page from GA4 or Google Ads, and drop the CSV here. It ranks the redirect map by real clicks, and keeps a number from before launch to compare with after. Or <button onClick={() => go(routes.settings("connectors"))} className="underline underline-offset-2 hover:text-foreground">sign in to Google</button> to get them without exporting.</>}
      action={<>
        <input ref={input} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Upload />}Import a CSV</Button>
      </>}
    >
      {signedIn && <GooglePulls p={p} setP={setP} g={g!} />}
      {list.length > 0 && (
        <div className="grid border-t pt-1">
          {list.map((x) => (
            <div key={x.id} className="group grid min-h-9 grid-cols-[minmax(0,1fr)_110px_110px_90px_24px] items-center gap-3 text-[13px]">
              <span className="truncate">{x.name || x.source}<span className="text-muted-foreground"> · {x.source}{x.via === "google" ? "" : ", CSV"}</span></span>
              <span className="text-right text-muted-foreground tabular">{x.total.toLocaleString()} {x.metric}</span>
              <span className="text-right text-muted-foreground tabular">{x.pages.toLocaleString()} pages</span>
              <span className="text-right text-muted-foreground">{x.before ? "Before launch" : "After launch"}</span>
              <button onClick={() => remove(x.id)} aria-label="Remove this import" className="grid size-6 place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"><X className="size-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </ToolCard>
  )
}

// Which property is this project's, from its domain: a Domain property first, then the address with or without www.
function suggestSite(sites: string[], domain: string) {
  if (!domain) return null
  const bare = domain.replace(/^www\./, "")
  return sites.find((s) => s === `sc-domain:${bare}`) || sites.find((s) => s.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") === bare) || null
}

/** The project's Search Console and GA4 properties, and a pull of a range of days from either. */
function GooglePulls({ p, setP, g }: { p: Project; setP: (x: Project) => void; g: GoogleStatus }) {
  const [lists, setLists] = React.useState<GoogleLists | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [kind, setKind] = React.useState<GoogleRange>(p.repeat ? "month" : p.launch && p.launch <= today() ? "since" : "before")
  const [pulling, setPulling] = React.useState<"gsc" | "ga4" | null>(null)
  const load = React.useCallback(async (fresh = false) => { setLoading(true); try { setLists(await api.googleLists(fresh)) } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) } }, [])
  React.useEffect(() => { load() }, [load])
  const domain = hostOfUrl(p.sites.live || "") || hostOfUrl(p.sites.old || "") || p.host || ""
  const gsc = p.google?.gsc || "", ga4 = p.google?.ga4 || ""
  // A property that's plainly this project's is picked straight away.
  React.useEffect(() => {
    if (!lists?.sites || gsc) return
    const s = suggestSite(lists.sites, domain)
    if (s) api.setGoogle(p.id, { gsc: s }).then(setP).catch(() => {})
  }, [lists, gsc, domain, p.id, setP])
  const set = async (b: Parameters<typeof api.setGoogle>[1]) => { try { setP(await api.setGoogle(p.id, b)) } catch (e) { toast.error((e as Error).message) } }
  const pull = async (source: "gsc" | "ga4") => {
    setPulling(source)
    try { const r = await api.googlePull(p.id, source, kind); setP(r); toast.success(`${r.pulled.total.toLocaleString()} ${r.pulled.metric} on ${r.pulled.pages.toLocaleString()} pages`, { description: `From ${r.pulled.source}, ${r.pulled.name}.` }) }
    catch (e) { toast.error((e as Error).message) } finally { setPulling(null) }
  }
  const base = domain.split(".")[0]
  const props = (lists?.properties || []).slice().sort((a, b) => Number(b.name.toLowerCase().includes(base)) - Number(a.name.toLowerCase().includes(base)))
  const launched = !!p.launch && p.launch <= today()
  const RANGES: [GoogleRange, string, boolean][] = [["before", p.launch ? "3 months before launch" : "Last 3 months", true], ["since", "First 28 days after launch", launched], ["month", "Last month", true], ["last28", "Last 28 days", true]]
  const sel = "h-8 min-w-0 rounded-md border border-input bg-card px-2 text-[13px]"
  return (
    <div className="grid gap-2 border-t pt-3 text-[13px]">
      <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3">
        <span className="text-muted-foreground">Search Console</span>
        {lists?.sitesError ? <span className="text-destructive">{lists.sitesError}</span> : (
          <select value={gsc} onChange={(e) => set({ gsc: e.target.value || null })} aria-label="Search Console property" className={sel}>
            <option value="">{lists ? (lists.sites?.length ? "Pick a property" : "No properties on this Google account") : "Loading…"}</option>
            {(lists?.sites || []).map((s) => <option key={s} value={s}>{s.replace(/^sc-domain:/, "Domain: ")}</option>)}
          </select>
        )}
        <Button size="sm" variant="outline" disabled={!gsc || !g.searchConsole || !!pulling} onClick={() => pull("gsc")}>{pulling === "gsc" && <Loader2 className="animate-spin" />}Get clicks</Button>
      </div>
      <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3">
        <span className="text-muted-foreground">GA4</span>
        {lists?.propertiesError ? <span className="text-destructive">{lists.propertiesError}</span> : (
          <select value={ga4} onChange={(e) => set({ ga4: e.target.value || null, ga4Name: props.find((x) => x.id === e.target.value)?.name || null })} aria-label="GA4 property" className={sel}>
            <option value="">{lists ? (props.length ? "Pick a property" : "No GA4 properties on this Google account") : "Loading…"}</option>
            {props.map((x) => <option key={x.id} value={x.id}>{x.name}{x.account ? ` (${x.account})` : ""}</option>)}
          </select>
        )}
        <Button size="sm" variant="outline" disabled={!ga4 || !g.analytics || !!pulling} onClick={() => pull("ga4")}>{pulling === "ga4" && <Loader2 className="animate-spin" />}Get sessions</Button>
      </div>
      <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3">
        <span className="text-muted-foreground">Days</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as GoogleRange)} aria-label="Which days" className={sel}>
          {RANGES.filter(([, , ok]) => ok).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button onClick={() => load(true)} disabled={loading} className="inline-flex h-8 items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground hover:text-foreground"><RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />Refresh lists</button>
      </div>
      {p.google?.error && (p.google.errorAt || 0) > (g.at || 0) && <p className="text-destructive">The last pull didn’t work: {p.google.error}</p>}
      <p className="text-[12.5px] text-muted-foreground">Once a property is picked, Groundwork also gets {p.repeat ? "last month’s numbers at the start of each month, for the care report" : "the 3 months before launch on its own, then the first 28 days after once they’re in"}. Google’s numbers run three days behind.</p>
    </div>
  )
}
