import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "cn"

/** True when an error or note is about Cloudflare's bot protection turning Groundwork away. */
export const isCloudflare = (text?: string | null) => /cloudflare/i.test(text || "")

/**
 * How a site owner lets Groundwork's scans and checks through Cloudflare. Groundwork doesn't try to get past bot
 * protection on its own; it names itself ("Groundwork/<version>" in its user agent) so a rule can allow it.
 */
export function CloudflareHelp({ open: startOpen = false, className }: { open?: boolean; className?: string }) {
  const [open, setOpen] = React.useState(startOpen)
  return (
    <div className={cn("text-[13px]", className)}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 font-medium" aria-expanded={open}>
        <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />How to let Groundwork through
      </button>
      {open && (
        <div className="mt-2 grid gap-2 pl-5 leading-relaxed text-muted-foreground">
          <ol className="grid list-decimal gap-1 pl-4">
            <li>In the site’s Cloudflare dashboard, open Security, then WAF, then Custom rules, and create a rule.</li>
            <li>Match your office’s IP address (IP Source Address equals your IP). Matching the user agent “Groundwork” also works, but anyone can copy a user agent, so the IP is safer.</li>
            <li>Set the action to Skip, and choose the bot checks and managed rules.</li>
            <li>If the challenge comes from the free plan’s Bot Fight Mode (Security, then Bots), a rule may not skip it. Switch it off while you scan, then back on.</li>
          </ol>
          <p>Or scan the staging address, which usually isn’t behind Cloudflare.</p>
        </div>
      )}
    </div>
  )
}
