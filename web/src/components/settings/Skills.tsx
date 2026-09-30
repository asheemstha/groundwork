import * as React from "react"
import { cn } from "cn"
import { Check, ChevronDown, Copy, FileArchive, FolderOpen, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ChipButton } from "@/components/composer/pickers"
import { api, type Skill, type SkillTool, type Skills as SkillsData } from "@/lib/api"
import { go, routes } from "@/lib/router"

// One copy of the list for the whole app, so the settings page and the Run panel agree.
let cache: SkillsData | null = null
const subs = new Set<(s: SkillsData) => void>()
const publish = (s: SkillsData) => { cache = s; subs.forEach((f) => f(s)) }
export function useSkills() {
  const [s, setS] = React.useState<SkillsData | null>(cache)
  React.useEffect(() => {
    subs.add(setS)
    api.skills().then(publish).catch(() => {})
    return () => { subs.delete(setS) }
  }, [])
  return { data: s, set: publish }
}

const b64 = (f: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = no; r.readAsDataURL(f) })
const day = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })

/** Both tools' skills, one list each. */
export function SkillsSection() {
  return (
    <div className="grid gap-6">
      <div><h3 className="mb-1 text-[14px] font-medium">Heading plan</h3><p className="mb-2.5 text-[13px] text-muted-foreground">The rulebook for H1 to H6: which tags to fix and how to write headings.</p><SkillList tool="headings" /></div>
      <div><h3 className="mb-1 text-[14px] font-medium">SEO plan</h3><p className="mb-2.5 text-[13px] text-muted-foreground">How titles, meta descriptions and URLs are written. An added skill is read first and wins, except the character limits the app checks.</p><SkillList tool="seo" /></div>
    </div>
  )
}

function SkillList({ tool }: { tool: SkillTool }) {
  const { data: all, set } = useSkills()
  const data = all?.[tool]
  const [busy, setBusy] = React.useState(false)
  const [removing, setRemoving] = React.useState<Skill | null>(null)
  const folder = React.useRef<HTMLInputElement>(null), zip = React.useRef<HTMLInputElement>(null)
  const added = (r: SkillsData) => { set(r); const s = r[tool].skills.find((x) => x.id === r.added); toast.success(`Added ${s?.name || "the skill"}`, { description: "It’s the one in use now." }) }
  const addFolder = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    try {
      const files = await Promise.all([...list].filter((f) => !/(^|\/)\./.test(f.webkitRelativePath) && f.size < 5e6).map(async (f) => ({ path: f.webkitRelativePath || f.name, data: await b64(f) })))
      added(await api.addSkill({ files, tool }))
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false); if (folder.current) folder.current.value = "" }
  }
  const addZip = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { added(await api.addSkill({ zip: await b64(f), tool })) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false); if (zip.current) zip.current.value = "" }
  }
  const use = async (id: string) => { try { set(await api.useSkill(id)) } catch (e) { toast.error((e as Error).message) } }
  if (!data) return null
  return (
    <div className="overflow-hidden rounded-2xl border bg-card text-sm">
      {data.skills.map((s) => {
        const on = s.id === data.active
        const rules = tool === "headings" && s.missing.some((m) => m.file === "references/heading-rules.md"), tpl = tool === "headings" && s.missing.some((m) => m.file === "assets/heading-map-template.html")
        return (
          <div key={s.id} className={cn("grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-3 border-b p-4 last:border-b-0", on && "bg-muted/40")}>
            <button onClick={() => !on && use(s.id)} aria-label={`Use ${s.name}`} className={cn("mt-0.5 grid size-[18px] place-items-center rounded-full border-[1.5px]", on ? "border-foreground bg-foreground text-background" : "border-input hover:border-foreground/50")}>{on && <Check className="size-3" strokeWidth={3} />}</button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{s.builtin ? "Built in, can’t be deleted" : `Added ${day(s.added || 0)}`}</span></div>
              {s.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{s.description}</p>}
              {!s.builtin && (rules || tpl) && <p className="mt-1.5 text-xs text-muted-foreground">{[rules && "No heading-rules.md, so the AI follows SKILL.md alone", tpl && "exports use the built-in guide template"].filter(Boolean).join(". ").replace(/^./, (c) => c.toUpperCase())}.</p>}
            </div>
            <div className="flex items-center gap-1.5">
              {on ? <span className="px-2 text-xs text-muted-foreground">In use</span> : <Button size="sm" variant="outline" onClick={() => use(s.id)}>Use</Button>}
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`More for ${s.name}`} />}><MoreHorizontal /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => api.copySkill(s.id).then((r) => { set(r); toast.success("Made an editable copy", { description: "Open its folder to change the rules." }) }).catch((e) => toast.error(e.message))}><Copy />Make an editable copy</DropdownMenuItem>
                  {!s.builtin && <DropdownMenuItem onClick={() => api.openSkill(s.id).catch((e) => toast.error(e.message))}><FolderOpen />Open its folder</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
              {!s.builtin && <Button size="icon-sm" variant="ghost" onClick={() => setRemoving(s)} aria-label={`Delete ${s.name}`}><Trash2 /></Button>}
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={busy} />}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}Add a skill<ChevronDown className="opacity-60" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onClick={() => folder.current?.click()}><FolderOpen />A folder with SKILL.md…</DropdownMenuItem>
            <DropdownMenuItem onClick={() => zip.current?.click()}><FileArchive />A .zip or .skill file…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-[12.5px] text-muted-foreground">To change the rules, make an editable copy of the built-in one and open its folder. Plans read the files each time they start.</span>
        <input ref={folder} type="file" className="hidden" onChange={(e) => addFolder(e.target.files)} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
        <input ref={zip} type="file" accept=".zip,.skill" className="hidden" onChange={(e) => addZip(e.target.files?.[0])} />
      </div>
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>{removing?.id === data.active ? `It’s the one in use, so ${tool === "seo" ? "SEO plans" : "heading plans"} go back to the built-in one. ` : ""}Plans already made with it keep their copy. You can’t undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => { const s = removing!; setRemoving(null); try { set(await api.removeSkill(s.id)); toast(`Deleted ${s.name}`) } catch (e) { toast.error((e as Error).message) } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Which skill the next plan uses, for the Run panel. With `always` it shows even when only the built-in exists. */
export function SkillPicker({ tool = "headings", always }: { tool?: SkillTool; always?: boolean }) {
  const { data: all, set } = useSkills()
  const data = all?.[tool]
  if (!data || (data.skills.length < 2 && !always)) return null
  const cur = data.skills.find((s) => s.id === data.active) || data.skills[0]!
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<ChipButton />}><FolderOpen />{cur.name}<ChevronDown className="opacity-60" /></DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Skill for this plan</DropdownMenuLabel>
          {data.skills.map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => api.useSkill(s.id).then(set).catch((e) => toast.error(e.message))}>
              <span className="flex-1">{s.name}{s.builtin && <span className="text-muted-foreground"> · built in</span>}</span>
              <Check className={cn(s.id !== cur.id && "invisible")} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go(routes.settings())}>Manage skills…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
