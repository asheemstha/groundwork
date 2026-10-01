import * as React from "react"
import { cn } from "cn"
import { Check, Download, Loader2, Play, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/common/bits"
import { ToolCard } from "@/components/project/ToolCard"
import { useApp } from "@/hooks/useApp"
import { api, type Decision, type Inventory, type InventoryRow, type Project } from "@/lib/api"
import { go, routes } from "@/lib/router"

const DECISION: Record<Decision, string> = { keep: "Keep", rewrite: "Rewrite", merge: "Merge", remove: "Remove" }
const BY: Record<InventoryRow["by"], string> = { rule: "Suggested", ai: "AI suggests", you: "You chose" }
type Filter = "review" | Decision | "all"
const when = (at: number) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

/** Tools tab card: the old site's pages with a call on each, before the new sitemap is final. */
export function InventoryCard({ p }: { p: Project }) {
  const inv = p.tools.inventory
  if (!p.sites.old) return null
  return (
    <ToolCard
      title="Content inventory" cost="rules on your Mac, AI optional"
      status={inv ? <>{inv.total} pages: {inv.keep} keep, {inv.rewrite} rewrite, {inv.merge} merge, {inv.remove} remove{inv.review ? `, ${inv.review} to look at` : ""}.</> : p.tools.oldScan ? "Every page on the old site with a call on it: keep, rewrite, merge into another page, or remove. Made from the scan, so the new sitemap starts from what’s there." : "Scan the old site first. The inventory starts from its pages."}
      action={<Button size="sm" variant="outline" onClick={() => go(routes.project(p.id, "inventory"))} disabled={!p.tools.oldScan && !inv}>{inv ? "Open the inventory" : "Make the inventory"}</Button>}
    />
  )
}

export function InventoryPage({ p, reload }: { p: Project; reload: () => void }) {
  const { status } = useApp()
  const [inv, setInv] = React.useState<Inventory | null | undefined>(undefined)
  const [busy, setBusy] = React.useState<"" | "rules" | "ai">("")
  const [filter, setFilter] = React.useState<Filter>("review")
  const [q, setQ] = React.useState("")
  const [limit, setLimit] = React.useState(200)
  React.useEffect(() => { api.inventory(p.id).then((x) => { setInv(x); if (x && !x.rows.some((r) => !r.sure)) setFilter("all") }).catch(() => setInv(null)) }, [p.id])
  const aiReady = !!(status?.engines.claude?.loggedIn || status?.engines.codex?.loggedIn)
  const build = async (ai: boolean) => {
    setBusy(ai ? "ai" : "rules")
    try { const x = await api.buildInventory(p.id, ai); setInv(x); setFilter(x.rows.some((r) => !r.sure) ? "review" : "all"); reload() } catch (e) { toast.error((e as Error).message) } finally { setBusy("") }
  }
  const save = async (b: Parameters<typeof api.setInventory>[1]) => { try { setInv(await api.setInventory(p.id, b)); reload() } catch (e) { toast.error((e as Error).message) } }
  const apply = async () => {
    try { const r = await api.applyInventory(p.id); toast(r.changed ? `Updated ${r.changed} ${r.changed === 1 ? "redirect" : "redirects"}` : "The redirect map already matches", { description: r.changed ? "Merged pages now go where the page they merge into goes." : undefined }); reload() } catch (e) { toast.error((e as Error).message) }
  }
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const lines = [["URL", "Title", "Words", "In the menu", "Decision", "Into", "Why"].map(esc).join(","), ...inv!.rows.map((r) => [r.path, r.title, r.words ?? "", r.nav ? "yes" : "", DECISION[r.decision], r.into || "", r.reason].map(esc).join(","))]
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = `${p.name} content inventory.csv`; a.click()
  }

  if (inv === undefined) return <div className="grid place-items-center py-24"><Spinner /></div>
  const aiNote = <p className="text-[12.5px] leading-relaxed text-muted-foreground">{aiReady ? "With AI, the list of pages (addresses, titles, H1s, word counts and the first lines of each page) goes to Anthropic (Claude) or OpenAI (ChatGPT) through your own account, and nothing else does." : "Sign in to Claude Code or Codex in Settings to have AI make the calls instead."}</p>
  if (!inv) return (
    <div className="grid mx-auto w-full max-w-4xl gap-4 px-12 pt-8 pb-10">
      <div><h1 className="text-[24px] leading-tight font-medium">Content inventory</h1><p className="mt-1.5 text-sm text-muted-foreground">{p.tools.oldScan ? `Every page the scan found on the old site (${p.tools.oldScan.urls}), with a call on each: keep, rewrite, merge into another page, or remove. The rules look at how much is on a page, whether it’s in the menu, pages with the same title, and pages that don’t load. You make the final call.` : "Scan the old site first in the Tools tab. The inventory starts from its pages."}</p></div>
      {p.tools.oldScan && <div className="flex flex-wrap gap-2"><Button onClick={() => build(false)} disabled={!!busy}>{busy === "rules" ? <Loader2 className="animate-spin" /> : <Play />}Make the inventory</Button>{aiReady && <Button variant="outline" onClick={() => build(true)} disabled={!!busy}>{busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />}Make it with AI</Button>}</div>}
      {p.tools.oldScan && aiNote}
    </div>
  )

  const rows = inv.rows
  const counts: Record<Filter, number> = { review: rows.filter((r) => !r.sure).length, keep: 0, rewrite: 0, merge: 0, remove: 0, all: rows.length }
  for (const r of rows) counts[r.decision]++
  const list = rows.filter((r) => (filter === "all" || (filter === "review" ? !r.sure : r.decision === filter)) && (!q || (r.path + " " + r.title).toLowerCase().includes(q.toLowerCase())))
  const cols = "grid-cols-[minmax(0,1fr)_64px_128px_minmax(0,1fr)_28px]"
  return (
    <div className="grid mx-auto w-full max-w-6xl gap-5 px-12 pt-8 pb-10">
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => build(false)} disabled={!!busy}>{busy === "rules" && <Loader2 className="animate-spin" />}Suggest again</Button>
        {aiReady && <Button variant="outline" size="sm" onClick={() => build(true)} disabled={!!busy}>{busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />}Suggest with AI</Button>}
        {p.tools.redirects && counts.merge > 0 && <Button variant="outline" size="sm" onClick={apply}>Send merged pages to the redirect map</Button>}
        <Button size="sm" onClick={exportCsv}><Download />Export CSV</Button>
      </div>
      <div>
        <h1 className="text-[24px] leading-tight font-medium">{counts.review ? `${counts.review} ${counts.review === 1 ? "page" : "pages"} to look at` : "Content inventory"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{rows.length} pages from {inv.host}, {inv.ai ? "suggested with AI" : "suggested by rules"} {when(inv.at)}. Your own calls are kept when you suggest again. The checklist item ticks once every page has a call you’re happy with.</p>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {(["keep", "rewrite", "merge", "remove"] as Decision[]).map((d) => <button key={d} onClick={() => setFilter(d)} className="bg-card p-4 text-left hover:bg-muted/30"><div className="text-2xl font-medium tabular">{counts[d]}</div><div className="text-xs text-muted-foreground">{DECISION[d].toLowerCase()}</div></button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Show" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {([["review", "To look at"], ["keep", "Keep"], ["rewrite", "Rewrite"], ["merge", "Merge"], ["remove", "Remove"], ["all", "All"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => { setFilter(k); setLimit(200) }} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]", filter === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}<span className="text-xs font-normal text-muted-foreground tabular">{counts[k]}</span></button>
          ))}
        </div>
        <span className="flex-1" />
        {filter === "review" && list.length > 1 && <Button variant="outline" size="sm" onClick={() => save({ accept: list.map((r) => r.path) })}><Check />Accept all {list.length}</Button>}
        <div className="relative w-64"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a page" className="h-8 pl-8 text-[13px]" /></div>
      </div>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className={cn("grid h-9 items-center gap-3 border-b px-4 text-[12.5px] text-muted-foreground", cols)}><span>Page</span><span className="text-right">Words</span><span>Decision</span><span>Why</span><span /></div>
        {list.slice(0, limit).map((r) => (
          <div key={r.path} className={cn("grid min-h-12 items-center gap-3 border-b border-border/60 px-4 py-2 last:border-b-0", cols)}>
            <span className="grid min-w-0 gap-0.5"><a href={new URL(r.path, "https://" + inv.host).href} target="_blank" rel="noreferrer" className="truncate text-[13.5px] hover:underline">{r.path}</a><span className="truncate text-xs text-muted-foreground">{r.title || r.name}{r.nav ? " · in the menu" : ""}{r.status && r.status >= 400 ? ` · HTTP ${r.status}` : ""}</span></span>
            <span className="text-right text-[13px] text-muted-foreground tabular">{r.words ?? "Not read"}</span>
            <span className="grid gap-1">
              <select value={r.decision} onChange={(e) => { const d = e.target.value as Decision; save({ set: { [r.path]: { decision: d, into: d === "merge" ? r.into || rows.find((x) => x.path !== r.path && x.nav)?.path || "/" : null } } }) }} aria-label={`Decision for ${r.path}`} className={cn("h-8 rounded-lg border border-input bg-card px-2 text-[13px]", r.decision === "remove" && "text-destructive")}>
                {(Object.keys(DECISION) as Decision[]).map((d) => <option key={d} value={d}>{DECISION[d]}</option>)}
              </select>
              {r.decision === "merge" && (
                <select value={r.into || ""} onChange={(e) => save({ set: { [r.path]: { decision: "merge", into: e.target.value } } })} aria-label={`Merge ${r.path} into`} className="h-7 rounded-md border border-input bg-card px-1.5 text-[12px] text-muted-foreground">
                  {rows.filter((x) => x.path !== r.path && x.decision !== "remove" && x.decision !== "merge").map((x) => <option key={x.path} value={x.path}>into {x.path}</option>)}
                </select>
              )}
            </span>
            <span className="grid min-w-0 gap-0.5"><span className="text-[13px]">{r.reason}</span><span className="text-xs text-muted-foreground">{BY[r.by]}</span></span>
            {!r.sure ? <Button variant="ghost" size="icon-xs" onClick={() => save({ accept: [r.path] })} aria-label="This call looks right" title="Looks right"><Check /></Button> : <span />}
          </div>
        ))}
        {!list.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">{filter === "review" ? "Every page has a call you’re happy with." : "No pages in this list."}</p>}
        {list.length > limit && <button onClick={() => setLimit(limit + 300)} className="w-full border-t py-2.5 text-[13px] text-muted-foreground hover:text-foreground">Show {Math.min(300, list.length - limit)} more of {list.length - limit}</button>}
      </section>
      {aiNote}
    </div>
  )
}
