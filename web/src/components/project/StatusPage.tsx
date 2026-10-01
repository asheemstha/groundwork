import * as React from "react"
import { FileDown, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/hooks/useApp"
import { api, type Project } from "@/lib/api"

/**
 * A read-only page for the client, made from the project: where it stands, what the client owes, what's done and
 * what's next. Saved as a PDF or an HTML file to send; Groundwork doesn't host it anywhere.
 */
export function StatusPageDialog({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = useApp()
  const [agency, setAgency] = React.useState(prefs.agency || "")
  const [note, setNote] = React.useState("")
  const [show, setShow] = React.useState({ waiting: true, done: true, next: true })
  const [days, setDays] = React.useState<7 | 14>(14)
  const [shownNote, setShownNote] = React.useState("") // the note in the preview, updated after typing stops
  React.useEffect(() => { const t = setTimeout(() => setShownNote(note), 500); return () => clearTimeout(t) }, [note])
  React.useEffect(() => { if (open) setAgency(prefs.agency || "") }, [open, prefs.agency])
  const query = (extra: Record<string, string> = {}) => new URLSearchParams({ waiting: show.waiting ? "1" : "0", done: show.done ? "1" : "0", next: show.next ? "1" : "0", days: String(days), note: shownNote, agency, ...extra }).toString()
  const url = (extra?: Record<string, string>) => `/api/projects/${p.id}/status-page?${query(extra)}`
  const saveAgency = () => { if ((prefs.agency || "") !== agency.trim()) { api.savePrefs({ agency: agency.trim() }).catch(() => {}); setPrefs({ agency: agency.trim() }) } }
  const save = (format: "pdf" | "html") => {
    saveAgency()
    const a = document.createElement("a"); a.href = url(format === "pdf" ? { format: "pdf" } : { download: "1" }); a.download = ""; a.click()
    toast(format === "pdf" ? "Saving the PDF" : "Saving the page", { description: "Attach it to an email, or put it wherever the client looks." })
  }
  const toggle = (k: keyof typeof show) => (v: boolean) => setShow((s) => ({ ...s, [k]: v }))
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[1040px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Client status page</DialogTitle>
          <DialogDescription>A page for {p.clientName ? p.clientName.split(" ")[0] : "the client"} that shows where {p.name} stands. Save it as a PDF or an HTML file and send it. Groundwork doesn’t put it online.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid content-start gap-4 border-b p-5 md:border-r md:border-b-0">
            <label className="grid gap-1.5 text-[13px] font-medium">Studio or agency name<Input value={agency} onChange={(e) => setAgency(e.target.value)} onBlur={saveAgency} placeholder="Your studio" className="font-normal" /></label>
            <label className="grid gap-1.5 text-[13px] font-medium">A note at the top <span className="-mt-1 font-normal text-muted-foreground">(optional)</span><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Anything to add this week" className="font-normal" /></label>
            <div className="grid gap-2 text-[13px]">
              <span className="font-medium">Show</span>
              <label className="flex items-center gap-2"><Checkbox checked disabled />Where things stand, phase by phase</label>
              <label className="flex items-center gap-2"><Checkbox checked={show.waiting} onCheckedChange={(v) => toggle("waiting")(!!v)} />What we need from you</label>
              <label className="flex items-center gap-2"><Checkbox checked={show.done} onCheckedChange={(v) => toggle("done")(!!v)} />Done in the last
                <select value={days} onChange={(e) => setDays(+e.target.value as 7 | 14)} disabled={!show.done} className="h-7 rounded-md border border-input bg-card px-1.5 text-[13px]"><option value={7}>week</option><option value={14}>two weeks</option></select>
              </label>
              <label className="flex items-center gap-2"><Checkbox checked={show.next} onCheckedChange={(v) => toggle("next")(!!v)} />Up next</label>
            </div>
            <div className="grid gap-2">
              <Button onClick={() => save("pdf")}><FileDown />Save as PDF</Button>
              <Button variant="outline" onClick={() => save("html")}><FileText />Save as a web page</Button>
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">Only what the preview shows goes in. Your notes on items, links, payments, scans and checks stay in Groundwork.</p>
          </div>
          <div className="bg-muted/40 p-4">
            <iframe key={url()} src={url()} title="Preview" sandbox="" className="h-[62vh] w-full rounded-lg border bg-white" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
