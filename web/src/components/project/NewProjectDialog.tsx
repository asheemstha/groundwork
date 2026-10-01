import * as React from "react"
import { ChevronRight, FileText, Layers, Loader2 } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { DateField } from "@/components/common/DateField"
import { PLATFORMS, stagingExample, type PlatformId } from "@/lib/platforms"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/hooks/useApp"
import { api, type BriefResult, type ChecklistTemplate, type TemplateSummary } from "@/lib/api"
import { go, routes } from "@/lib/router"
import { SERVICES } from "@/lib/services"

type Detail = { name?: string; old?: string; audit?: boolean; template?: string; platform?: PlatformId }
/** Open the New project dialog from anywhere: a website project, or an audit of one site (`audit`). */
export const newProject = (detail?: Detail) => window.dispatchEvent(new CustomEvent("gw:new-project", { detail: detail || {} }))

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
// Optional parts that start switched off. "existing", "moving" and "domain" follow the site fields instead.
const OFF_BY_DEFAULT = ["languages", "payments", "existing", "local", "moving", "domain", "ads"]
const hostOf = (u: string) => { try { return new URL(/^https?:/i.test(u) ? u : "https://" + u.trim()).hostname.replace(/^www\./, "") } catch { return "" } }

export function NewProjectDialog() {
  const { refreshRuns, prefs, setPrefs, status } = useApp()
  const [open, setOpen] = React.useState(false)
  const [audit, setAudit] = React.useState(false)
  // First "What are you starting?", then the details.
  const [step, setStep] = React.useState<"pick" | "details">("pick")
  const [name, setName] = React.useState("")
  const [sites, setSites] = React.useState({ old: "", staging: "", live: "" })
  const [clientName, setClientName] = React.useState("")
  const [kickoff, setKickoff] = React.useState(addDays(7))
  const [launch, setLaunch] = React.useState(addDays(77))
  const [list, setList] = React.useState<TemplateSummary[]>([])
  const [tid, setTid] = React.useState("")
  const [tpl, setTpl] = React.useState<ChecklistTemplate | null>(null)
  const [parts, setParts] = React.useState<string[]>([])
  const [startAt, setStartAt] = React.useState("")
  const [platform, setPlatform] = React.useState<PlatformId | "">("")
  const [pickedPlatform, setPickedPlatform] = React.useState(false)
  // "Replacing an existing website" follows the Old site field until it's switched by hand.
  const [touched, setTouched] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  // A pasted brief fills in the details, and with AI suggests items the checklist doesn't have yet.
  const [briefOpen, setBriefOpen] = React.useState(false)
  const [brief, setBrief] = React.useState("")
  const [reading, setReading] = React.useState<"" | "ai" | "plain">("")
  const [found, setFound] = React.useState<BriefResult | null>(null)
  const [keep, setKeep] = React.useState<Set<number>>(new Set())
  const aiReady = !!(status?.engines.claude?.loggedIn || status?.engines.codex?.loggedIn)
  // The checklists for what you do come first; the 140-item Full agency process stays out of the way unless asked for.
  const [showAll, setShowAll] = React.useState(false)
  const firstIds = SERVICES.filter((x) => (prefs.services || []).includes(x.id)).flatMap((x) => x.templates)
  const hide = (t: TemplateSummary) => t.id === "website" && !showAll && !prefs.allChecklists && prefs.template !== "website"
  const rank = (t: TemplateSummary) => (firstIds.includes(t.id) ? firstIds.indexOf(t.id) : 100 + list.indexOf(t))
  const shown = list.filter((t) => !hide(t)).sort((a, b) => rank(a) - rank(b))
  const hiddenCount = list.length - shown.length

  React.useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail || {}
      setAudit(!!d.audit); setStep(d.audit || d.template ? "details" : "pick"); setName(d.name || ""); setSites({ old: d.old || "", staging: "", live: "" }); setClientName(""); setBusy(false)
      setKickoff(addDays(7)); setLaunch(addDays(77)); setStartAt(""); setTouched(false); setPlatform(d.platform || ""); setPickedPlatform(!!d.platform); setShowAll(false)
      setBriefOpen(false); setBrief(""); setFound(null); setKeep(new Set())
      api.templates().then((l) => {
        const c = l.filter((t) => t.kind === "checklist"); setList(c)
        setTid((t) => c.find((x) => x.id === d.template)?.id || (c.some((x) => x.id === t) ? t : c.find((x) => x.id === prefs.template)?.id || c[0]?.id || ""))
      }).catch(() => {})
      setOpen(true)
    }
    window.addEventListener("gw:new-project", on)
    return () => window.removeEventListener("gw:new-project", on)
  }, [prefs.template])
  React.useEffect(() => {
    if (!tid) return
    api.template(tid).then((t) => {
      if (t.kind !== "checklist") return
      setTpl(t); setStartAt(""); setTouched(false); setFound(null) // suggested items belong to the template's phases
      setParts(t.parts.map((p) => p.id).filter((id) => !OFF_BY_DEFAULT.includes(id)))
      // Each template has its own usual length: three weeks for a landing page, a month for a care plan.
      setLaunch(addDays(7 + (t.refSpan || 70)))
    }).catch(() => {})
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasOld = !!sites.old.trim()
  // A staging address like *.webflow.io or *.myshopify.com says which platform it is.
  React.useEffect(() => {
    if (pickedPlatform) return
    const h = (() => { try { return new URL(/^https?:/i.test(sites.staging) ? sites.staging : "https://" + sites.staging.trim()).hostname } catch { return "" } })()
    const hit = PLATFORMS.find((p) => p.staging.some((r) => new RegExp(r, "i").test(h)))
    setPlatform(hit ? hit.id : "")
  }, [sites.staging, pickedPlatform])
  // Parts that follow the site fields until switched by hand: an old site means old content to move; an old site on a
  // different domain from the live one means a domain change.
  const moved = hasOld && !!sites.live.trim() && hostOf(sites.old) !== hostOf(sites.live)
  React.useEffect(() => {
    if (touched || !tpl) return
    const want: Record<string, boolean> = { existing: hasOld, moving: hasOld, domain: moved }
    setParts((x) => { let n = x; for (const [id, on] of Object.entries(want)) { if (!tpl.parts.some((p) => p.id === id)) continue; n = on ? (n.includes(id) ? n : [...n, id]) : n.filter((y) => y !== id) } return n })
  }, [hasOld, moved, touched, tpl])

  const counts = React.useMemo(() => {
    if (!tpl) return null
    const every = tpl.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items])
    const items = every.filter((it) => (!it.part || parts.includes(it.part)) && (!it.platforms?.length || (!!platform && it.platforms.includes(platform))))
    return { total: items.length, client: items.filter((i) => i.who === "client").length, tools: items.filter((i) => i.tool).length, phases: tpl.phases.length, byPart: (id: string) => every.filter((it) => it.part === id).length }
  }, [tpl, parts, platform])

  const readBrief = async (useAi: boolean) => {
    if (!brief.trim()) return toast.error("Paste the brief or your kickoff notes first.")
    setReading(useAi ? "ai" : "plain")
    try {
      const r = await api.brief({ text: brief, templateId: tid, useAi })
      if (r.name) setName(r.name)
      if (r.clientName) setClientName(r.clientName)
      setSites((x) => ({ old: r.sites.old || x.old, staging: r.sites.staging || x.staging, live: r.sites.live || x.live }))
      if (r.platform) { setPlatform(r.platform); setPickedPlatform(true) }
      if (r.kickoff) setKickoff(r.kickoff)
      if (r.launch) setLaunch(r.launch)
      if (r.parts) { setParts(r.parts); setTouched(true) }
      setFound(r); setKeep(new Set(r.items.map((_, i) => i)))
      const filled = [r.name, r.clientName, r.sites.old, r.sites.staging, r.sites.live, r.platform, r.kickoff, r.launch].filter(Boolean).length
      toast(filled || r.items.length ? "Filled in from the brief" : "Nothing to fill in", { description: filled || r.items.length ? `${filled} ${filled === 1 ? "detail" : "details"}${r.items.length ? `, ${r.items.length} suggested ${r.items.length === 1 ? "item" : "items"}` : ""}. Check them below.` : r.ai ? "The brief didn’t mention a name, addresses or dates." : "Without AI, only web addresses and dates written like 2026-11-02 are read." })
    } catch (e) { toast.error((e as Error).message) } finally { setReading("") }
  }
  const create = async () => {
    const s = { old: sites.old.trim(), staging: sites.staging.trim(), live: sites.live.trim() }
    if (audit && !s.live) return toast.error("Add the address of the site to audit.")
    if (!audit && !name.trim() && !s.old && !s.staging && !s.live) return toast.error("Give the project a name or a website.")
    setBusy(true)
    try {
      const r = audit
        ? await api.createProject({ kind: "audit", name: name.trim(), sites: { live: s.live } })
        : await api.createProject({ name: name.trim(), sites: s, platform: platform || null, templateId: tid, kickoff, launch, parts, clientName, startAt: startAt || undefined, extraItems: found?.items.filter((_, i) => keep.has(i)) })
      if (!audit) { setPrefs({ template: tid }); api.savePrefs({ template: tid }).catch(() => {}) }
      await refreshRuns()
      setOpen(false)
      go(routes.project(r.id, audit ? "site" : undefined))
      if (r.runId) toast(audit ? "Scanning the site" : "Scanning the old site", { description: audit ? "Runs on your Mac. Plans and checks start from the scan." : "The “Crawl the current site” item ticks itself when it’s done." })
    } catch (e) { toast.error((e as Error).message); setBusy(false) }
  }
  // A project exported from another Groundwork: a zip with its checklist, files, scans and plans.
  const importFile = (f?: File) => {
    if (!f) return
    if (f.size > 800e6) return toast.error("That file is over 800 MB.")
    setBusy(true)
    const r = new FileReader()
    r.onload = async () => {
      try {
        const x = await api.importProject(String(r.result).split(",")[1] || "")
        await refreshRuns(); setOpen(false); go(routes.project(x.id))
        toast.success(`Imported ${x.name}`, { description: x.runs ? `With ${x.runs} ${x.runs === 1 ? "scan" : "scans"}.` : undefined })
      } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
    }
    r.readAsDataURL(f)
  }
  const card = (t: TemplateSummary) => (
    <button key={t.id} onClick={() => { setAudit(false); setTid(t.id); setStep("details") }} className="grid content-start gap-1 rounded-xl border bg-card px-4 py-3.5 text-left hover:border-foreground/25 hover:bg-muted/30 focus-visible:border-foreground/40">
      <span className="flex items-center gap-2 font-medium">{t.name}{t.id === prefs.template && <span className="tag-label">Last used</span>}</span>
      {t.desc && <span className="line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">{t.desc}</span>}
      <span className="mt-1 truncate text-[12px] text-muted-foreground/80">{t.items} items{t.repeat ? ", repeats monthly" : ""}{t.basedOn?.[0]?.url ? ` · Based on ${t.basedOn[0].label.replace(/:.*/, "")}` : ""}</span>
    </button>
  )
  // Work with no website (a brand, an ad setup) skips the site fields; a site can be added from the project later.
  const noSite = tpl?.website === false
  const site = (k: "old" | "staging" | "live", label: string, hint: string, placeholder: string) => (
    <label className="grid content-start gap-1.5 text-[13px] font-medium">
      <span>{label} <span className="font-normal text-muted-foreground">{hint}</span></span>
      <Input value={sites[k]} onChange={(e) => setSites((x) => ({ ...x, [k]: e.target.value }))} placeholder={placeholder} className="font-normal" />
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-[640px]">
        {step === "pick" ? (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>What are you starting?</DialogTitle>
              <DialogDescription>Each checklist is written from public guidance and works on any platform. You can change anything once the project exists.</DialogDescription>
            </DialogHeader>
            <div className="scrollbar-thin grid max-h-[66vh] grid-cols-1 gap-2.5 overflow-auto px-6 py-5 sm:grid-cols-2">
              {shown.filter((t) => t.website !== false).map(card)}
              <button onClick={() => { setAudit(true); setStep("details") }} className="grid content-start gap-1 rounded-xl border border-dashed px-4 py-3.5 text-left hover:border-foreground/25 hover:bg-muted/30">
                <span className="font-medium">Check a site</span>
                <span className="text-[12.5px] leading-snug text-muted-foreground">Scan one site and check it, with no checklist: a verdict and the problems worst first, as a PDF for the client.</span>
              </button>
              {shown.some((t) => t.website === false) && <h3 className="mt-3 text-[13px] font-medium text-muted-foreground sm:col-span-2">Other client work <span className="font-normal">· no website needed, add one later if the work includes a site</span></h3>}
              {shown.filter((t) => t.website === false).map(card)}
              {hiddenCount > 0 && <button onClick={() => setShowAll(true)} className="text-left text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground sm:col-span-2">Also show the Full agency process, the long one with 140 items</button>}
            </div>
            <div className="flex items-center gap-2 border-t px-6 py-3.5 text-[13px] text-muted-foreground">
              <span className="flex-1">Moving a project from another Mac?</span>
              <label className="cursor-pointer rounded-md px-2 py-1 text-foreground underline underline-offset-2 hover:bg-muted/60">
                <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
                {busy ? "Importing…" : "Import a project file"}
              </label>
            </div>
          </>
        ) : (
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">{audit ? "Check a site" : tpl?.name || "New project"}<Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setStep("pick")}>Change</Button></DialogTitle>
          <DialogDescription>{audit ? "Scan one site and check it, with no checklist, for a verdict you can send as a PDF. You can start a full project for it later." : tpl?.desc || "A checklist, phase by phase. Anything you change stays in this project."}</DialogDescription>
          {!audit && !!tpl?.basedOn?.filter((b) => b.url).length && <p className="text-[12px] text-muted-foreground">Based on {tpl.basedOn.filter((b) => b.url).map((b, i) => <React.Fragment key={b.url}>{i > 0 && ", "}<a href={b.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{b.label}</a></React.Fragment>)}</p>}
        </DialogHeader>
        )}
        {step === "pick" ? null : audit ? (
          <div className="grid gap-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              {site("live", "Site to check", "", "client-site.com")}
              <label className="grid content-start gap-1.5 text-[13px] font-medium"><span>Name <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Dental" className="font-normal" /></label>
            </div>
            <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground"><span className="mt-px grid size-4 shrink-0 place-items-center rounded bg-brand text-brand-foreground"><Layers className="size-2.5" strokeWidth={2.6} /></span>The scan runs on your Mac and doesn’t use AI. From it you can run the launch check, the heading plan and the SEO plan.</p>
          </div>
        ) : (
          <div className="scrollbar-thin grid max-h-[64vh] gap-4 overflow-auto px-6 py-5">
            <div className="rounded-xl border bg-muted/30">
              <button onClick={() => setBriefOpen(!briefOpen)} aria-expanded={briefOpen} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px]">
                <FileText className="size-4 text-muted-foreground" /><span className="font-medium">Start from a brief</span><span className="flex-1 truncate text-[12.5px] text-muted-foreground">{found ? `Filled in${found.ai ? " with AI" : ""}. Check the details below.` : "optional: paste it and the details fill in"}</span>
                <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", briefOpen && "rotate-90")} />
              </button>
              {briefOpen && (
                <div className="grid gap-2.5 border-t px-3.5 py-3">
                  <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} placeholder="Paste the brief, the proposal or your kickoff notes." className="bg-card text-[13.5px]" />
                  <div className="flex flex-wrap items-center gap-2">
                    {aiReady && <Button size="sm" onClick={() => readBrief(true)} disabled={!!reading}>{reading === "ai" && <Loader2 className="animate-spin" />}Fill in with AI</Button>}
                    <Button size="sm" variant={aiReady ? "ghost" : "outline"} onClick={() => readBrief(false)} disabled={!!reading}>{reading === "plain" && <Loader2 className="animate-spin" />}Fill in without AI</Button>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">{aiReady ? "With AI, the brief goes to Anthropic (Claude) or OpenAI (ChatGPT) through your own account, and nothing else does. It fills in the name, contact, addresses, platform and dates, and suggests items the checklist doesn’t have. Without AI, only web addresses and dates are read, on this Mac." : "Reads web addresses and dates on this Mac. Sign in to Claude Code or Codex in Settings to fill in everything and get suggested items."}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-[13px] font-medium">Client or project name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Dental" autoFocus className="font-normal" /></label>
              <label className="grid gap-1.5 text-[13px] font-medium"><span>Client contact <span className="font-normal text-muted-foreground">(for messages)</span></span><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Dana Whitfield" className="font-normal" /></label>
            </div>
            {!noSite && <>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-3">
                {site("old", "Old site", tid === "website-new" ? "(if there is one)" : "(if replacing one)", "old-site.com")}
                {site("staging", "Staging", "(optional)", stagingExample(platform))}
                {site("live", "Live domain", "(optional)", "client-site.com")}
              </div>
              <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground"><span className="mt-px grid size-4 shrink-0 place-items-center rounded bg-brand text-brand-foreground"><Layers className="size-2.5" strokeWidth={2.6} /></span>{hasOld ? "Groundwork scans the old site on your Mac, with no AI, and ticks “Crawl the current site” when it’s done. " : ""}Launch checks and redirect tests only tick items when they run on the live domain. Add any of these later.</p>
            </div>
            <label className="grid gap-1.5 text-[13px] font-medium">Built with
              <select value={platform} onChange={(e) => { setPickedPlatform(true); setPlatform(e.target.value as PlatformId | "") }} className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal">
                <option value="">Not sure yet (the first scan fills it in)</option>
                {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            </>}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5 text-[13px] font-medium">{tpl?.labels?.kickoff || "Kickoff"}<DateField boxed value={kickoff} onChange={(v) => v && setKickoff(v)} /></div>
              <div className="grid gap-1.5 text-[13px] font-medium">{tpl?.labels?.launch || "Target launch"}<DateField boxed value={launch} onChange={(v) => v && setLaunch(v)} /></div>
            </div>
            {tpl && tpl.phases.length > 1 && (
              <label className="flex items-center gap-3 text-[13px]">
                <span className="font-medium">Already underway?</span>
                <select value={startAt} onChange={(e) => setStartAt(e.target.value)} className="h-8 rounded-lg border border-input bg-card px-2 text-[13px]">
                  <option value="">Start from the beginning</option>
                  {tpl.phases.slice(1).map((ph) => <option key={ph.id} value={ph.id}>Start at {ph.name}</option>)}
                </select>
                {startAt && <span className="text-[12.5px] text-muted-foreground">Earlier phases are marked done and signed off.</span>}
              </label>
            )}
            {tpl && tpl.parts.length > 0 && (
              <div className="grid gap-2">
                <div className="flex items-baseline gap-2"><span className="text-[13px] font-medium">What this project includes</span><span className="text-[12.5px] text-muted-foreground">switches parts of the checklist on or off</span></div>
                <div className="overflow-hidden rounded-xl border bg-card">
                  {tpl.parts.map((p) => (
                    <label key={p.id} className="grid cursor-pointer grid-cols-[minmax(0,1fr)_64px_auto] items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0">
                      <span className="grid gap-0.5"><span className="text-[13.5px]">{p.name}</span>{p.desc && <span className="text-[12.5px] text-muted-foreground">{p.desc}</span>}</span>
                      <span className="text-right text-xs text-muted-foreground tabular">{counts?.byPart(p.id)} {counts?.byPart(p.id) === 1 ? "item" : "items"}</span>
                      <Switch checked={parts.includes(p.id)} onCheckedChange={(v) => { if (["existing", "moving", "domain"].includes(p.id)) setTouched(true); setParts((x) => (v ? [...x, p.id] : x.filter((y) => y !== p.id))) }} />
                    </label>
                  ))}
                </div>
              </div>
            )}
            {!!found?.items.length && (
              <div className="grid gap-2">
                <div className="flex items-baseline gap-2"><span className="text-[13px] font-medium">Suggested from the brief</span><span className="text-[12.5px] text-muted-foreground">ticked ones are added to their phase</span></div>
                <div className="overflow-hidden rounded-xl border bg-card">
                  {found.items.map((it, i) => (
                    <label key={i} className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 border-b px-3.5 py-2.5 last:border-b-0">
                      <Checkbox checked={keep.has(i)} onCheckedChange={(v) => setKeep((x) => { const n = new Set(x); if (v) n.add(i); else n.delete(i); return n })} className="mt-0.5" />
                      <span className="grid gap-0.5"><span className="text-[13.5px]">{it.title}</span>{it.done && <span className="text-[12.5px] text-muted-foreground">{it.done}</span>}</span>
                      <span className="text-right text-xs whitespace-nowrap text-muted-foreground">{it.who === "client" ? "Client, " : ""}{tpl?.phases.find((ph) => ph.id === it.phase)?.name || ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {counts && (
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg bg-muted/60 px-3.5 py-2.5 text-[13px] text-muted-foreground">
                <span><b className="font-medium text-foreground tabular">{counts.total + (found?.items.filter((_, i) => keep.has(i)).length || 0)}</b> items in {counts.phases} phases</span><span className="h-3.5 w-px bg-input" />
                <span><b className="font-medium text-foreground tabular">{counts.client}</b> from the client</span>
                {counts.tools > 0 && <><span className="h-3.5 w-px bg-input" /><span><b className="font-medium text-foreground tabular">{counts.tools}</b> Groundwork can help with</span></>}
              </div>
            )}
          </div>
        )}
        {step === "details" && (
          <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
            <span className="mr-auto text-[12.5px] text-muted-foreground">{audit ? "Free: scans and checks don’t use AI." : tpl?.repeat ? "Due dates fit the month. Close the month and it starts again." : "Due dates stretch to fit between the two dates. You can move any of them."}</span>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy || (!audit && !tid)}>{busy && <Loader2 className="animate-spin" />}{audit ? "Scan and audit" : "Create project"}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
