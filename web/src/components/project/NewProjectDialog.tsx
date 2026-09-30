import * as React from "react"
import { cn } from "cn"
import { Layers, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/hooks/useApp"
import { api, type ChecklistTemplate, type TemplateSummary } from "@/lib/api"
import { go, routes } from "@/lib/router"

type Detail = { name?: string; old?: string; audit?: boolean; template?: string }
/** Open the New project dialog from anywhere: a website project, or an audit of one site (`audit`). */
export const newProject = (detail?: Detail) => window.dispatchEvent(new CustomEvent("gw:new-project", { detail: detail || {} }))

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const OFF_BY_DEFAULT = ["languages", "payments", "existing"]

export function NewProjectDialog() {
  const { refreshRuns, prefs, setPrefs } = useApp()
  const [open, setOpen] = React.useState(false)
  const [audit, setAudit] = React.useState(false)
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
  // "Replacing an existing website" follows the Old site field until it's switched by hand.
  const [touched, setTouched] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail || {}
      setAudit(!!d.audit); setName(d.name || ""); setSites({ old: d.old || "", staging: "", live: "" }); setClientName(""); setBusy(false)
      setKickoff(addDays(7)); setLaunch(addDays(77)); setStartAt(""); setTouched(false)
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
    api.template(tid).then((t) => { if (t.kind === "checklist") { setTpl(t); setStartAt(""); setParts(t.parts.map((p) => p.id).filter((id) => !OFF_BY_DEFAULT.includes(id) || (id === "existing" && !!sites.old.trim()))) } }).catch(() => {})
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasOld = !!sites.old.trim()
  React.useEffect(() => {
    if (touched || !tpl?.parts.some((p) => p.id === "existing")) return
    setParts((x) => (hasOld ? (x.includes("existing") ? x : [...x, "existing"]) : x.filter((y) => y !== "existing")))
  }, [hasOld, touched, tpl])

  const counts = React.useMemo(() => {
    if (!tpl) return null
    const every = tpl.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items])
    const items = every.filter((it) => !it.part || parts.includes(it.part))
    return { total: items.length, client: items.filter((i) => i.who === "client").length, tools: items.filter((i) => i.tool).length, phases: tpl.phases.length, byPart: (id: string) => every.filter((it) => it.part === id).length }
  }, [tpl, parts])

  const create = async () => {
    const s = { old: sites.old.trim(), staging: sites.staging.trim(), live: sites.live.trim() }
    if (audit && !s.live) return toast.error("Add the address of the site to audit.")
    if (!audit && !name.trim() && !s.old && !s.staging && !s.live) return toast.error("Give the project a name or a website.")
    setBusy(true)
    try {
      const r = audit
        ? await api.createProject({ kind: "audit", name: name.trim(), sites: { live: s.live } })
        : await api.createProject({ name: name.trim(), sites: s, templateId: tid, kickoff, launch, parts, clientName, startAt: startAt || undefined })
      if (!audit) { setPrefs({ template: tid }); api.savePrefs({ template: tid }).catch(() => {}) }
      await refreshRuns()
      setOpen(false)
      go(routes.project(r.id, audit ? "tools" : undefined))
      if (r.runId) toast(audit ? "Scanning the site" : "Scanning the old site", { description: audit ? "Runs on your Mac. Plans and checks start from the scan." : "The “Crawl the current site” item ticks itself when it’s done." })
    } catch (e) { toast.error((e as Error).message); setBusy(false) }
  }
  const site = (k: "old" | "staging" | "live", label: string, hint: string, placeholder: string) => (
    <label className="grid content-start gap-1.5 text-[13px] font-medium">
      <span>{label} <span className="font-normal text-muted-foreground">{hint}</span></span>
      <Input value={sites[k]} onChange={(e) => setSites((x) => ({ ...x, [k]: e.target.value }))} placeholder={placeholder} className="font-normal" />
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-[640px]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{audit ? "Audit a site" : "New project"}</DialogTitle>
          <DialogDescription>{audit ? "Scan one site and run Groundwork’s tools on it, with no checklist. You can start a full project for it later." : "A website project follows a checklist, phase by phase. Anything you change stays in this project."}</DialogDescription>
          <div role="group" aria-label="Kind" className="mt-3 inline-flex w-fit gap-0.5 rounded-lg bg-muted p-0.5">
            {([[false, "Website project"], [true, "Audit a site"]] as const).map(([a, l]) => (
              <button key={l} aria-pressed={audit === a} onClick={() => setAudit(a)} className={cn("inline-flex h-7 items-center rounded-md px-2.5 text-[13px]", audit === a ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}</button>
            ))}
          </div>
        </DialogHeader>
        {audit ? (
          <div className="grid gap-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              {site("live", "Site to audit", "", "client-site.com")}
              <label className="grid content-start gap-1.5 text-[13px] font-medium"><span>Name <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Dental" className="font-normal" /></label>
            </div>
            <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground"><span className="mt-px grid size-4 shrink-0 place-items-center rounded bg-brand text-brand-foreground"><Layers className="size-2.5" strokeWidth={2.6} /></span>The scan runs on your Mac and doesn’t use AI. From it you can run the launch check, the heading plan and the SEO plan.</p>
          </div>
        ) : (
          <div className="scrollbar-thin grid max-h-[64vh] gap-4 overflow-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-[13px] font-medium">Client or project name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Dental" autoFocus className="font-normal" /></label>
              <label className="grid gap-1.5 text-[13px] font-medium"><span>Client contact <span className="font-normal text-muted-foreground">(for messages)</span></span><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Dana Whitfield" className="font-normal" /></label>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-3">
                {site("old", "Old site", "(if replacing one)", "old-site.com")}
                {site("staging", "Staging", "(optional)", "new-site.webflow.io")}
                {site("live", "Live domain", "(optional)", "client-site.com")}
              </div>
              <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground"><span className="mt-px grid size-4 shrink-0 place-items-center rounded bg-brand text-brand-foreground"><Layers className="size-2.5" strokeWidth={2.6} /></span>{hasOld ? "Groundwork scans the old site on your Mac, with no AI, and ticks “Crawl the current site” when it’s done. " : ""}Launch checks and redirect tests only tick items when they run on the live domain. Add any of these later.</p>
            </div>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <label className="grid gap-1.5 text-[13px] font-medium">Checklist template
                <select value={tid} onChange={(e) => setTid(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal">{list.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items} items)</option>)}</select>
              </label>
              <label className="grid gap-1.5 text-[13px] font-medium">Kickoff<Input type="date" value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="font-normal" /></label>
              <label className="grid gap-1.5 text-[13px] font-medium">Target launch<Input type="date" value={launch} onChange={(e) => setLaunch(e.target.value)} className="font-normal" /></label>
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
                      <Switch checked={parts.includes(p.id)} onCheckedChange={(v) => { if (p.id === "existing") setTouched(true); setParts((x) => (v ? [...x, p.id] : x.filter((y) => y !== p.id))) }} />
                    </label>
                  ))}
                </div>
              </div>
            )}
            {counts && (
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg bg-muted/60 px-3.5 py-2.5 text-[13px] text-muted-foreground">
                <span><b className="font-medium text-foreground tabular">{counts.total}</b> items in {counts.phases} phases</span><span className="h-3.5 w-px bg-input" />
                <span><b className="font-medium text-foreground tabular">{counts.client}</b> from the client</span><span className="h-3.5 w-px bg-input" />
                <span><b className="font-medium text-foreground tabular">{counts.tools}</b> Groundwork can help with</span>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <span className="mr-auto text-[12.5px] text-muted-foreground">{audit ? "Free: scans and checks don’t use AI." : "Due dates stretch to fit between kickoff and launch. You can move any of them."}</span>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={create} disabled={busy || (!audit && !tid)}>{busy && <Loader2 className="animate-spin" />}{audit ? "Scan and audit" : "Create project"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
