import * as React from "react"
import { cn } from "cn"
import { CircleCheck, Info, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateField } from "@/components/common/DateField"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, type LiveLook, type Project } from "@/lib/api"
import { addDaysTo, fmtDay, hostOfUrl, today } from "@/lib/project"
import { go, routes } from "@/lib/router"

const long = (d: string) => new Date(d + "T00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })

/**
 * Mark launched: you say when the new site went live and where, Groundwork looks at the live domain to confirm it, and
 * says what happens next. The planned date alone never marks a project launched.
 */
export function MarkLaunchedDialog({ p, open, onClose, onDone }: { p: Project; open: boolean; onClose: () => void; onDone: (x: Project) => void }) {
  // In a same-domain redesign the live domain is the old site's address.
  const guess = p.sites.live || p.sites.old || ""
  const [on, setOn] = React.useState<string>(p.launch && p.launch <= today() ? p.launch : today())
  const [live, setLive] = React.useState(hostOfUrl(guess))
  const [look, setLook] = React.useState<LiveLook | null>(null)
  const [looking, setLooking] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { if (open) { setOn(p.launch && p.launch <= today() ? p.launch : today()); setLive(hostOfUrl(guess)); setLook(null) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  // A look at the domain once it's typed, a moment after the typing stops.
  React.useEffect(() => {
    if (!open || !live.trim()) { setLook(null); return }
    const t = setTimeout(async () => { setLooking(true); try { setLook(await api.lookLive(p.id, live)) } catch (e) { setLook({ ok: false, host: live, text: (e as Error).message }) } finally { setLooking(false) } }, 600)
    return () => clearTimeout(t)
  }, [open, live, p.id])
  const mark = async () => {
    setBusy(true)
    try {
      const r = await api.markLaunched(p.id, { on, live: live.trim() || undefined })
      onDone(r); onClose()
      toast.success(`${p.name} is marked launched`, { description: r.checkId ? `Checking ${hostOfUrl(r.sites.live)} now${r.tested ? ", with the redirect test" : ""}.` : undefined })
      if (r.checkId) go(routes.launch(p.id, r.checkId))
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const pay = p.phases.find((ph) => /launch/i.test(ph.name) && ph.payment)?.payment
  const days = [3, 7, 30].map((n) => addDaysTo(on, n)).filter((d) => d >= today())
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Mark {p.name} as launched</DialogTitle>
          <DialogDescription>{p.launch && !p.launched ? `The plan said ${long(p.launch)}. ` : ""}Tell Groundwork when the new site actually went live.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3">
            <label className="grid gap-1.5 text-[13px] font-medium">Went live on<DateField value={on} onChange={(v) => v && setOn(v)} boxed /></label>
            <label className="grid gap-1.5 text-[13px] font-medium">Live domain<Input value={live} onChange={(e) => setLive(e.target.value)} placeholder="example.com" spellCheck={false} className="font-normal" /></label>
          </div>
          {(looking || look) && (
            <div className={cn("grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 rounded-lg bg-muted/60 px-3.5 py-3 text-[13.5px] leading-relaxed", look && !look.ok && "text-destructive")}>
              {looking ? <Loader2 className="mt-0.5 size-4 animate-spin text-muted-foreground" /> : look?.sure ? <CircleCheck className="mt-0.5 size-4" /> : <Info className="mt-0.5 size-4 text-muted-foreground" />}
              <span>{looking ? `Looking at ${live}…` : look!.text}</span>
            </div>
          )}
          <div className="grid gap-2 text-[13.5px]">
            <span className="text-[13px] font-medium">What happens next</span>
            <Next when="Now">The launch check{p.tools.redirects ? " and the redirect test" : ""} of the live domain</Next>
            {days.length > 0 && <Next when={days.map((d) => fmtDay(d)).join(", ").replace(/, ([^,]*)$/, " and $1")}>The launch check again, while Groundwork is open</Next>}
            {pay && <Next when="Money">{pay.label || "The launch payment"}{pay.amount ? `, ${pay.amount},` : ""} is ready to invoice once the Launch phase is signed off</Next>}
            <Next when="After day 30">{p.repeat ? "Monthly care carries on" : "Close the project, or carry on as a care plan"}</Next>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Not yet</Button>
          <Button onClick={mark} disabled={busy || !on}>{busy && <Loader2 className="animate-spin" />}Mark launched</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const Next = ({ when, children }: { when: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2"><span className="text-muted-foreground">{when}</span><span>{children}</span></div>
)
