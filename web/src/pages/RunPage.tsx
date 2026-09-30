import * as React from "react"
import { cn } from "cn"
import { ArrowRight, ListChecks, Loader2, Lock, MoreHorizontal, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useUsageConfirm } from "@/components/composer/Composer"
import { CountryPicker, EnginePicker, ModelPicker, OutputPicker, type PlanTool } from "@/components/composer/pickers"
import { FailedBlock, PagesBlock, PlanBlock, ScanBlock, SeoBlock } from "@/components/run/blocks"
import { SkillPicker } from "@/components/settings/Skills"
import { SiteMenu, VersionMenu } from "@/components/shell/AppShell"
import { Spinner, TopBar } from "@/components/common/bits"
import { Crumbs } from "@/components/project/Crumbs"
import { useApp } from "@/hooks/useApp"
import { useRun } from "@/hooks/useRun"
import { useDraftSettings } from "@/hooks/useDraftSettings"
import { api, type Estimate, type Run } from "@/lib/api"
import { fmtRange, plural } from "@/lib/format"
import { go, routes } from "@/lib/router"

export const hostOf = (run: Pick<Run, "origin" | "url" | "name">) => { try { return new URL(run.origin || run.url).hostname.replace(/^www\./, "") } catch { return run.name } }

// Page selection is shared between the page list and the Run panel below it.
const SelCtx = React.createContext<{ selected: Set<string>; setSelected: (s: Set<string>) => void } | null>(null)

export function RunPage({ tool: asked }: { tool?: PlanTool }) {
  const { run } = useRun()
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const key = run ? run.id + (run.status === "scanned" ? ":s" : run.status === "scanning" ? ":w" : ":x") : ""
  React.useEffect(() => { if (run && run.status !== "scanning") setSelected(new Set(run.selected || [])) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  // The page is about one tool: the one asked for, or the plan already made from this scan. A bare scan offers both.
  const tool: PlanTool | null = asked || (run?.job ? "headings" : run?.seo ? "seo" : null)
  return <SelCtx.Provider value={{ selected, setSelected }}><Thread tool={tool} /></SelCtx.Provider>
}

const TOOL_LABEL: Record<PlanTool, string> = { headings: "Heading plan", seo: "SEO plan" }

function Thread({ tool }: { tool: PlanTool | null }) {
  const { run, progress, log, result, notFound, seo, seoState, seoProgress } = useRun()
  const app = useApp()
  const { selected, setSelected } = React.useContext(SelCtx)!
  const [confirm, setConfirm] = React.useState<null | "stop" | "delete">(null)
  const bottom = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (run?.status === "running" || run?.seo?.status === "running") bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [run?.status, run?.seo?.status])

  if (notFound) return <Empty title="This scan doesn’t exist any more." />
  if (!run) return <div className="grid h-full place-items-center"><Spinner className="size-5" /></div>

  const seoRunning = run.seo?.status === "running"
  const busy = run.status === "running" || run.status === "scanning" || seoRunning
  const back = () => go(run.projectId ? routes.project(run.projectId, "tools") : routes.home)
  const rescan = async () => { const { id } = await api.rescan(run.id); await app.refreshRuns(); go(routes.run(id, tool || undefined)) }
  const reshoot = async () => {
    const t = toast.loading("Retaking screenshots…", { description: "Runs on your Mac. No AI." })
    try { const r = await api.reshoot(run.id); toast.success(`New screenshots for ${plural(r.pages, "page")}`, { id: t, description: "" }) } catch (e) { toast.error((e as Error).message, { id: t }) }
  }
  const remove = async () => { await api.remove(run.id); await app.refreshRuns(); toast("Removed the scan"); back() }
  const planDone = run.status === "done" || run.status === "partial"
  const seoDone = run.seo?.status === "done" || run.seo?.status === "partial"
  // One name per page: the tool's name is its finished plan; this page is where a plan runs, or a new one starts.
  const ready = tool === "headings" ? planDone : tool === "seo" ? seoDone : false
  const planning = tool === "headings" ? run.status === "running" : tool === "seo" ? seoRunning : false
  const openPlan = () => go(tool === "seo" ? routes.seo(run.id) : routes.review(run.id))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar>
        <Crumbs projectId={run.projectId || null} label={!tool ? "Scan" : ready ? <button onClick={openPlan} className="hover:underline">{TOOL_LABEL[tool]}</button> : TOOL_LABEL[tool]}>
          <span className="text-muted-foreground/60">/</span>
          <VersionMenu runId={run.id} tool={tool || "scan"} />
          {tool && !planning && <><span className="text-muted-foreground/60">/</span><span className="shrink-0 px-1.5">{(tool === "headings" ? run.job : run.seo) ? "Plan again" : "New plan"}</span></>}
        </Crumbs>
        <span className="flex-1" />
        {ready && <Button size="sm" onClick={openPlan}><ListChecks /> Open the plan</Button>}
        <SiteMenu onRescan={rescan} onReshoot={busy ? undefined : reshoot} onDelete={() => setConfirm("delete")}><Button variant="ghost" size="icon-sm" aria-label="Scan options"><MoreHorizontal /></Button></SiteMenu>
      </TopBar>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6">
          {run.status === "scan_failed" ? <FailedBlock run={run} onRetry={rescan} /> : <ScanBlock run={run} progress={run.status === "scanning" ? progress : null} />}
          {!tool && run.status === "scanned" && <NextBlock runId={run.id} />}
          {run.status !== "scanning" && run.status !== "scan_failed" && <PagesBlock key={run.id + (run.settings ? "p" : "") + (tool || "")} run={run} selected={selected} setSelected={setSelected} browse={!tool} locked={run.status === "running" || seoRunning} />}
          {tool === "headings" && run.job && <PlanBlock run={run} progress={run.status === "running" ? progress : null} log={log} result={result} onStop={() => setConfirm("stop")} />}
          {tool === "seo" && run.seo && <SeoBlock run={run} progress={seoRunning ? seoProgress : null} log={log} result={seo} state={seoState} onStop={() => setConfirm("stop")} />}
          {tool && !busy && run.status !== "scan_failed" && <RunPanel tool={tool} />}
          <div ref={bottom} />
        </div>
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "stop" ? (seoRunning ? "Stop the SEO plan?" : "Stop the heading plan?") : "Remove this scan?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === "stop" ? "Pages already planned are kept, and you can review them. Anything unfinished is lost." : "This deletes the scan, the plans made from it and their to-do progress from this computer. You can’t undo it."}</AlertDialogDescription>
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

/** After a scan: the two plans it can start. */
function NextBlock({ runId }: { runId: string }) {
  const opt = (t: PlanTool, desc: string) => (
    <button onClick={() => go(routes.run(runId, t))} className="grid content-start gap-1 rounded-lg border bg-card px-4 py-3 text-left hover:border-foreground/25 hover:bg-muted/30">
      <span className="flex items-center gap-2 font-medium">{TOOL_LABEL[t]}<ArrowRight className="size-3.5 text-muted-foreground" /></span>
      <span className="text-[13px] text-muted-foreground">{desc}</span>
    </button>
  )
  return (
    <section className="grid gap-3 rounded-xl border bg-muted/30 p-4">
      <div><h3 className="font-medium">Plan from this scan</h3><p className="text-[13px] text-muted-foreground">Both use AI through your own Claude or ChatGPT subscription. You choose the pages on the next screen.</p></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {opt("headings", "H1 to H6 for each page: which tags to fix, and rewrites if you want them.")}
        {opt("seo", "A title, meta description and URL for each page.")}
      </div>
    </section>
  )
}

function Field({ label, top, children }: { label: string; top?: boolean; children: React.ReactNode }) {
  return (
    <>
      <dt className={cn("text-muted-foreground", top ? "pt-2" : "flex h-9 items-center")}>{label}</dt>
      <dd className="flex min-h-9 min-w-0 items-center">{children}</dd>
    </>
  )
}

/** The form that starts a plan: its settings as plain fields, what it costs, and what leaves this Mac. */
function RunPanel({ tool }: { tool: PlanTool }) {
  const { run, result, seo } = useRun()
  const { status, refreshRuns, setPrefs } = useApp()
  const { selected } = React.useContext(SelCtx)!
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
    <section aria-label={isSeo ? "Plan SEO" : "Plan headings"} className="rounded-xl border bg-card">
      <div className="px-5 pt-4">
        <h3 className="text-[15px] font-medium">{isSeo ? (seo ? "Plan SEO again" : "Plan SEO") : result ? "Plan headings again" : "Plan headings"} for {plural(n, "page")}</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{isSeo ? "A title, meta description and URL for each page. Uses the heading plan’s keywords when there is one." : "Which heading tags to fix on each page, and keyword rewrites if you want them."} Change the pages in the list above.</p>
      </div>
      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-y-0.5 px-5 py-3 text-[13.5px] [&_dd>button]:-ml-2">
        <Field label="Market"><CountryPicker value={d.s.market} onChange={(market) => d.set({ market })} /></Field>
        {!isSeo && <Field label="What to make"><OutputPicker value={d.s.output} onChange={(output) => d.set({ output })} /></Field>}
        <Field label="Skill"><SkillPicker tool={isSeo ? "seo" : "headings"} always /></Field>
        <Field label="AI engine"><EnginePicker value={d.s.engine} onChange={d.setEngine} /></Field>
        <Field label="Model"><ModelPicker engine={d.s.engine} model={d.s.model} effort={d.s.effort} custom={d.custom} onChange={d.setModel} /></Field>
        <Field label="Notes" top>
          <Textarea
            value={d.s.notes || ""}
            onChange={(ev) => d.set({ notes: ev.target.value })}
            onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); start() } }}
            placeholder={isSeo ? "Optional: how the brand name is written, words to use or avoid, URLs to keep" : "Optional: brand voice, pages to leave alone, terms to use"}
            rows={2}
            className="min-h-0 resize-none text-[13.5px] [field-sizing:content]"
          />
        </Field>
      </dl>
      <div className="grid gap-3 rounded-b-xl border-t bg-muted/30 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid gap-1 text-[12.5px] text-muted-foreground">
          {!ready ? <span>{eng} isn’t set up on this computer yet.</span> : est && (
            <span>
              About {fmtRange(est.total)}, {est.usage.toLowerCase()} usage of your {e?.billing === "api" ? `${eng} API key (billed per token)` : `${d.s.engine === "codex" ? "ChatGPT" : "Claude"} subscription`}
              {w && d.s.engine === "claude" ? `. 5-hour window ${Math.round(w.utilization * 100)}% used` : ""}
              {est.limitPct != null ? `, similar runs used about ${Math.max(1, Math.round(est.limitPct * 100))}%` : ""}.
            </span>
          )}
          <span className="flex items-start gap-1.5"><Lock className="mt-0.5 size-3 shrink-0" /><span>Sends the text and headings of {plural(n, "page")}{isSeo ? " with their current titles and descriptions" : ", a screenshot when a layout is unclear"} and your notes to {d.s.engine === "codex" ? "OpenAI through your ChatGPT account" : "Anthropic through your Claude account"}. {d.s.engine === "claude" && e?.restricted ? "Claude Code can only open this scan’s folder, so your projects, client details and files stay on this Mac." : "Groundwork only gives it this scan’s folder; your projects and client details aren’t part of it."} <button onClick={() => go(routes.settings("privacy"))} className="underline underline-offset-2 hover:text-foreground">Data and privacy</button></span></span>
        </div>
        <Button onClick={() => start()} disabled={busy || !n} className="justify-self-end">
          {busy ? <Loader2 className="animate-spin" /> : ready ? <Sparkles /> : <ArrowRight />}
          {ready ? `${isSeo ? "Plan SEO" : "Plan headings"} · ${plural(n, "page")}` : `Set up ${eng}`}
        </Button>
      </div>
      {usage.dialog}
      <AlertDialog open={replace} onOpenChange={setReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isSeo ? "Replace the SEO plan?" : "Replace the heading plan?"}</AlertDialogTitle>
            <AlertDialogDescription>{isSeo ? "Planning again replaces this scan’s SEO plan, your edits to it and its to-do progress. The heading plan stays." : "Planning again replaces this scan’s heading plan and resets its to-do progress. To keep this one, rescan the site instead: that starts a separate plan."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setReplace(false); start(true) }}>Plan again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** "Remove this scan" with its confirmation, for the plan pages' menus. Afterwards you land on the project's Tools. */
export function useRemoveScan(run: Run | null) {
  const app = useApp()
  const [open, setOpen] = React.useState(false)
  const remove = async () => {
    if (!run) return
    await api.remove(run.id); await app.refreshRuns(); toast("Removed the scan")
    go(run.projectId ? routes.project(run.projectId, "tools") : routes.home)
  }
  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this scan?</AlertDialogTitle>
          <AlertDialogDescription>This deletes the scan, the plans made from it and their to-do progress from this computer. You can’t undo it.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => { setOpen(false); remove() }}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
  return { ask: () => setOpen(true), dialog }
}

export function Empty({ title }: { title: string }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div><p className="text-lg font-medium">{title}</p><Button className="mt-4" variant="outline" onClick={() => go(routes.home)}>Back home</Button></div>
    </div>
  )
}
