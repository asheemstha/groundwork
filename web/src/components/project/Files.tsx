import * as React from "react"
import { cn } from "cn"
import { Copy, FolderOpen, Plus, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DateField } from "@/components/common/DateField"
import { useApp } from "@/hooks/useApp"
import { api, type FileRequest, type Project } from "@/lib/api"
import { fmtDay } from "@/lib/project"

// A path under the home folder, shortened the way Finder people read it.
const short = (f: string) => f.replace(/^\/Users\/[^/]+/, "~")
const when = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" })

/**
 * What you need from the client: copy for each page to rewrite, the logo, fonts and photos, and anything else. Each
 * request is ticked off when a file that fits lands in the project's folder, so nobody has to say "it's in Dropbox".
 */
export function FilesSection({ p, setP, focus }: { p: Project; setP: (x: Project) => void; focus?: boolean }) {
  const { prefs } = useApp()
  const rq = p.requests
  const [rows, setRows] = React.useState<FileRequest[]>(rq.rows)
  const [adding, setAdding] = React.useState("")
  const [looking, setLooking] = React.useState(false)
  const ref = React.useRef<HTMLElement>(null)
  React.useEffect(() => setRows(p.requests.rows), [p.requests.rows])
  React.useEffect(() => { if (focus) ref.current?.scrollIntoView({ block: "start" }) }, [focus])
  const save = async (b: Parameters<typeof api.setRequests>[1]) => { try { setP(await api.setRequests(p.id, b)) } catch (e) { toast.error((e as Error).message) } }
  // A look in the folder when the tab opens and every half minute while it's open, so new files tick off quickly.
  const look = React.useCallback(async (said = false) => {
    if (!p.requests.folder) return
    setLooking(said)
    try {
      const r = await api.scanRequests(p.id)
      if (r.came || said) setP(r)
      if (r.came) toast(`${r.came} ${r.came === 1 ? "file" : "files"} came in from the client`)
      else if (said) toast("Nothing new in the folder")
    } catch (e) { if (said) toast.error((e as Error).message) } finally { setLooking(false) }
  }, [p.id, p.requests.folder, setP])
  React.useEffect(() => {
    if (!rq.folder || !rq.waiting) return
    look()
    const t = setInterval(() => look(), 30000)
    return () => clearInterval(t)
  }, [rq.folder, rq.waiting, look])
  const pick = async () => { try { setP(await api.requestFolder(p.id)) } catch (e) { toast.error((e as Error).message) } }
  const edit = (id: string, patch: Partial<FileRequest>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const add = () => { const t = adding.trim(); if (!t) return; setAdding(""); save({ add: [{ title: t }] }) }

  const waiting = rows.filter((r) => r.status === "waiting")
  const hasBrand = rows.some((r) => r.kind === "brand")
  const rewrite = p.tools.inventory?.rewrite || 0
  const fromInv = rows.filter((r) => r.kind === "content" && r.path).length
  const shared = p.accounts.find((a) => a.kind === "files")?.where.trim()
  const copyList = () => {
    const first = p.clientName ? p.clientName.split(" ")[0] : ""
    const text = [
      `Hi${first ? " " + first : ""},`,
      "",
      `Here’s what we still need for ${p.name}${rq.due ? `, by ${fmtDay(rq.due, true)}` : ""}:`,
      ...waiting.map((r) => `- ${r.title}`),
      "",
      `Put them in ${shared || "the shared folder"}. Naming each file after what it is (like “about page copy”) means we see it as soon as it lands.`,
      ...(prefs.appliedBy ? ["", prefs.appliedBy] : []),
    ].join("\n")
    navigator.clipboard.writeText(text)
    toast("Copied the list", { description: "Groundwork doesn’t send anything. Paste it wherever you talk to the client." })
  }
  const cols = "grid-cols-[18px_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_104px]"
  return (
    <section ref={ref} className="grid scroll-mt-4 gap-2 px-12 pb-12">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[16px] font-medium">Files from the client</h2>
        {rows.length > 0 && <span className="text-[13px] text-muted-foreground tabular">{rows.length - waiting.length} of {rows.length} in</span>}
        {rq.late && <span className="text-[13px] text-destructive">{waiting.length} late</span>}
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">Everything you need from {p.clientName ? p.clientName.split(" ")[0] : "the client"}, ticked off when a file that fits lands in the project’s folder: the shared Dropbox, Google Drive or iCloud folder on this Mac. A file fits when its name or its folder has the request’s match words. Groundwork reads file names only.</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        {rq.folder ? (
          <span className="flex min-w-0 items-center gap-2">
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("shrink-0", !rq.folderOk && "text-destructive")} title={rq.folder}>{rq.folder.split("/").filter(Boolean).pop()}{!rq.folderOk && ", not on this Mac any more"}</span>
            <span className="max-w-[360px] truncate text-muted-foreground" title={rq.folder}>in {short(rq.folder.split("/").slice(0, -1).join("/") || "/")}</span>
            {rq.folderOk && <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => api.openRequestFolder(p.id).catch((e) => toast.error(e.message))}>Show in Finder</Button>}
            <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={pick}>Change</Button>
            {rq.folderOk && rq.waiting > 0 && <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => look(true)} disabled={looking}><RefreshCw className={cn(looking && "animate-spin")} />Look now</Button>}
          </span>
        ) : <Button size="sm" variant="outline" onClick={pick}><FolderOpen />Choose the project’s folder</Button>}
        <span className="flex items-center gap-1 text-muted-foreground">Due<DateField value={rq.due} onChange={(v) => save({ due: v })} placeholder="No date" clearable /></span>
      </div>

      <div className="mt-2 text-[13.5px]">
        <div className={cn("grid h-[30px] items-center gap-3 border-b text-[12.5px] text-muted-foreground", cols)}><span /><span>What you need</span><span>Match words</span><span>File</span><span /></div>
        {rows.map((r) => (
          <div key={r.id} className={cn("group grid min-h-11 items-center gap-3 border-b border-border/60", cols)}>
            <Checkbox checked={r.status === "in"} onCheckedChange={(v) => save({ set: { [r.id]: { status: v ? "in" : "waiting" } } })} aria-label={r.status === "in" ? `Mark ${r.title} as still to come` : `Mark ${r.title} as received`} />
            <input value={r.title} onChange={(e) => edit(r.id, { title: e.target.value })} onBlur={(e) => e.target.value.trim() && e.target.value !== rq.rows.find((x) => x.id === r.id)?.title && save({ set: { [r.id]: { title: e.target.value } } })} aria-label="What you need" className={cn("-ml-1.5 h-8 min-w-0 rounded-md bg-transparent px-1.5 outline-none hover:bg-muted/60 focus:bg-muted/60", r.status === "in" && "text-muted-foreground")} />
            <MatchInput r={r} onSave={(match) => save({ set: { [r.id]: { match } } })} />
            <span className="flex min-w-0 items-baseline gap-2">
              {r.file ? <><span className="truncate" title={r.file.name}>{r.file.name}</span><span className="shrink-0 text-[12.5px] text-muted-foreground">{when(r.file.at)}</span></>
                : r.status === "in" ? <span className="text-muted-foreground">Ticked by hand{r.in ? `, ${when(r.in)}` : ""}</span>
                : <span className={cn(rq.late ? "text-destructive" : "text-muted-foreground")}>{rq.late ? "Late" : "Still to come"}</span>}
            </span>
            <span className="flex justify-end">
              {r.file ? <Button size="xs" variant="ghost" className="text-muted-foreground opacity-70 group-hover:opacity-100 hover:text-foreground" onClick={() => save({ set: { [r.id]: { status: "waiting" } } })}>Not this file</Button>
                : <button onClick={() => save({ remove: [r.id] })} aria-label={`Remove ${r.title}`} className="grid size-6 place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"><X className="size-3.5" /></button>}
            </span>
          </div>
        ))}
        <div className={cn("grid min-h-11 items-center gap-3 border-b border-border/60", cols)}>
          <Plus className="size-4 text-muted-foreground" />
          <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} onBlur={add} placeholder="Add one, like “Headshots for the team page”" aria-label="Add a request" className="-ml-1.5 h-8 min-w-0 rounded-md bg-transparent px-1.5 outline-none placeholder:text-muted-foreground/70 hover:bg-muted/60 focus:bg-muted/60" />
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {!hasBrand && <Button size="sm" variant="outline" onClick={() => save({ usual: true })}>Add the usual: logo, fonts, guidelines, photos</Button>}
        {rewrite > 0 && fromInv < rewrite && <Button size="sm" variant="outline" onClick={() => save({ fromInventory: true })}>Add copy for the {rewrite} {rewrite === 1 ? "page" : "pages"} to rewrite</Button>}
        {waiting.length > 0 && <Button size="sm" variant="outline" onClick={copyList}><Copy />Copy the list for the client</Button>}
      </div>
    </section>
  )
}

// The match words, edited as plain text: "about", "team headshots".
function MatchInput({ r, onSave }: { r: FileRequest; onSave: (match: string) => void }) {
  const [v, setV] = React.useState(r.match.join(" "))
  React.useEffect(() => setV(r.match.join(" ")), [r.match])
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== r.match.join(" ") && onSave(v)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="Words in the file name" aria-label={`Match words for ${r.title}`} spellCheck={false}
      className="-ml-1.5 h-8 min-w-0 rounded-md bg-transparent px-1.5 text-muted-foreground outline-none placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:bg-muted/60 focus:text-foreground" />
  )
}
