import * as React from "react"
import { FileDown, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/hooks/useApp"
import { api, type Project } from "@/lib/api"

const monthOf = (d?: string | null) => (d ? new Date(d + "T00:00").toLocaleDateString([], { month: "long", year: "numeric" }) : "")

/**
 * A care plan's monthly report for the client: the work done, the month's health check, whether the site answered,
 * search traffic, the hours against the plan and renewals. This month or an earlier one, as a PDF or a web page.
 */
export function CareReportDialog({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = useApp()
  const [agency, setAgency] = React.useState(prefs.agency || "")
  const [note, setNote] = React.useState("")
  const [cycle, setCycle] = React.useState("")
  const [shownNote, setShownNote] = React.useState("")
  React.useEffect(() => { const t = setTimeout(() => setShownNote(note), 500); return () => clearTimeout(t) }, [note])
  React.useEffect(() => { if (open) setAgency(prefs.agency || "") }, [open, prefs.agency])
  const url = (extra: Record<string, string> = {}) => `/api/projects/${p.id}/care-report?${new URLSearchParams({ note: shownNote, agency, cycle, ...extra })}`
  const saveAgency = () => { if ((prefs.agency || "") !== agency.trim()) { api.savePrefs({ agency: agency.trim() }).catch(() => {}); setPrefs({ agency: agency.trim() }) } }
  const save = (format: "pdf" | "html") => {
    saveAgency()
    const a = document.createElement("a"); a.href = url(format === "pdf" ? { format: "pdf" } : { download: "1" }); a.download = ""; a.click()
    toast(format === "pdf" ? "Saving the PDF" : "Saving the page", { description: "Send it with the month’s invoice, so the client sees the work." })
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[1040px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Care report</DialogTitle>
          <DialogDescription>What you did for {p.name} this month and how the site is, for {p.clientName ? p.clientName.split(" ")[0] : "the client"}. Clients keep paying for care when they can see the work.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid content-start gap-4 border-b p-5 md:border-r md:border-b-0">
            <label className="grid gap-1.5 text-[13px] font-medium">Month
              <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-normal">
                <option value="">{monthOf(p.kickoff) || "This month"} (this month)</option>
                {p.cycles.map((c, i) => <option key={c.at} value={String(i)}>{monthOf(c.kickoff) || `Month ${p.cycles.length - i}`}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium">Studio or agency name<Input value={agency} onChange={(e) => setAgency(e.target.value)} onBlur={saveAgency} placeholder="Your studio" className="font-normal" /></label>
            <label className="grid gap-1.5 text-[13px] font-medium">A note at the top <span className="-mt-1 font-normal text-muted-foreground">(optional)</span><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Anything to decide, or what’s coming next month" className="font-normal" /></label>
            <div className="grid gap-2">
              <Button onClick={() => save("pdf")}><FileDown />Save as PDF</Button>
              <Button variant="outline" onClick={() => save("html")}><FileText />Save as a web page</Button>
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">The health check runs once a month on its own while Groundwork is open. Import a Search Console export on the Site tab, or sign in to Google in Settings, to add search traffic.</p>
          </div>
          <div className="bg-muted/40 p-4">
            <iframe key={url()} src={url()} title="Preview" sandbox="" className="h-[62vh] w-full rounded-lg border bg-white" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
