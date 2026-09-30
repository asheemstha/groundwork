import * as React from "react"
import { cn } from "cn"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, type Project, type ShiftPreview } from "@/lib/api"
import { fmtDay } from "@/lib/project"

/** Open the Move dates dialog from anywhere on the project page. */
export const shiftPlan = () => window.dispatchEvent(new CustomEvent("gw:shift-plan"))

/**
 * Move dates: when a project slips, move every unfinished due date (and the phase sign-offs) by the same
 * number of days, with the launch date too if you want. Done items keep their dates. Undo is one click.
 */
export function ShiftDialog({ p, onDone }: { p: Project; onDone: (x: Project) => void }) {
  const [open, setOpen] = React.useState(false)
  const catchUp = Math.max(1, p.behind.days)
  const [days, setDays] = React.useState(catchUp)
  const [launch, setLaunch] = React.useState(true)
  const [pre, setPre] = React.useState<ShiftPreview | null>(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    const on = () => { setDays(Math.max(1, p.behind.days) || 7); setLaunch(true); setPre(null); setOpen(true) }
    window.addEventListener("gw:shift-plan", on)
    return () => window.removeEventListener("gw:shift-plan", on)
  }, [p.behind.days])
  React.useEffect(() => {
    if (!open || !days) return
    const t = setTimeout(() => api.previewShift(p.id, { days, launch }).then(setPre).catch(() => setPre(null)), 150)
    return () => clearTimeout(t)
  }, [open, days, launch, p.id])

  const go = async () => {
    setBusy(true)
    try {
      onDone(await api.shiftPlan(p.id, { days, launch }))
      setOpen(false)
      const moved = launch && p.launch
      toast.success(`Moved the dates by ${days} ${days === 1 ? "day" : "days"}`, {
        description: moved ? `Launch is now ${fmtDay(pre?.launch.to)}.` : "The launch date stays.",
        action: { label: "Undo", onClick: () => api.shiftPlan(p.id, { days: -days, launch: !!moved }).then(onDone).catch((e) => toast.error(e.message)) },
      })
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const presets: [number, string][] = [[7, "1 week"], [14, "2 weeks"], ...(p.behind.days > 1 && ![7, 14].includes(p.behind.days) ? [[catchUp, `Catch up, ${catchUp} days`] as [number, string]] : [])]
  const clash = pre?.phases.filter((x) => x.clash) || []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Move the dates</DialogTitle>
          <DialogDescription>Moves every unfinished item’s due date and each phase’s sign-off by the same number of days. Done items keep their dates.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5 text-[13.5px]">
          <div className="grid gap-2">
            <span className="font-medium">Move by</span>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="number" min={1} max={365} value={days || ""} onChange={(e) => setDays(Math.min(365, Math.max(0, Math.round(+e.target.value))))} className="h-8 w-20 tabular" />
              <span className="text-muted-foreground">days</span>
              <span className="w-2" />
              {presets.map(([n, l]) => <button key={l} onClick={() => setDays(n)} className={cn("h-7 rounded-full border px-2.5 text-[12.5px]", days === n ? "border-foreground/40 bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
            </div>
            {p.behind.days > 0 && <p className="text-[12.5px] text-muted-foreground">The oldest late item in this phase is {p.behind.days} {p.behind.days === 1 ? "day" : "days"} late.</p>}
          </div>
          {p.launch && (
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} className="size-[15px] accent-foreground" />
              <span>Move the launch date too</span>
              {pre && launch && <span className="text-muted-foreground">{fmtDay(pre.launch.from)} <ArrowRight className="inline size-3" /> {fmtDay(pre.launch.to)}</span>}
            </label>
          )}
          {pre && (
            <div className="grid gap-2 rounded-lg bg-muted/60 px-3.5 py-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5">
                <span className="text-muted-foreground">Late items</span><span className="text-right tabular">{pre.late.before} <ArrowRight className="inline size-3 text-muted-foreground" /> {pre.late.after}</span>
                {pre.phases.map((x) => (
                  <React.Fragment key={x.name}>
                    <span className="text-muted-foreground">{x.name} sign-off</span>
                    <span className={cn("text-right tabular", x.clash && "text-destructive")}>{fmtDay(x.from)} <ArrowRight className="inline size-3 text-muted-foreground" /> {fmtDay(x.to)}</span>
                  </React.Fragment>
                ))}
              </div>
              {pre.late.after > 0 && <p className="text-[12.5px] text-muted-foreground">{pre.late.after} {pre.late.after === 1 ? "item stays" : "items stay"} late. They’re older than the rest, often left open when an earlier phase was signed off.</p>}
              {clash.length > 0 && <p className="text-[12.5px] text-destructive">{clash.map((x) => x.name).join(" and ")} would be signed off after launch. Move the launch date too, or move by less.</p>}
            </div>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <span className="mr-auto text-[12.5px] text-muted-foreground">You can undo it right after.</span>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={go} disabled={busy || !days}>{busy && <Loader2 className="animate-spin" />}Move by {days || 0} {days === 1 ? "day" : "days"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
