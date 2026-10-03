import * as React from "react"
import { BookOpen, HelpCircle, Keyboard, MessageSquare, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { sendFeedback } from "@/components/common/Feedback"

const REPO = "https://github.com/asheemstha/groundwork"
const MAC = /Mac/.test(navigator.platform)
const k = (x: string) => (MAC ? `⌘${x}` : `Ctrl+${x}`)
const KEYS: [string, string][] = [[k("K"), "Search projects, pages and actions"], [k("N"), "New project"], [k("B"), "Show or hide the sidebar"], [k("["), "Back"], [k("]"), "Forward"], [k(","), "Settings"], ["Esc", "Close a panel or dialog"]]

/** Help in the corner of every page, like Notion's: feedback, the guide for testers, what's new and the shortcuts. */
export function HelpButton() {
  const [keys, setKeys] = React.useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button aria-label="Help" className="absolute right-3 bottom-3 z-20 grid size-8 place-items-center rounded-full border bg-card text-muted-foreground shadow-[0_1px_3px_rgba(22,23,22,0.08)] hover:text-foreground" />}><HelpCircle className="size-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-60">
          <DropdownMenuItem onClick={() => sendFeedback()}><MessageSquare /> Send feedback</DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open(`${REPO}/blob/main/TESTING.md`)}><BookOpen /> Guide for testers</DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open(`${REPO}/releases`)}><Sparkles /> What’s new</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setKeys(true)}><Keyboard /> Keyboard shortcuts</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={keys} onOpenChange={setKeys}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle><DialogDescription>They work anywhere in Groundwork.</DialogDescription></DialogHeader>
          <div className="grid">
            {KEYS.map(([key, what]) => (
              <div key={key} className="grid h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b text-[13.5px] last:border-b-0">
                <span>{what}</span><kbd className="rounded-md border bg-muted px-1.5 font-sans text-[12px] text-muted-foreground">{key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
