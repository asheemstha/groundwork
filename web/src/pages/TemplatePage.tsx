import * as React from "react"
import { cn } from "cn"
import { Info, Plus, Stamp, Trash2, User } from "lucide-react"
import { toast } from "sonner"
import { PLATFORMS, type PlatformId } from "@/lib/platforms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner, TopBar } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { Chip } from "@/pages/Dashboard"
import { useApp } from "@/hooks/useApp"
import { api, type ChecklistTemplate, type DueRule, type LaunchCheckId, type MessageTemplate, type Project, type TItem, type Template, type ToolId } from "@/lib/api"
import { LAUNCH_CHECKS, VARIABLES, renderMessage, ruleLabel } from "@/lib/project"
import { ago } from "@/lib/format"
import { go, routes } from "@/lib/router"

const TOOL_NAMES: Record<ToolId, { name: string; ready: boolean }> = {
  scan: { name: "Site scan", ready: true },
  headings: { name: "Heading plan", ready: true },
  seo: { name: "SEO plan", ready: true },
  launch: { name: "Launch check", ready: true },
  redirects: { name: "Redirect map", ready: true },
  inventory: { name: "Content inventory", ready: true },
}
const newId = () => "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

/** Loads a template and saves changes a moment after you stop typing. */
export function TemplatePage({ id }: { id: string }) {
  const [t, setT] = React.useState<Template | null>(null)
  const [missing, setMissing] = React.useState(false)
  const [saved, setSaved] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)
  const timer = React.useRef(0)
  React.useEffect(() => { setT(null); api.template(id).then((x) => { setT(x); setSaved(x.updated) }).catch(() => setMissing(true)) }, [id])
  const change = (next: Template) => {
    setT(next)
    window.clearTimeout(timer.current)
    setSaving(true)
    timer.current = window.setTimeout(async () => {
      try { const r = await api.saveTemplate(id, next); setSaved(r.updated) } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
    }, 700)
  }
  if (missing) return <div className="grid h-full place-items-center text-sm text-muted-foreground">This template doesn’t exist any more.</div>
  if (!t) return <div className="grid h-full place-items-center"><Spinner /></div>
  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <button onClick={() => go(routes.templates)} className="text-sm text-muted-foreground hover:text-foreground">Templates</button>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-sm font-medium">{t.name}</span>
        <Chip className="h-5 text-[11.5px]">{t.kind === "checklist" ? "Checklist" : t.kind === "email" ? "Email" : "Message"}</Chip>
        <span className="flex-1" />
        <span className="text-[12.5px] text-muted-foreground">{saving ? "Saving…" : saved ? `Saved ${ago(saved)}` : ""}</span>
        {t.kind === "checklist" && <Button variant="outline" size="sm" onClick={() => newProject({ template: t.id })}>Start a project from it</Button>}
      </TopBar>
      {t.kind === "checklist" ? <ChecklistEditor t={t} onChange={change} /> : <MessageEditor t={t} onChange={change} />}
    </div>
  )
}

// ---------- checklist ----------
type Where = { phase: number; group: number | "handoff"; item: number }
function ChecklistEditor({ t, onChange }: { t: ChecklistTemplate; onChange: (t: ChecklistTemplate) => void }) {
  const { projects } = useApp()
  const [pi, setPi] = React.useState(0)
  const [open, setOpen] = React.useState<string | null>(null)
  const [newPart, setNewPart] = React.useState<string | null>(null)
  const ph = t.phases[Math.min(pi, t.phases.length - 1)]!
  const clone = () => JSON.parse(JSON.stringify(t)) as ChecklistTemplate
  const list = (c: ChecklistTemplate, w: Omit<Where, "item">) => (w.group === "handoff" ? c.phases[w.phase]!.handoff.items : c.phases[w.phase]!.groups[w.group]!.items)
  const edit = (w: Where, patch: Partial<TItem>) => { const c = clone(); const l = list(c, w); l[w.item] = { ...l[w.item]!, ...patch }; onChange(c) }
  const del = (w: Where) => { const c = clone(); list(c, w).splice(w.item, 1); onChange(c); setOpen(null) }
  const add = (w: Omit<Where, "item">) => { const c = clone(); const it: TItem = { id: newId(), title: "New item", who: "us", done: "", part: null, tool: null, due: null }; list(c, w).push(it); onChange(c); setOpen(it.id) }
  const setPhase = (patch: Partial<ChecklistTemplate["phases"][number]>) => { const c = clone(); c.phases[pi] = { ...c.phases[pi]!, ...patch }; onChange(c) }
  const itemsOf = (ph2: typeof ph) => [...ph2.groups.flatMap((g) => g.items), ...ph2.handoff.items]
  const running = projects.filter((p) => p.kind !== "audit" && p.templateId === t.id).length

  // A plain function, not a component, so the open editor keeps focus while you type.
  const rows = (items: TItem[], w: Omit<Where, "item">) => (
    <>
      {items.map((it, i) => open === it.id
        ? <ItemEditor key={it.id} it={it} t={t} onChange={(patch) => edit({ ...w, item: i }, patch)} onDelete={() => del({ ...w, item: i })} onDone={() => setOpen(null)} />
        : (
          <button key={it.id} onClick={() => setOpen(it.id)} className="grid h-[38px] w-full grid-cols-[minmax(0,1fr)_150px_150px_120px] items-center gap-3 border-t border-border/60 text-left text-[13.5px] hover:bg-muted/30">
            <span className="flex min-w-0 items-center gap-2"><span className="truncate">{it.title}</span>{it.who === "client" && <Chip className="h-5 text-[11.5px]"><User className="size-3" />Client</Chip>}</span>
            <span>{it.part && <Chip className="border-transparent bg-muted text-foreground/70">{t.parts.find((p) => p.id === it.part)?.name.replace(/^Replacing an existing website$/, "Replacing a site") || it.part}</Chip>}</span>
            <span>{it.tool && <Chip className={cn(!TOOL_NAMES[it.tool].ready && "border-dashed")}><span className="size-[7px] rounded-[2px] bg-brand" />{TOOL_NAMES[it.tool].name}{TOOL_NAMES[it.tool].ready ? "" : ", soon"}</Chip>}</span>
            <span className="text-right text-[12.5px] text-muted-foreground">{it.due ? ruleLabel(it.due) : ""}</span>
          </button>
        ))}
      <button onClick={() => add(w)} className="flex h-9 items-center gap-2 border-t border-border/60 text-[13px] text-muted-foreground hover:text-foreground"><Plus className="size-3.5" />Add item</button>
    </>
  )

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5 border-b bg-muted/40 px-4 py-2.5 text-[13px] text-foreground/70"><Info className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1">Changes apply to new projects.{running ? ` Your ${running} running ${running === 1 ? "project keeps its" : "projects keep their"} own copy.` : ""}</span>{!!t.basedOn?.filter((b) => b.url).length && <span className="truncate text-muted-foreground">Based on {t.basedOn.filter((b) => b.url).map((b, i) => <React.Fragment key={b.url}>{i > 0 && ", "}<a href={b.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{b.label}</a></React.Fragment>)}</span>}</div>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Phases" className="scrollbar-thin flex flex-col gap-px overflow-auto border-r px-3 py-4">
          <span className="px-2 pb-1.5 text-[12.5px] text-muted-foreground">Phases</span>
          {t.phases.map((x, i) => (
            <button key={x.id} onClick={() => { setPi(i); setOpen(null) }} className={cn("grid h-8 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 text-left text-[13.5px] hover:bg-muted/60", i === pi && "bg-muted font-medium")}>
              <span className="text-xs font-normal text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</span><span className="truncate">{x.name}</span><span className="text-xs font-normal text-muted-foreground tabular">{itemsOf(x).length}</span>
            </button>
          ))}
          <button onClick={() => { const c = clone(); c.phases.push({ id: "p" + Date.now().toString(36), name: "New phase", due: null, groups: [{ id: "g" + Date.now().toString(36), name: "Our process", items: [] }], handoff: { title: "Sign-off", needs: "client", items: [] } }); onChange(c); setPi(c.phases.length - 1) }} className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-muted-foreground hover:bg-muted/60"><Plus className="size-3.5" />Add phase</button>
          <span className="mt-5 px-2 pb-1.5 text-[12.5px] text-muted-foreground">Optional parts</span>
          {t.parts.map((p) => <div key={p.id} className="grid h-[30px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 text-[13px]" title={p.desc}><span className="truncate">{p.name}</span><span className="text-xs text-muted-foreground tabular">{t.phases.flatMap(itemsOf).filter((x) => x.part === p.id).length}</span></div>)}
          {newPart === null
            ? <button onClick={() => setNewPart("")} className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-muted-foreground hover:bg-muted/60"><Plus className="size-3.5" />Add optional part</button>
            : <form className="px-1 pt-1" onSubmit={(e) => { e.preventDefault(); if (newPart.trim()) { const c = clone(); c.parts.push({ id: "part" + Date.now().toString(36), name: newPart.trim(), desc: "" }); onChange(c) } setNewPart(null) }}><Input autoFocus value={newPart} onChange={(e) => setNewPart(e.target.value)} onBlur={() => setNewPart(null)} placeholder="e.g. Blog setup" className="h-8" /></form>}
        </nav>
        <div className="scrollbar-thin min-w-0 overflow-auto px-8 py-5">
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="text-[13px] text-muted-foreground tabular">{String(pi + 1).padStart(2, "0")}</span>
            <input value={ph.name} onChange={(e) => setPhase({ name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[22px] font-medium outline-none" aria-label="Phase name" />
            <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">Due<DueRuleInput value={ph.due} onChange={(due) => setPhase({ due })} allowNone={false} /></label>
            {t.phases.length > 1 && <Button variant="ghost" size="icon-sm" aria-label="Delete phase" onClick={() => { const before = t, name = ph.name; const c = clone(); c.phases.splice(pi, 1); onChange(c); setPi(0); toast(`Deleted the ${name} phase`, { action: { label: "Undo", onClick: () => onChange(before) } }) }}><Trash2 /></Button>}
          </div>
          <div className="grid h-7 grid-cols-[minmax(0,1fr)_150px_150px_120px] items-center gap-3 border-b text-[12.5px] text-muted-foreground"><span>Item</span><span>Only when</span><span>Groundwork tool</span><span className="text-right">Due</span></div>
          {ph.groups.map((g, gi) => (
            <div key={g.id} className="mt-2">
              <div className="flex h-9 items-center gap-2">
                <input value={g.name} onChange={(e) => { const c = clone(); c.phases[pi]!.groups[gi]!.name = e.target.value; onChange(c) }} className="min-w-0 bg-transparent text-[13.5px] font-medium outline-none [field-sizing:content]" aria-label="Group name" />
                <span className="text-[12.5px] text-muted-foreground tabular">{g.items.length}</span>
                {!g.items.length && <button onClick={() => { const c = clone(); c.phases[pi]!.groups.splice(gi, 1); onChange(c) }} className="text-xs text-muted-foreground underline underline-offset-2">Remove group</button>}
              </div>
              {rows(g.items, { phase: pi, group: gi })}
            </div>
          ))}
          <button onClick={() => { const c = clone(); c.phases[pi]!.groups.push({ id: "g" + Date.now().toString(36), name: "New group", items: [] }); onChange(c) }} className="mt-3 flex h-8 items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"><Plus className="size-3.5" />Add group</button>
          <div className="mt-5 rounded-xl border bg-muted/30 px-4 pt-3 pb-1">
            <div className="flex flex-wrap items-center gap-2.5 pb-2">
              <Stamp className="size-4 text-foreground/70" />
              <input value={ph.handoff.title} onChange={(e) => setPhase({ handoff: { ...ph.handoff, title: e.target.value } })} className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium outline-none" aria-label="Sign-off name" />
              <span className="text-[12.5px] text-muted-foreground">Approved by</span>
              <div role="group" className="inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-xs">{(["client", "us"] as const).map((n) => <button key={n} onClick={() => setPhase({ handoff: { ...ph.handoff, needs: n } })} className={cn("rounded px-2 py-1", ph.handoff.needs === n ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{n === "client" ? "The client, in writing" : "Us"}</button>)}</div>
            </div>
            <div className="text-[12.5px] text-muted-foreground">Deliverables</div>
            {rows(ph.handoff.items, { phase: pi, group: "handoff" })}
          </div>
        </div>
      </div>
    </>
  )
}

function DueRuleInput({ value, onChange, allowNone = true }: { value: DueRule | null; onChange: (v: DueRule | null) => void; allowNone?: boolean }) {
  const mode = value ? value.from : "none"
  return (
    <span className="inline-flex items-center gap-1.5">
      <select value={mode} onChange={(e) => onChange(e.target.value === "none" ? null : { from: e.target.value as DueRule["from"], days: value?.days ?? 0 })} className="h-8 rounded-lg border border-input bg-card px-2 text-[13px] text-foreground">
        {allowNone && <option value="none">Phase date</option>}
        {!allowNone && mode === "none" && <option value="none">Not set</option>}
        <option value="kickoff">Kickoff</option>
        <option value="launch">Launch</option>
      </select>
      {value && <><Input type="number" value={value.days} onChange={(e) => onChange({ ...value, days: +e.target.value || 0 })} className="h-8 w-[70px] tabular" /><span className="text-[12.5px] text-muted-foreground">days</span></>}
    </span>
  )
}

function ItemEditor({ it, t, onChange, onDelete, onDone }: { it: TItem; t: ChecklistTemplate; onChange: (p: Partial<TItem>) => void; onDelete: () => void; onDone: () => void }) {
  return (
    <div className="my-1.5 grid gap-3 rounded-xl border border-input bg-card p-4 shadow-[0_2px_8px_rgba(22,23,22,0.06)]">
      <label className="grid gap-1.5 text-[12.5px] text-muted-foreground">Item<Input autoFocus value={it.title} onChange={(e) => onChange({ title: e.target.value })} className="text-foreground" /></label>
      <label className="grid gap-1.5 text-[12.5px] text-muted-foreground">Done means<Textarea value={it.done} onChange={(e) => onChange({ done: e.target.value })} rows={2} placeholder="What has to be true before this is ticked" className="min-h-0 text-foreground" /></label>
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-2.5">
        <div className="grid gap-1.5 text-[12.5px] text-muted-foreground">Who<div role="group" className="flex rounded-lg bg-muted p-0.5">{(["us", "client"] as const).map((w) => <button key={w} onClick={() => onChange({ who: w })} className={cn("h-7 flex-1 rounded-md text-[13px]", it.who === w ? "bg-card font-medium text-foreground shadow-sm" : "")}>{w === "us" ? "Us" : "Client"}</button>)}</div></div>
        <div className="grid gap-1.5 text-[12.5px] text-muted-foreground">Due<DueRuleInput value={it.due} onChange={(due) => onChange({ due })} /></div>
        <label className="grid gap-1.5 text-[12.5px] text-muted-foreground">Only when
          <select value={it.part || ""} onChange={(e) => onChange({ part: e.target.value || null })} className="h-8 rounded-lg border border-input bg-card px-2 text-[13px] text-foreground"><option value="">Always</option>{t.parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="grid gap-1.5 text-[12.5px] text-muted-foreground">Groundwork tool
          <select value={it.tool || ""} onChange={(e) => onChange({ tool: (e.target.value || null) as ToolId | null, check: null })} className="h-8 rounded-lg border border-input bg-card px-2 text-[13px] text-foreground"><option value="">None</option>{(Object.keys(TOOL_NAMES) as ToolId[]).map((k) => <option key={k} value={k}>{TOOL_NAMES[k].name}{TOOL_NAMES[k].ready ? "" : " (soon)"}</option>)}</select>
        </label>
      </div>
      <label className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-2.5 text-[12.5px] text-muted-foreground"><span className="col-span-2">Show it on projects built with</span>
        <select value={it.platforms?.[0] || ""} onChange={(e) => onChange({ platforms: e.target.value ? [e.target.value as PlatformId] : null })} className="col-span-2 h-8 rounded-lg border border-input bg-card px-2 text-[13px] text-foreground"><option value="">Any platform</option>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name} only</option>)}</select>
      </label>
      {(it.tool === "launch" || it.tool === "seo" || it.tool === "redirects" || it.tool === "scan") && (
        <label className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-2.5 text-[12.5px] text-muted-foreground"><span className="col-span-2">{it.tool === "seo" ? "What the SEO plan does for it" : it.tool === "redirects" || it.tool === "scan" ? "What ticks it" : "Which part of the launch check ticks it"}</span>
          <select value={it.check || ""} onChange={(e) => onChange({ check: (e.target.value || null) as TItem["check"] })} className="col-span-2 h-8 rounded-lg border border-input bg-card px-2 text-[13px] text-foreground"><option value="">{it.tool === "scan" ? "Any scan of the old site" : "Guess from the item’s name"}</option>{it.tool === "scan" ? <option value="recrawl">A scan of the old site in the 10 days before launch</option> : it.tool === "seo" ? <><option value="plan">Ticks it when the plan covers every page</option><option value="live">Shows how many changes are done</option></> : it.tool === "redirects" ? <><option value="map">Every old URL has a match</option><option value="live">A test of the live domain passes</option><option value="after">A test after launch day passes</option></> : (Object.keys(LAUNCH_CHECKS) as LaunchCheckId[]).map((k) => <option key={k} value={k}>{LAUNCH_CHECKS[k]}</option>)}</select>
        </label>
      )}
      <div className="flex items-center gap-2"><Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>Delete item</Button><span className="flex-1" /><Button size="sm" onClick={onDone}>Done</Button></div>
    </div>
  )
}

// ---------- messages and emails ----------
function MessageEditor({ t, onChange }: { t: MessageTemplate; onChange: (t: MessageTemplate) => void }) {
  const { projects, prefs } = useApp()
  // Audits have no client or checklist, so they'd preview as "Hi there, [Project]".
  const work = projects.filter((p) => p.kind !== "audit")
  const [pid, setPid] = React.useState(work[0]?.id || "")
  const [proj, setProj] = React.useState<Project | null>(null)
  const body = React.useRef<HTMLTextAreaElement>(null)
  const subject = React.useRef<HTMLInputElement>(null)
  const lastField = React.useRef<"body" | "subject">("body")
  React.useEffect(() => { if (!pid && work[0]) setPid(work[0].id) }, [work, pid])
  React.useEffect(() => { if (pid) api.project(pid).then(setProj).catch(() => setProj(null)) }, [pid])
  const insert = (v: string) => {
    const tok = `{${v}}`
    const el = lastField.current === "subject" && t.kind === "email" ? subject.current : body.current
    const key = el === subject.current ? "subject" : "body"
    const cur = t[key] || "", a = el?.selectionStart ?? cur.length, b = el?.selectionEnd ?? cur.length
    onChange({ ...t, [key]: cur.slice(0, a) + tok + cur.slice(b) })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + tok.length, a + tok.length) })
  }
  const items = proj ? [...proj.client.late, ...proj.client.soon] : []
  const out = renderMessage(t, proj, prefs.appliedBy || "", items)
  const isReq = t.use?.includes("client-request")
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
      <div className="grid gap-7 px-8 py-7 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="grid min-w-0 content-start gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium">Name<Input value={t.name} onChange={(e) => onChange({ ...t, name: e.target.value })} className="font-normal" /></label>
            <div className="grid gap-1.5 text-[13px] font-medium">Type<div role="group" className="flex rounded-lg bg-muted p-0.5">{(["message", "email"] as const).map((k) => <button key={k} onClick={() => onChange({ ...t, kind: k })} className={cn("h-8 flex-1 rounded-md text-[13px] font-normal", t.kind === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{k === "message" ? "Message" : "Email"}</button>)}</div></div>
          </div>
          {t.kind === "email" && <label className="grid gap-1.5 text-[13px] font-medium">Subject<Input ref={subject} value={t.subject} onFocus={() => (lastField.current = "subject")} onChange={(e) => onChange({ ...t, subject: e.target.value })} className="font-normal" /></label>}
          <div className="grid gap-2">
            <span className="text-[13px] font-medium">{t.kind === "email" ? "Email" : "Message"}</span>
            <div className="flex flex-wrap gap-1.5">{VARIABLES.map((v) => <button key={v} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)} className="inline-flex h-[26px] items-center gap-1 rounded-full border bg-card px-2.5 text-[12.5px] text-foreground/75 hover:bg-muted"><span className="text-muted-foreground">+</span>{v[0]!.toUpperCase() + v.slice(1)}</button>)}</div>
            <Textarea ref={body} value={t.body} onFocus={() => (lastField.current = "body")} onChange={(e) => onChange({ ...t, body: e.target.value })} rows={14} className="text-[14px] leading-relaxed" />
            <p className="text-[12.5px] text-muted-foreground">Words in braces, like {"{project}"}, are filled in from the project.</p>
          </div>
          <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={!!isReq} onChange={(e) => onChange({ ...t, use: e.target.checked ? ["client-request"] : [] })} className="size-[15px] accent-foreground" />Use it as the request message on the Client tab</label>
        </div>
        <section className="flex flex-col gap-3.5 self-start rounded-xl border bg-card p-[18px]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5"><h2 className="text-sm font-medium">Preview</h2>
            {work.length > 0 && <select value={pid} onChange={(e) => setPid(e.target.value)} className="h-8 max-w-52 rounded-lg border border-input bg-card px-2 text-[13px]">{work.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          </div>
          {t.kind === "email" && <div className="text-[13px]"><span className="text-muted-foreground">Subject:</span> {out.subject}</div>}
          <div className="rounded-[10px] border bg-background px-4 py-3.5 text-[13.5px] leading-relaxed whitespace-pre-line">{out.body}</div>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{work.length ? "Filled in with this project’s details. Each item gets its due date, and late items say when they were due." : "Start a project to see this filled in."}{!prefs.appliedBy && " Add your name in Settings to sign it."}</p>
        </section>
      </div>
    </div>
  )
}
