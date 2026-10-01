import * as React from "react"
import { Copy, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"

const REPO = "https://github.com/asheemstha/groundwork"
/** Open the feedback dialog from anywhere, optionally with text already in it (an error message). */
export const sendFeedback = (text = "") => window.dispatchEvent(new CustomEvent("gw:feedback", { detail: text }))

/**
 * Feedback without telemetry: Groundwork sends nothing on its own. The person writes what happened, sees the app
 * details before adding them, and opens it as a GitHub issue or copies it into an email.
 */
export function FeedbackDialog() {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [withDetails, setWithDetails] = React.useState(true)
  const [details, setDetails] = React.useState("")
  const [showDetails, setShowDetails] = React.useState(false)
  const [email, setEmail] = React.useState<string | null>(null)
  React.useEffect(() => {
    const on = (e: Event) => { setText(String((e as CustomEvent<string>).detail || "")); setShowDetails(false); setOpen(true); api.diagnostics().then((d) => { setDetails(d.text); setEmail(d.feedbackEmail) }).catch(() => setDetails("")) }
    window.addEventListener("gw:feedback", on)
    return () => window.removeEventListener("gw:feedback", on)
  }, [])
  const body = () => [text.trim(), withDetails && details ? `\n---\nApp details\n${details}` : ""].filter(Boolean).join("\n")
  const github = () => {
    const title = (text.trim().split("\n")[0] || "Feedback").slice(0, 80)
    // GitHub's new-issue link has a length limit, so long details are cut.
    let b = body(); if (b.length > 6000) b = b.slice(0, 6000) + "\n…"
    window.open(`${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(b)}`)
    setOpen(false)
  }
  const copy = () => { navigator.clipboard.writeText(body()); toast("Copied", { description: "Paste it into an email or a message to the person who gave you Groundwork." }); setOpen(false) }
  // Private by default: your own email app, addressed to the maker. Nothing is sent until you press Send there.
  const mail = () => {
    let b = body(); if (b.length > 1800) b = b.slice(0, 1800) + "\n…"
    window.open(`mailto:${email}?subject=${encodeURIComponent("Groundwork feedback: " + (text.trim().split("\n")[0] || "").slice(0, 60))}&body=${encodeURIComponent(b)}`)
    setOpen(false)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>What happened, what got in the way, or what you’d change. Groundwork doesn’t collect anything on its own, so this is how it gets better.</DialogDescription>
        </DialogHeader>
        <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="I tried to… and then…" />
        <div className="grid gap-1.5">
          <label className="flex items-center gap-2 text-[13px]"><Checkbox checked={withDetails} onCheckedChange={(v) => setWithDetails(!!v)} />Add app details<button onClick={() => setShowDetails(!showDetails)} className="text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground">{showDetails ? "Hide" : "See what’s added"}</button></label>
          {showDetails && <div className="max-h-48 overflow-auto rounded-lg bg-muted/60 px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{details || "Loading…"}</div>}
          <p className="text-[12px] text-muted-foreground">Versions, macOS, the scan browser, whether Claude Code or Codex is set up (not the account), how many projects, and recent error messages. Error messages can include a site’s address, so look before you send.</p>
        </div>
        <DialogFooter className="items-center">
          <button onClick={github} disabled={!text.trim()} className="mr-auto text-left text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50">Post it on GitHub instead (public)</button>
          {email ? <>
            <Button variant="outline" onClick={copy} disabled={!text.trim()}><Copy />Copy</Button>
            <Button onClick={mail} disabled={!text.trim()}><Mail />Email it privately</Button>
          </> : <Button onClick={copy} disabled={!text.trim()}><Copy />Copy to send privately</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
