import * as React from "react"
import { ArrowRight, ListChecks, Loader2, MoreHorizontal, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Composer, useUsageConfirm } from "@/components/composer/Composer"
import { CountryPicker, EnginePicker, ModelPicker, OutputPicker, ToolPicker, type PlanTool } from "@/components/composer/pickers"
import { FailedBlock, PagesBlock, PlanBlock, ScanBlock, SeoBlock } from "@/components/run/blocks"
import { SkillPicker } from "@/components/settings/Skills"
import { SiteMenu, VersionMenu } from "@/components/shell/AppShell"
import { SiteIcon, Spinner, TopBar } from "@/components/common/bits"
import { useApp } from "@/hooks/useApp"
import { useRun } from "@/hooks/useRun"
import { useDraftSettings } from "@/hooks/useDraftSettings"
import { api, type Estimate, type Run } from "@/lib/api"
import { fmtRange, plural } from "@/lib/format"
import { go, routes } from "@/lib/router"

export const hostOf = (run: Pick<Run, "origin" | "url" | "name">) => { try { return new URL(run.origin || run.url).hostname.replace(/^www\./, "") } catch { return run.name } }

// Page selection and the chosen tool are shared between the thread and the composer below it.
const SelCtx = React.createContext<{ selected: Set<string>; setSelected: (s: Set<string>) => void; tool: PlanTool; setTool: (t: PlanTool) => void } | null>(null)

export function RunPage({ tool: asked }: { tool?: "seo" }) {
  const { run } = useRun()
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [tool, setTool] = React.useState<PlanTool>(asked || "headings")
  const key = run ? run.id + (run.status === "scanned" ? ":s" : run.status === "scanning" ? ":w" : ":x") : ""
  React.useEffect(() => { if (run && run.status !== "scanning") setSelected(new Set(run.selected || [])) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  // Once the heading plan exists, the next thing to plan is usually the SEO.
  const hasPlan = !!run && (run.status === "done" || run.status === "partial")
  React.useEffect(() => { if (asked) setTool(asked); else if (hasPlan && !run?.seo) setTool("seo") }, [asked, run?.id, hasPlan]) // eslint-disable-line react-hooks/exhaustive-deps
  return <SelCtx.Provider value={{ selected, setSelected, tool, setTool }}><Thread /></SelCtx.Provider>
}

function Thread() {
  const { run, progress, log, result, notFound, seo, seoState, seoProgress } = useRun()
  const app = useApp()
  const { selected, setSelected } = React.useContext(SelCtx)!
  const [confirm, setConfirm] = React.useState<null | "stop" | "delete">(null)
  const bottom = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (run?.status === "running" || run?.seo?.status === "running") bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [run?.status, run?.seo?.status])

  if (notFound) return <Empty title="This site plan doesn’t exist any more." />
  if (!run) return <div className="grid h-full place-items-center"><Spinner className="size-5" /></div>

  const seoRunning = run.seo?.status === "running"
  const busy = run.status === "running" || run.status === "scanning" || seoRunning
  const rescan = async () => { const { id } = await api.rescan(run.id); await app.refreshRuns(); go(routes.run(id)) }
  const reshoot = async () => {
    const t = toast.loading("Retaking screenshots…", { description: "Runs on your Mac. No AI plan usage." })
    try { const r = await api.reshoot(run.id); toast.success(`New screenshots for ${plural(r.pages, "page")}`, { id: t, description: "" }) } catch (e) { toast.error((e as Error).message, { id: t }) }
  }
  const remove = async () => { await api.remove(run.id); await app.refreshRuns(); toast(`Removed ${app.siteLabel(hostOf(run))}`); go(routes.home) }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar>
        <SiteIcon runId={run.id} name={app.siteLabel(hostOf(run))} className="size-5 text-[10px]" />
        <a href={run.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:underline" title={hostOf(run)}>{app.siteLabel(hostOf(run))}</a>
        <span className="text-muted-foreground">/</span>
        <VersionMenu runId={run.id} />
        <span className="flex-1" />
        {(run.status === "done" || run.status === "partial") && <Button size="sm" variant={run.seo ? "outline" : "default"} onClick={() => go(routes.review(run.id))}><ListChecks /> {run.seo ? "Headings" : "To-do list"}</Button>}
        {(run.seo?.status === "done" || run.seo?.status === "partial") && <Button size="sm" onClick={() => go(routes.seo(run.id))}><Search /> SEO plan</Button>}
        <SiteMenu host={hostOf(run)} onRescan={rescan} onReshoot={busy ? undefined : reshoot} onDelete={() => setConfirm("delete")}><Button variant="ghost" size="icon-sm" aria-label="Site options"><MoreHorizontal /></Button></SiteMenu>
      </TopBar>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6">
          {run.status === "scan_failed" ? <FailedBlock run={run} onRetry={rescan} /> : <ScanBlock run={run} progress={run.status === "scanning" ? progress : null} />}
          {run.status !== "scanning" && run.status !== "scan_failed" && <PagesBlock key={run.id + (run.settings ? "p" : "")} run={run} selected={selected} setSelected={setSelected} locked={run.status === "running" || seoRunning} />}
          {run.job && <PlanBlock run={run} progress={run.status === "running" ? progress : null} log={log} result={result} onStop={() => setConfirm("stop")} />}
          {run.seo && <SeoBlock run={run} progress={seoRunning ? seoProgress : null} log={log} result={seo} state={seoState} onStop={() => setConfirm("stop")} />}
          <div ref={bottom} />
        </div>
      </div>
      {!busy && run.status !== "scan_failed" && <PlanComposer />}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "stop" ? (seoRunning ? "Stop the SEO plan?" : "Stop this plan?") : `Remove this version of ${app.siteLabel(hostOf(run))}?`}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === "stop" ? "Pages already planned are kept, and you can review them. Anything unfinished is lost." : "This deletes the scan, its plans and their to-do progress from this computer. You can’t undo it."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { const c = confirm; setConfirm(null); if (c === "stop") { api.cancel(run.id); toast("Stopping the plan…") } else remove() }}>{confirm === "stop" ? "Stop" : "Remove"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PlanComposer() {
  const { run, result, seo } = useRun()
  const { status, refreshRuns, setPrefs } = useApp()
  const { selected, tool, setTool } = React.useContext(SelCtx)!
  const isSeo = tool === "seo"
  const existing = isSeo ? seo : result
  const r = run!
  const d = useDraftSettings(r.settings, (() => { try { return new URL(r.origin || r.url).hostname } catch { return "" } })())
  const [est, setEst] = React.useState<Estimate | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [replace, setReplace] = React.useState(false)
  const usage = useUsageConfirm()
  const n = selected.size

  React.useEffect(() => {
    const t = setTimeout(() => api.estimate({ engine: d.s.engine, model: d.s.model === "custom" ? "default" : d.s.model, effort: d.s.effort, output: d.s.output }, Math.max(1, n), tool).then(setEst).catch(() => {}), 150)
    return () => clearTimeout(t)
  }, [d.s.engine, d.s.model, d.s.effort, d.s.output, n, tool])

  const e = status?.engines[d.s.engine]
  const ready = !!e?.installed && !!e?.loggedIn
  const eng = status?.catalog[d.s.engine].name
  const start = async (force = false) => {
    if (!ready) return go(routes.settings(d.s.engine))
    if (!n) return toast("Pick at least one page to plan.")
    if (existing && !force) return setReplace(true)
    if (!(await usage.ask(d.s.engine, est, n))) return
    setBusy(true)
    try {
      const s = d.resolved()
      if (isSeo) await api.seoStart(r.id, { market: s.market, liveDomain: s.liveDomain, engine: s.engine, model: s.model, effort: s.effort, notes: s.notes }, [...selected])
      else await api.start(r.id, s, [...selected])
      setPrefs({ engine: s.engine, model: s.model, effort: s.effort, market: s.market, ...(isSeo ? {} : { output: s.output }) })
      refreshRuns()
      // Plans take minutes; offer a desktop notice for when it's done.
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {})
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const w = status?.limits?.windows?.five_hour
  return (
    <>
      <Composer
        context={<><ToolPicker value={tool} onChange={setTool} /><CountryPicker value={d.s.market} onChange={(market) => d.set({ market })} />{!isSeo && <OutputPicker value={d.s.output} onChange={(output) => d.set({ output })} />}<SkillPicker tool={isSeo ? "seo" : "headings"} /></>}
        left={<EnginePicker value={d.s.engine} onChange={d.setEngine} />}
        right={<ModelPicker engine={d.s.engine} model={d.s.model} effort={d.s.effort} custom={d.custom} onChange={d.setModel} />}
        submit={
          <Button onClick={() => start()} disabled={busy || !n} className="h-8 rounded-full pr-3.5 pl-3">
            {busy ? <Loader2 className="animate-spin" /> : ready ? <Sparkles /> : <ArrowRight />}
            {ready ? `${isSeo ? (seo ? "Plan SEO again" : "Plan SEO") : result ? "Plan again" : "Plan"} · ${plural(n, "page")}` : `Set up ${eng}`}
          </Button>
        }
        footer={!ready ? <span>{eng} isn’t set up on this computer yet.</span> : est && (
          <span>
            About {fmtRange(est.total)} · {est.usage.toLowerCase()} usage of your {eng} {e?.billing === "api" ? "API key (billed per token)" : "plan"}
            {w && d.s.engine === "claude" ? ` · 5-hour window ${Math.round(w.utilization * 100)}% used` : ""}
            {est.limitPct != null ? `, similar runs used about ${Math.max(1, Math.round(est.limitPct * 100))}%` : ""}
          </span>
        )}
      >
        <Textarea
          value={d.s.notes || ""}
          onChange={(ev) => d.set({ notes: ev.target.value })}
          onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); start() } }}
          placeholder={isSeo ? "Anything the AI should know? How the brand name is written, words to use or avoid, URLs to keep… (optional, ⌘↵ to start)" : "Anything the AI should know? Brand voice, pages to leave alone, terms to use… (optional, ⌘↵ to start)"}
          className="max-h-40 min-h-[52px] resize-none border-0 bg-transparent px-3 pt-3 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Composer>
      {usage.dialog}
      <AlertDialog open={replace} onOpenChange={setReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isSeo ? "Replace the SEO plan?" : "Replace the current plan?"}</AlertDialogTitle>
            <AlertDialogDescription>{isSeo ? "Planning again replaces this site’s SEO plan, your edits to it and its to-do progress. The heading plan stays." : "Planning again replaces this site’s plan and resets its to-do progress. To keep this one, rescan the site instead: that starts a separate plan."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setReplace(false); start(true) }}>Plan again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function Empty({ title }: { title: string }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div><p className="text-lg font-medium">{title}</p><Button className="mt-4" variant="outline" onClick={() => go(routes.home)}>Back home</Button></div>
    </div>
  )
}
