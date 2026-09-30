import * as React from "react"
import { cn } from "cn"
import { Check, ChevronDown, Copy, Download, ExternalLink, KeyRound, Loader2, MessageSquareText, Pencil, RefreshCw, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Bar, Ring, SiteIcon, Spinner, Tag, TopBar } from "@/components/common/bits"
import { modelName } from "@/components/run/blocks"
import { useApp } from "@/hooks/useApp"
import { useRun } from "@/hooks/useRun"
import { api, seoCsvUrl, type SeoFieldId, type SeoPage as SPage, type SeoState } from "@/lib/api"
import * as SEO from "@/lib/seo"
import { ago, plural } from "@/lib/format"
import { go, routes } from "@/lib/router"
import { Empty, hostOf } from "./RunPage"

type Filter = "all" | "todo" | "done"
const LABEL: Record<SeoFieldId | "redirect", string> = { title: "Title", description: "Description", slug: "URL", redirect: "Redirect" }
// One grid for every row on the page, so the columns line up from card to card.
const ROW = "grid grid-cols-[20px_88px_minmax(0,1fr)_56px_60px] items-start gap-x-3"

export function SeoPage({ view }: { view: string }) {
  const { run, seo, seoState, setSeoState, notFound, seoProgress } = useRun()
  const app = useApp()
  const [checking, setChecking] = React.useState(false)
  if (notFound) return <Empty title="This site plan doesn’t exist any more." />
  if (!run) return <div className="grid h-full place-items-center"><Spinner className="size-5" /></div>
  if (!run.seo) return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div><p className="text-lg font-medium">No SEO plan for this site yet</p><p className="mt-1.5 text-sm text-muted-foreground">It writes a title, meta description and URL for each page.</p><Button className="mt-4" onClick={() => go(routes.run(run.id, "seo"))}>Plan SEO</Button></div>
    </div>
  )
  if (!seo) return <div className="grid h-full place-items-center"><Spinner className="size-5" /></div>

  const edits = seoState.edits
  const planned = seo.pages.filter((p) => p.planned)
  const tot = SEO.counts(planned, seoState.done, edits)
  const running = run.seo.status === "running"
  const focus = view.startsWith("p:") ? view.slice(2) : null
  const filter: Filter = view === "todo" || view === "done" ? view : "all"
  const left = (p: SPage) => SEO.tasks(p, edits).filter((t) => !seoState.done[t.key]).length
  const shown = planned.filter((p) => filter === "all" || (filter === "todo" ? left(p) > 0 : SEO.tasks(p, edits).length > 0 && left(p) === 0))

  const save = async (b: { set?: Record<string, boolean>; edits?: Record<string, string | null> }) => {
    setSeoState((s) => {
      const done = { ...s.done }, ed = { ...s.edits }
      for (const [k, v] of Object.entries(b.set || {})) { if (v) done[k] = { at: Date.now(), via: "manual" }; else delete done[k] }
      for (const [k, v] of Object.entries(b.edits || {})) { if (v == null) delete ed[k]; else ed[k] = v }
      return { ...s, done, edits: ed }
    })
    try { const r = await api.seoState(run.id, b); setSeoState(r.state); app.patchRun(run.id, { seo: { status: run.seo!.status, progress: r.progress, percent: null } }) }
    catch (e) { toast.error("Couldn’t save: " + (e as Error).message) }
  }
  const checkLive = async () => {
    setChecking(true)
    try {
      const r = await api.seoCheck(run.id)
      setSeoState(r.state); app.refreshRuns()
      if (r.found) toast.success(`${plural(r.found, "change")} found on the live site and ticked off`, { description: `${r.todo} still to do.` })
      else toast("None of the SEO changes are on the live site yet", { description: `${plural(r.todo, "change")} to do.` })
    } catch (e) { toast.error((e as Error).message) } finally { setChecking(false) }
  }
  const copyForClient = () => {
    const list = planned.filter((p) => SEO.tasks(p, edits).length)
    const msg = `Hi,\n\nHere are the page titles and descriptions we’d like to use for ${seo.site.name}. They’re what Google shows in search results, so each one says what the page offers in the words people search for.\n\n${list.map((p) => {
      const lines = [`• ${p.name} (${p.path})`]
      if (SEO.changed(p, "title", edits)) lines.push(`  Title: ${SEO.value(p, "title", edits)}`)
      if (SEO.changed(p, "description", edits)) lines.push(`  Description: ${SEO.value(p, "description", edits)}`)
      if (SEO.changed(p, "slug", edits)) lines.push(`  New address: ${SEO.normPath(SEO.value(p, "slug", edits))} (the old one will redirect)`)
      return lines.join("\n")
    }).join("\n\n")}\n\nCould you confirm these, or tell us which to adjust?\n\nThanks!`
    navigator.clipboard.writeText(msg)
    toast.success("Message copied", { description: "Paste it into an email or Slack." })
  }
  const counts = { all: planned.length, todo: planned.filter((p) => left(p) > 0).length, done: planned.filter((p) => SEO.tasks(p, edits).length > 0 && left(p) === 0).length }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar className="gap-3">
        <SiteIcon runId={run.id} name={app.siteLabel(hostOf(run))} className="size-5 text-[10px]" />
        <button onClick={() => go(routes.run(run.id))} className="truncate text-sm font-medium hover:underline" title={hostOf(run)}>{app.siteLabel(hostOf(run))}</button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm">SEO plan</span>
        <span className="flex-1" />
        {running && <button onClick={() => go(routes.run(run.id))} className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"><Spinner className="size-3" />Planning {seoProgress?.percent || 0}%</button>}
        <div className="hidden items-center gap-2 lg:flex" title="SEO changes done across all pages">
          <Bar value={tot.tasks ? (100 * tot.done) / tot.tasks : 0} className="w-28" />
          <span className="text-xs whitespace-nowrap text-muted-foreground"><b className="font-medium text-foreground tabular">{tot.done}</b> / {tot.tasks} done</span>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" size="sm" onClick={checkLive} disabled={checking || running} />}>
            {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} {checking ? "Checking…" : "Check live site"}
          </TooltipTrigger>
          <TooltipContent>{seoState.verify ? `Last checked ${ago(seoState.verify.at)}. ` : ""}Reads each page’s title, description and URL and ticks off the changes that are live. Runs on your Mac, no AI.</TooltipContent>
        </Tooltip>
        <Button variant="outline" size="sm" onClick={copyForClient} disabled={!tot.tasks}><MessageSquareText /> Copy for the client</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={seoCsvUrl(run.id)} download />}><Download /> Export</Button>
      </TopBar>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <Header />
          <div className="mt-8 mb-3 flex items-center gap-3">
            <div role="group" aria-label="Show" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
              {(["all", "todo", "done"] as const).map((k) => (
                <button key={k} aria-pressed={filter === k} onClick={() => go(routes.seo(run.id, k === "all" ? undefined : k))} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", filter === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                  {k === "all" ? "All pages" : k === "todo" ? "To do" : "Done"}<span className="text-xs font-normal text-muted-foreground tabular">{counts[k]}</span>
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <span className="text-[12.5px] text-muted-foreground">Click a new title or description to change its wording.</span>
          </div>
          <div className="grid gap-3">
            {shown.map((p) => <PageCard key={p.id} page={p} state={seoState} focus={focus === p.id} save={save} />)}
            {!shown.length && <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{filter === "todo" ? "Everything in the plan is done." : filter === "done" ? "Nothing is done yet." : "No pages planned."}</p>}
            {filter === "all" && seo.pages.filter((p) => !p.planned).map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">{running ? <Spinner className="size-3.5" /> : null}<span className="font-medium text-foreground/70">{p.name}</span><span>{p.path}</span><span className="flex-1" />{running ? "Planning" : "Not planned"}</div>
            ))}
          </div>
          <HowTo platform={seo.site.platform} />
        </div>
      </div>
    </div>
  )
}

function Header() {
  const { run, seo, seoState } = useRun()
  const { status } = useApp()
  const R = seo!, s = run!.seo!.settings, j = run!.seo!.job, edits = seoState.edits
  const planned = R.pages.filter((p) => p.planned)
  const all = planned.flatMap((p) => SEO.tasks(p, edits))
  const tot = SEO.counts(planned, seoState.done, edits)
  const n = (f: string) => all.filter((t) => t.field === f).length
  const site = SEO.siteChecks(R.pages, edits).filter((c) => !c.ok)
  const stats: [React.ReactNode, string][] = [[n("title"), n("title") === 1 ? "new title" : "new titles"], [n("description"), n("description") === 1 ? "new description" : "new descriptions"], [n("slug"), n("slug") === 1 ? "URL change, with a redirect" : "URL changes, with redirects"], [`${tot.tasks ? Math.round((100 * tot.done) / tot.tasks) : 0}%`, "done"]]
  return (
    <div>
      <Tag tone="muted">SEO plan</Tag>
      <h1 className="mt-2 text-3xl font-medium">{R.site.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {plural(planned.length, "page")}, planned {ago(j.ended || run!.updated || Date.now())} with {status?.catalog[s.engine].name} {modelName(status, s.engine, s.model)}, {status?.effort[s.effort]?.name.toLowerCase() || s.effort} effort. {R.site.keywordsFrom === "headings" ? "Keywords come from the heading plan, so titles and H1s target the same words." : "The AI chose the keywords from each page’s content. They’re unverified: no keyword tool is connected."}
      </p>
      {R.warnings.length > 0 && <div className="mt-4 rounded-xl border border-brand/40 p-3 text-sm">{R.warnings.join(" ")}</div>}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
        {stats.map(([v, l]) => <div key={l} className="bg-card p-4"><div className="text-3xl font-medium tracking-tight tabular">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}
      </div>
      {(site.length > 0 || R.notes.length > 0) && (
        <ul className="mt-4 grid gap-2.5 rounded-2xl border bg-card p-4 text-sm">
          {site.map((c) => <li key={c.text} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2.5"><X className="mt-0.5 size-4 text-brand" />{c.text}</li>)}
          {R.notes.map((x) => <li key={x} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2.5 text-foreground/80"><span className="mt-2 size-1.5 justify-self-center rounded-full bg-muted-foreground/60" />{x}</li>)}
        </ul>
      )}
    </div>
  )
}

function PageCard({ page: p, state, focus, save }: { page: SPage; state: SeoState; focus: boolean; save: (b: { set?: Record<string, boolean>; edits?: Record<string, string | null> }) => void }) {
  const { seo } = useRun()
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (focus) ref.current?.scrollIntoView({ block: "start" }) }, [focus])
  const edits = state.edits
  const T = SEO.tasks(p, edits)
  const done = T.filter((t) => state.done[t.key]).length
  const fails = SEO.pageChecks(p, edits).filter((c) => !c.ok)
  const url = seo!.site.url.replace(/\/$/, "") + p.path
  const v = state.verify?.pages?.[p.id]?.rows
  const slugChange = SEO.changed(p, "slug", edits)
  // Pages the plan leaves alone stay folded, so the list is mostly work to do.
  const [open, setOpen] = React.useState(T.length > 0 || focus)
  React.useEffect(() => { if (focus) setOpen(true) }, [focus])
  return (
    <section ref={ref} className={cn("overflow-hidden rounded-2xl border bg-card", focus && "ring-2 ring-brand/30")}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 className="text-[15px] font-medium">{p.name}</h2>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{p.path}<ExternalLink className="size-3" /></a>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {p.keyword ? <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand-ink"><KeyRound className="size-3" />{p.keyword}</span> : <Tag tone="muted">No target keyword</Tag>}
            {p.pattern && <Tag tone="muted">CMS template: applies to every {p.collection} item</Tag>}
            {p.h1 && <span className="min-w-0 truncate text-xs text-muted-foreground">H1: {p.h1}</span>}
          </div>
        </div>
        {T.length ? <span className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground tabular"><Ring done={done} total={T.length} />{done} of {T.length}</span>
          : <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground hover:text-foreground">Already right<ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} /></button>}
      </header>
      {open && fails.length > 0 && (
        <div className="grid gap-1 border-t bg-muted/30 px-4 py-2 text-[12.5px]">
          {fails.map((c) => <span key={c.text} className={cn("flex items-center gap-1.5", c.info ? "text-muted-foreground" : "text-brand-ink")}><X className="size-3.5" />{c.text}</span>)}
        </div>
      )}
      {open && (
        <div className="border-t">
          {(["title", "description", "slug"] as SeoFieldId[]).map((f) => <FieldRow key={f} page={p} field={f} state={state} verified={v?.[`${p.id}|${f}`]} save={save} />)}
          {slugChange && !p.pattern && <RedirectRow page={p} state={state} verified={v?.[`${p.id}|redirect`]} save={save} />}
          <GooglePreview page={p} edits={edits} url={url} site={seo!.site.name} />
        </div>
      )}
      {p.notes.length > 0 && <ul className="grid gap-1 border-t px-4 py-2.5 pl-[135px] text-[13px] text-foreground/75">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </section>
  )
}

// How the page would look in Google with the new wording. Google cuts titles near 60 characters and
// descriptions near 155, at a word where it can.
const cut = (t: string, n: number) => { if (t.length <= n) return t; const x = t.slice(0, n); const i = x.lastIndexOf(" "); return (i > n * 0.6 ? x.slice(0, i) : x).replace(/[\s,.;:|-]+$/, "") + " …" }
function GooglePreview({ page: p, edits, url, site }: { page: SPage; edits: SeoState["edits"]; url: string; site: string }) {
  const title = SEO.value(p, "title", edits), desc = SEO.value(p, "description", edits)
  let host = "", crumbs: string[] = []
  try { const u = new URL(url); host = u.hostname.replace(/^www\./, ""); crumbs = SEO.normPath(SEO.value(p, "slug", edits)).split("/").filter(Boolean) } catch { /* not a URL */ }
  return (
    <div className={cn(ROW, "border-b border-border/60 bg-muted/20 px-4 py-3 last:border-b-0")}>
      <span />
      <span className="pt-px text-[13px] text-muted-foreground">In Google</span>
      <div className="grid min-w-0 max-w-[600px] gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{site} <span className="text-muted-foreground/70">· {[host, ...crumbs].join(" › ")}</span></span>
        <span className="text-[16px] leading-snug">{p.pattern && /\{/.test(title) ? title : cut(title, 60)}</span>
        <span className="text-[13px] leading-relaxed text-muted-foreground">{desc ? (p.pattern && /\{/.test(desc) ? desc : cut(desc, 155)) : "Google writes its own snippet from the page when there’s no description."}</span>
      </div>
      <span /><span />
    </div>
  )
}

function Verified({ state, k, v }: { state: SeoState; k: string; v?: "done" | "todo" }) {
  if (!v) return null
  if (v === "done") return <Tag tone="solid"><Check className="size-3" />On the live site</Tag>
  return state.done[k] ? null : <Tag tone="brand">Not on the live site yet</Tag>
}

function FieldRow({ page: p, field: f, state, verified, save }: { page: SPage; field: SeoFieldId; state: SeoState; verified?: "done" | "todo"; save: (b: { set?: Record<string, boolean>; edits?: Record<string, string | null> }) => void }) {
  const edits = state.edits, k = `${p.id}|${f}`
  const val = SEO.value(p, f, edits), cur = p.fields[f].cur
  const change = SEO.changed(p, f, edits), mine = SEO.edited(p, f, edits)
  const done = !!state.done[k]
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(val)
  const limit = f === "slug" ? 0 : SEO.LIMIT[f]
  const len = (editing ? draft : val).length
  const shown = f === "slug" ? SEO.normPath(val) : val
  // Webflow's slug field takes the last part of the URL only.
  const copyText = f === "slug" ? SEO.normPath(val).split("/").pop() || "" : val
  const commit = () => {
    const x = f === "slug" ? SEO.normPath(draft) : SEO.norm(draft)
    setEditing(false)
    if (x === SEO.value(p, f, {})) save({ edits: { [k]: null } })
    else if (x !== val) save({ edits: { [k]: x } })
  }
  const canEdit = !p.pattern || f !== "slug"
  return (
    <div className={cn(ROW, "group border-b border-border/60 px-4 py-2.5 last:border-b-0")}>
      {change ? <Checkbox checked={done} onCheckedChange={(x) => save({ set: { [k]: !!x } })} className="mt-0.5" aria-label={`Mark the ${LABEL[f].toLowerCase()} done`} /> : <span className="mt-2 size-1.5 justify-self-center rounded-full bg-input" />}
      <span className="pt-px text-[13px] text-muted-foreground">{LABEL[f]}</span>
      <div className="min-w-0">
        {editing ? (
          <div className="grid gap-2">
            <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={f === "description" ? 3 : 1} className="min-h-0 text-sm" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit() } if (e.key === "Escape") setEditing(false) }} />
            <div className="flex items-center gap-2"><Button size="xs" onClick={commit}>Save</Button><Button size="xs" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><span className="text-xs text-muted-foreground">Enter saves, Esc cancels</span></div>
          </div>
        ) : change ? (
          <>
            <button disabled={!canEdit} onClick={() => { setDraft(shown); setEditing(true) }} className={cn("block w-full rounded text-left text-sm leading-relaxed", canEdit && "hover:bg-muted/60", done && "text-muted-foreground")}>{shown}</button>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{f === "slug" ? <>Was {cur}</> : cur ? <>Was: {cur}</> : "There isn’t one now."}</p>
            {p.why[f] && !mine && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{p.why[f]}</p>}
          </>
        ) : (
          <button disabled={!canEdit} onClick={() => { setDraft(shown); setEditing(true) }} className={cn("block w-full rounded text-left text-sm leading-relaxed text-muted-foreground", canEdit && "hover:bg-muted/60")}>{shown || "None"} <span className="ml-1 text-xs">no change</span></button>
        )}
        {(mine || verified) && !editing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {mine && <Tag tone="muted">Your wording</Tag>}
            {mine && <button onClick={() => save({ edits: { [k]: null } })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" />Use the plan’s</button>}
            {change && <Verified state={state} k={k} v={verified} />}
          </div>
        )}
      </div>
      <span className={cn("pt-0.5 text-right text-xs tabular", limit && len > limit ? "text-destructive" : "text-muted-foreground")} title={limit ? `Google shows about ${limit} characters` : undefined}>{limit ? <>{len}<span className="text-muted-foreground/60"> / {limit}</span></> : ""}</span>
      <span className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100">
        {canEdit && !editing && <Button variant="ghost" size="icon-xs" onClick={() => { setDraft(shown); setEditing(true) }} aria-label={`Change the ${LABEL[f].toLowerCase()}`}><Pencil /></Button>}
        {copyText && !editing && <Button variant="ghost" size="icon-xs" onClick={() => { navigator.clipboard.writeText(copyText); toast("Copied", { description: f === "slug" ? `“${copyText}”, the part Webflow’s slug field takes` : undefined, duration: 1400 }) }} aria-label={`Copy the ${LABEL[f].toLowerCase()}`}><Copy /></Button>}
      </span>
    </div>
  )
}

function RedirectRow({ page: p, state, verified, save }: { page: SPage; state: SeoState; verified?: "done" | "todo"; save: (b: { set?: Record<string, boolean> }) => void }) {
  const k = `${p.id}|redirect`, done = !!state.done[k]
  const from = p.fields.slug.cur, to = SEO.normPath(SEO.value(p, "slug", state.edits))
  return (
    <div className={cn(ROW, "group border-b border-border/60 px-4 py-2.5 last:border-b-0")}>
      <Checkbox checked={done} onCheckedChange={(x) => save({ set: { [k]: !!x } })} className="mt-0.5" aria-label="Mark the redirect done" />
      <span className="pt-px text-[13px] text-muted-foreground">Redirect</span>
      <div className="min-w-0">
        <p className={cn("text-sm", done && "text-muted-foreground")}>301 from {from} to {to}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">So links and rankings on the old address carry over.</p>
        {verified && <div className="mt-1.5"><Verified state={state} k={k} v={verified} /></div>}
      </div>
      <span />
      <span className="flex justify-end opacity-60 group-hover:opacity-100">
        <Button variant="ghost" size="icon-xs" onClick={() => { navigator.clipboard.writeText(from); toast("Copied the old path", { duration: 1400 }) }} aria-label="Copy the old path"><Copy /></Button>
      </span>
    </div>
  )
}

const HOWTO: Record<string, string[]> = {
  Webflow: [
    "Titles and descriptions: open the page’s settings (the gear beside it in the Pages panel), then SEO settings. Paste the title into Title tag and the description into Meta description.",
    "URLs: in the same settings, change Slug under General. It takes only the last part of the address.",
    "CMS templates: open the collection template’s settings. Build the title and description from the collection’s fields there.",
    "Redirects: Site settings, Publishing, 301 redirects. Add the old path and the new one, then publish.",
  ],
  WordPress: ["With Yoast or Rank Math, the SEO title and meta description are in the SEO box under the editor. The slug is in the page’s Permalink setting.", "Redirects need a plugin such as Redirection, or your SEO plugin’s redirect manager."],
  Other: ["Set the title tag and meta description in the page’s SEO settings, and the URL in its slug setting.", "Add a 301 redirect from each old URL to its new one."],
}
function HowTo({ platform }: { platform: string }) {
  return (
    <details className="mt-10 rounded-2xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">How to make these changes in {HOWTO[platform] ? platform : "your site builder"}</summary>
      <ol className="mt-3 grid list-decimal gap-2 pl-5 text-foreground/85">{(HOWTO[platform] || HOWTO.Other!).map((x) => <li key={x}>{x}</li>)}</ol>
    </details>
  )
}
