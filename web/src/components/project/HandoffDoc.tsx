import * as React from "react"
import { FileDown, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/hooks/useApp"
import { api, type Project } from "@/lib/api"
import { go, routes } from "@/lib/router"

/**
 * The handoff document, for the client and whoever runs the site or its marketing next: who owns which account,
 * what's installed, the launch check, redirects and renewals. Saved as a PDF or an HTML file.
 */
export function HandoffDialog({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = useApp()
  const [agency, setAgency] = React.useState(prefs.agency || "")
  const [note, setNote] = React.useState("")
  const [shownNote, setShownNote] = React.useState("")
  React.useEffect(() => { const t = setTimeout(() => setShownNote(note), 500); return () => clearTimeout(t) }, [note])
  React.useEffect(() => { if (open) setAgency(prefs.agency || "") }, [open, prefs.agency])
  const url = (extra: Record<string, string> = {}) => `/api/projects/${p.id}/handoff?${new URLSearchParams({ note: shownNote, agency, ...extra })}`
  const saveAgency = () => { if ((prefs.agency || "") !== agency.trim()) { api.savePrefs({ agency: agency.trim() }).catch(() => {}); setPrefs({ agency: agency.trim() }) } }
  const save = (format: "pdf" | "html") => {
    saveAgency()
    const a = document.createElement("a"); a.href = url(format === "pdf" ? { format: "pdf" } : { download: "1" }); a.download = ""; a.click()
    toast(format === "pdf" ? "Saving the PDF" : "Saving the page", { description: "Send it to the client, and to whoever runs their marketing." })
  }
  const filled = p.accounts.filter((a) => a.owner && a.owner !== "none").length
  const checked = p.tools.launchHistory.some((h) => h.status === "done" && !h.oldSite)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[1040px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Handoff document</DialogTitle>
          <DialogDescription>Everything about {p.name}’s site in one place, for the client and whoever runs it or its marketing next. Save it as a PDF or an HTML file and send it.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid content-start gap-4 border-b p-5 md:border-r md:border-b-0">
            <label className="grid gap-1.5 text-[13px] font-medium">Studio or agency name<Input value={agency} onChange={(e) => setAgency(e.target.value)} onBlur={saveAgency} placeholder="Your studio" className="font-normal" /></label>
            <label className="grid gap-1.5 text-[13px] font-medium">A note at the top <span className="-mt-1 font-normal text-muted-foreground">(optional)</span><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="What happens next, who to call" className="font-normal" /></label>
            <div className="grid gap-1.5 text-[13px]">
              <span className="font-medium">What goes in</span>
              <span className="text-muted-foreground">Accounts: {filled ? `${filled} with an owner` : "none filled in yet"}. <button onClick={() => { onClose(); go(routes.project(p.id, "client")) }} className="underline underline-offset-2 hover:text-foreground">Fill them in</button></span>
              <span className="text-muted-foreground">What’s installed and the launch check: {checked ? "from the latest check" : "run the launch check first"}.</span>
              <span className="text-muted-foreground">Redirects: {p.tools.redirects ? `${p.tools.redirects.total} old addresses mapped` : "none for this project"}.</span>
              <span className="text-muted-foreground">Renewals: {p.renewals ? "SSL and domain dates" : p.sites.live ? "checked once a day" : "add the live domain"}.</span>
            </div>
            <div className="grid gap-2">
              <Button onClick={() => save("pdf")}><FileDown />Save as PDF</Button>
              <Button variant="outline" onClick={() => save("html")}><FileText />Save as a web page</Button>
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">Logins go in, passwords never do. Your notes, payments and time stay in Groundwork.</p>
          </div>
          <div className="bg-muted/40 p-4">
            <iframe key={url()} src={url()} title="Preview" sandbox="" className="h-[62vh] w-full rounded-lg border bg-white" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
