import * as React from "react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useApp } from "@/hooks/useApp"
import type { EngineId, Estimate } from "@/lib/api"
import { cap, clock, fmtRange, pct, plural } from "@/lib/format"
import { store } from "@/lib/store"

/** Asks once per engine before the first plan, so nobody is surprised by the usage. */
export function useUsageConfirm() {
  const { status } = useApp()
  const [pending, setPending] = React.useState<null | { engine: EngineId; estimate: Estimate | null; pages: number; resolve: (ok: boolean) => void }>(null)
  const [dontAsk, setDontAsk] = React.useState(false)
  const ask = (engine: EngineId, estimate: Estimate | null, pages: number) =>
    new Promise<boolean>((resolve) => {
      const e = status?.engines[engine]
      if (store.get(`ack.${engine}`, false) && e?.billing !== "api") return resolve(true)
      setDontAsk(false)
      setPending({ engine, estimate, pages, resolve })
    })
  const close = (ok: boolean) => {
    if (ok && dontAsk && pending) store.set(`ack.${pending.engine}`, true)
    pending?.resolve(ok)
    setPending(null)
  }
  const dialog = pending && status && (() => {
    const cat = status.catalog[pending.engine], e = status.engines[pending.engine], w = status.limits?.windows?.five_hour
    const api = e.billing === "api"
    return (
      <AlertDialog open onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{api ? `Run this on your ${cat.name} API key?` : `Run this on your ${cat.name} plan?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {api
                ? `${cat.name} is signed in with an API key, so this run is billed per token to that API account.`
                : `Groundwork runs ${cat.name} on this computer as ${e.account || "you"}${e.plan ? ` (${cap(e.plan)} plan)` : ""}. The plan counts toward that account’s usage limits.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-muted p-2.5"><div className="text-xs text-muted-foreground">Pages</div><div className="font-medium">{pending.pages}</div></div>
            <div className="rounded-lg bg-muted p-2.5"><div className="text-xs text-muted-foreground">Time</div><div className="font-medium">{pending.estimate ? fmtRange(pending.estimate.total) : "–"}</div></div>
            <div className="rounded-lg bg-muted p-2.5"><div className="text-xs text-muted-foreground">Usage</div><div className="font-medium">{pending.estimate?.usage || "–"}</div></div>
          </div>
          {pending.engine === "claude" && !api && w && (
            <p className="text-xs text-muted-foreground">Your 5-hour window is {pct(w.utilization)}% used{w.resetsAt ? ` and resets at ${clock(w.resetsAt * 1000)}` : ""}.{pending.estimate?.limitPct != null ? ` Similar runs used about ${Math.max(1, Math.round(pending.estimate.limitPct * 100))}%.` : ""}</p>
          )}
          {!api && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={dontAsk} onCheckedChange={(v) => setDontAsk(!!v)} /> Don’t ask again for {cat.name}
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => close(true)}>Start plan · {plural(pending.pages, "page")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  })()
  return { ask, dialog }
}
