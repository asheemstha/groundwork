import * as React from "react"
import { Globe, Layers, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/hooks/useApp"
import { api, type ChecklistTemplate, type TemplateSummary } from "@/lib/api"
import { go, routes } from "@/lib/router"

/** Open the New project dialog from anywhere, optionally for a site Groundwork already knows. */
export const newProject = (detail?: { url?: string; name?: string }) => window.dispatchEvent(new CustomEvent("gw:new-project", { detail: detail || {} }))

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }

export function NewProjectDialog() {
  const { refreshRuns } = useApp()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [clientName, setClientName] = React.useState("")
  const [kickoff, setKickoff] = React.useState(addDays(7))
  const [launch, setLaunch] = React.useState(addDays(77))
  const [list, setList] = React.useState<TemplateSummary[]>([])
  const [tid, setTid] = React.useState("")
  const [tpl, setTpl] = React.useState<ChecklistTemplate | null>(null)
  const [parts, setParts] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ url?: string; name?: string }>).detail || {}
      setName(d.name || ""); setUrl(d.url || ""); setClientName(""); setBusy(false)
      setKickoff(addDays(7)); setLaunch(addDays(77))
      api.templates().then((l) => { const c = l.filter((t) => t.kind === "checklist"); setList(c); setTid((t) => (c.some((x) => x.id === t) ? t : c[0]?.id || "")) }).catch(() => {})
      setOpen(true)
    }
    window.addEventListener("gw:new-project", on)
    return () => window.removeEventListener("gw:new-project", on)
  }, [])
  React.useEffect(() => {
    if (!tid) return
    api.template(tid).then((t) => { if (t.kind === "checklist") { setTpl(t); setParts(t.parts.map((p) => p.id).filter((id) => id !== "languages" && id !== "payments")) } }).catch(() => {})
  }, [tid])

  const counts = React.useMemo(() => {
    if (!tpl) return null
    const items = tpl.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items]).filter((it) => !it.part || parts.includes(it.part))
    const byPart = (id: string) => tpl.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items]).filter((it) => it.part === id).length
    return { total: items.length, client: items.filter((i) => i.who === "client").length, tools: items.filter((i) => i.tool).length, phases: tpl.phases.length, byPart }
  }, [tpl, parts])

  const create = async () => {
    if (!name.trim() && !url.trim()) return toast.error("Give the project a name or a website.")
    setBusy(true)
    try {
      const r = await api.createProject({ name: name.trim(), url: url.trim() || undefined, templateId: tid, kickoff, launch, parts, clientName })
      await refreshRuns()
      setOpen(false)
      go(routes.project(r.id))
      if (r.runId) toast("Scanning the site", { description: "The “Crawl the current site” item ticks itself when it’s done." })
    } catch (e) { toast.error((e as Error).message); setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-[620px]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>It starts from a checklist template. Anything you change here stays in this project.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium">Client or project name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Dental" autoFocus /></label>
            <label className="grid gap-1.5 text-[13px] font-medium"><span>Client contact <span className="font-normal text-muted-foreground">(for messages)</span></span><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Dana Whitfield" /></label>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="np-url" className="text-[13px] font-medium">Current website <span className="font-normal text-muted-foreground">(optional)</span></label>
            <div className="relative"><Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" /><Input id="np-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="client-site.com" className="pl-9" /></div>
            <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground"><span className="mt-px grid size-4 shrink-0 place-items-center rounded bg-brand text-brand-foreground"><Layers className="size-2.5" strokeWidth={2.6} /></span>Groundwork scans it on your Mac, so it doesn’t use your AI plan. When the scan finishes, it ticks “Crawl the current site” for you.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium">Checklist template
              <select value={tid} onChange={(e) => setTid(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal">{list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium">Kickoff<Input type="date" value={kickoff} onChange={(e) => setKickoff(e.target.value)} /></label>
            <label className="grid gap-1.5 text-[13px] font-medium">Target launch<Input type="date" value={launch} onChange={(e) => setLaunch(e.target.value)} /></label>
          </div>
          {tpl && tpl.parts.length > 0 && (
            <div className="grid gap-2">
              <div className="flex items-baseline gap-2"><span className="text-[13px] font-medium">What this project includes</span><span className="text-[12.5px] text-muted-foreground">switches parts of the checklist on or off</span></div>
              <div className="overflow-hidden rounded-xl border bg-card">
                {tpl.parts.map((p) => (
                  <label key={p.id} className="grid cursor-pointer grid-cols-[minmax(0,1fr)_64px_auto] items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0">
                    <span className="grid gap-0.5"><span className="text-[13.5px]">{p.name}</span>{p.desc && <span className="text-[12.5px] text-muted-foreground">{p.desc}</span>}</span>
                    <span className="text-right text-xs text-muted-foreground tabular">{counts?.byPart(p.id)} {counts?.byPart(p.id) === 1 ? "item" : "items"}</span>
                    <Switch checked={parts.includes(p.id)} onCheckedChange={(v) => setParts((x) => (v ? [...x, p.id] : x.filter((y) => y !== p.id)))} />
                  </label>
                ))}
              </div>
            </div>
          )}
          {counts && (
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg bg-muted/60 px-3.5 py-2.5 text-[13px] text-muted-foreground">
              <span><b className="text-foreground tabular">{counts.total}</b> items in {counts.phases} phases</span><span className="h-3.5 w-px bg-input" />
              <span><b className="text-foreground tabular">{counts.client}</b> from the client</span><span className="h-3.5 w-px bg-input" />
              <span><b className="text-foreground tabular">{counts.tools}</b> Groundwork can help with</span>
            </div>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <span className="mr-auto text-[12.5px] text-muted-foreground">Due dates are spread between kickoff and launch. You can move any of them.</span>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={create} disabled={busy || !tid}>{busy && <Loader2 className="animate-spin" />}Create project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
