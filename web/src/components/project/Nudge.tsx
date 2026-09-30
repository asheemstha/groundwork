import * as React from "react"
import { Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/hooks/useApp"
import { api, type MessageTemplate, type PItem, type Project, type TemplateSummary } from "@/lib/api"
import { fmtDay, renderMessage } from "@/lib/project"

const DAY = 864e5
/** How long the client has had an item: "asked Sep 12, 17 days". */
export const waited = (x: PItem) => {
  if (!x.asked) return "not asked yet"
  const days = Math.max(0, Math.floor((Date.now() - x.asked) / DAY))
  return `asked ${fmtDay(new Date(x.asked).toISOString().slice(0, 10))}, ${days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`}`
}

/** A reminder about the items the client still owes, written from a message template. Groundwork doesn't send it. */
export function NudgeDialog({ p, items, open, onClose, onDone }: { p: Project; items: PItem[]; open: boolean; onClose: () => void; onDone: (x: Project) => void }) {
  const { prefs } = useApp()
  const [tpls, setTpls] = React.useState<TemplateSummary[]>([])
  const [tid, setTid] = React.useState("")
  const [tpl, setTpl] = React.useState<MessageTemplate | null>(null)
  const [pick, setPick] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    setPick(new Set(items.map((x) => x.id)))
    api.templates().then((l) => { const m = l.filter((t) => t.kind !== "checklist"); setTpls(m); setTid((cur) => cur && m.some((t) => t.id === cur) ? cur : (m.find((t) => t.id === "reminder") || m.find((t) => /remind|nudge/i.test(t.name)) || m[0])?.id || "") }).catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (tid) api.template(tid).then((t) => t.kind !== "checklist" && setTpl(t)).catch(() => {}) }, [tid])
  const chosen = items.filter((x) => pick.has(x.id))
  const msg = tpl ? renderMessage(tpl, p, prefs.appliedBy || "", chosen) : null
  const text = msg ? (tpl?.kind === "email" && msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body) : ""
  const mark = async () => {
    setBusy(true)
    try { onDone(await api.askItems(p.id, chosen.map((x) => x.id), true)); toast("Marked as nudged today"); onClose() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[600px]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Nudge {p.clientName || "the client"}</DialogTitle>
          <DialogDescription>A reminder about what’s still missing. Copy it into email or Slack; Groundwork doesn’t send anything.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5 text-[13.5px]">
          <div className="overflow-hidden rounded-lg border">
            {items.map((x) => (
              <label key={x.id} className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40">
                <input type="checkbox" checked={pick.has(x.id)} onChange={(e) => setPick((s) => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n })} className="size-[15px] accent-foreground" />
                <span className="truncate">{x.title}</span>
                <span className={x.late ? "text-[12.5px] text-destructive" : "text-[12.5px] text-muted-foreground"}>{waited(x)}</span>
              </label>
            ))}
          </div>
          <label className="grid gap-1.5 text-[12.5px] text-muted-foreground">Template
            <select value={tid} onChange={(e) => setTid(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-[13.5px] text-foreground">{tpls.map((t) => <option key={t.id} value={t.id}>{t.name}{t.kind === "email" ? " (email)" : ""}</option>)}</select>
          </label>
          <div className="max-h-64 overflow-auto rounded-lg bg-muted/50 px-4 py-3.5 leading-relaxed whitespace-pre-line">{text || "Pick a template."}</div>
        </div>
        <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <Button variant="ghost" className="mr-auto" onClick={mark} disabled={busy || !chosen.length}>{busy && <Loader2 className="animate-spin" />}Mark as nudged today</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => { navigator.clipboard.writeText(text); toast("Copied the message") }} disabled={!text || !chosen.length}><Copy />Copy message</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
