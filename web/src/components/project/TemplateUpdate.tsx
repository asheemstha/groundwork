import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, type Project, type TemplateUpdate } from "@/lib/api"

export const updateFromTemplate = () => window.dispatchEvent(new CustomEvent("gw:template-update"))

const FIELD: Record<string, string> = { title: "wording", done: "what done means", who: "whose it is", due: "due date rule", tool: "Groundwork tool", check: "what ticks it", part: "which part it belongs to" }

/** Bring template changes into a running project. What you've ticked, noted or dated stays as it is. */
export function TemplateUpdateDialog({ p, onDone }: { p: Project; onDone: (x: Project) => void }) {
  const [open, setOpen] = React.useState(false)
  const [d, setD] = React.useState<TemplateUpdate | null>(null)
  const [remove, setRemove] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    const on = () => { setOpen(true); setD(null); api.templateUpdate(p.id, { dryRun: true }).then(setD).catch((e) => { toast.error(e.message); setOpen(false) }) }
    window.addEventListener("gw:template-update", on)
    return () => window.removeEventListener("gw:template-update", on)
  }, [p.id])
  const untouched = d?.removed.filter((x) => !x.touched) || []
  const none = d && !d.added.length && !d.changed.length && !d.removed.length
  const apply = async () => {
    setBusy(true)
    try { const r = await api.templateUpdate(p.id, { removeUntouched: remove }); if (r.project) onDone(r.project); toast.success("Updated from the template"); setOpen(false) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const List = ({ title, children, n }: { title: string; n: number; children: React.ReactNode }) => n ? <div className="grid gap-1.5"><span className="font-medium">{title} <span className="font-normal text-muted-foreground tabular">{n}</span></span><ul className="grid max-h-40 gap-1 overflow-auto rounded-lg bg-muted/50 px-3.5 py-2.5 text-[13px]">{children}</ul></div> : null
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Update from {d?.template || "the template"}</DialogTitle>
          <DialogDescription>Brings the template’s changes into this project. Everything you’ve ticked, noted or dated stays as it is.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5 text-[13.5px]">
          {!d ? <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div> : none ? <p className="text-muted-foreground">The project already matches the template.</p> : <>
            <List title="New items" n={d.added.length}>{d.added.map((x, i) => <li key={i}>{x.title} <span className="text-muted-foreground">in {x.phase}</span></li>)}</List>
            <List title="Changed" n={d.changed.length}>{d.changed.map((x, i) => <li key={i}>{x.title} <span className="text-muted-foreground">({x.fields.map((f) => FIELD[f] || f).join(", ")})</span></li>)}</List>
            <List title="No longer in the template" n={d.removed.length}>{d.removed.map((x) => <li key={x.id}>{x.title} <span className="text-muted-foreground">{x.touched ? "kept, you’ve worked on it" : `in ${x.phase}`}</span></li>)}</List>
            {untouched.length > 0 && <label className="flex items-center gap-2.5"><input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} className="size-[15px] accent-foreground" />Remove the {untouched.length} you haven’t worked on</label>}
          </>}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <Button variant="outline" onClick={() => setOpen(false)}>{none ? "Close" : "Cancel"}</Button>
          {!none && <Button onClick={apply} disabled={busy || !d}>{busy && <Loader2 className="animate-spin" />}Update the project</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
