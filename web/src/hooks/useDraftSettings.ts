import * as React from "react"
import { useApp } from "./useApp"
import type { EngineId, Settings } from "@/lib/api"
import { guessMarket } from "@/lib/countries"

/** Plan settings being edited in the composer. Starts from this site's last plan, then your last choices. */
export function useDraftSettings(base: Partial<Settings> | undefined, hostName: string) {
  const { status, prefs } = useApp()
  const init = (): Settings => {
    const p = { ...prefs, ...(base || {}) }
    const E = status?.engines
    const guess = guessMarket(hostName)
    return {
      output: p.output === "optimize" ? "both" : p.output || "live",
      market: base?.market || (guess !== "United States" ? guess : prefs.market) || "United States",
      liveDomain: base?.liveDomain || "",
      appliedBy: prefs.appliedBy || "",
      engine: (p.engine as EngineId) || (E?.claude.loggedIn ? "claude" : E?.codex.loggedIn ? "codex" : "claude"),
      model: p.model || "",
      effort: p.effort || "medium",
      notes: base?.notes || "",
    }
  }
  const [s, setS] = React.useState<Settings>(init)
  const [custom, setCustom] = React.useState("")
  // Fix up the model and effort once the engine catalog is known.
  React.useEffect(() => {
    if (!status) return
    const cat = status.catalog[s.engine]
    if (s.model !== "custom" && !cat.models.some((m) => m.id === s.model)) setS((x) => ({ ...x, model: cat.models.find((m) => m.rec)!.id }))
    if (!cat.efforts.includes(s.effort)) setS((x) => ({ ...x, effort: "medium" }))
  }, [status, s.engine, s.model, s.effort])

  const set = (patch: Partial<Settings>) => setS((x) => ({ ...x, ...patch }))
  return {
    s,
    custom,
    set,
    setEngine: (engine: EngineId) => {
      const cat = status?.catalog[engine]
      set({ engine, model: cat?.models.find((m) => m.rec)?.id || "default", effort: cat?.efforts.includes(s.effort) ? s.effort : "medium" })
    },
    setModel: (p: { model?: string; effort?: string; custom?: string }) => {
      if (p.custom !== undefined) setCustom(p.custom)
      set({ ...(p.model ? { model: p.model } : {}), ...(p.effort ? { effort: p.effort } : {}) })
    },
    /** The settings to send: a custom model name replaces "custom"; your name comes from Settings. */
    resolved: (): Settings => ({ ...s, appliedBy: prefs.appliedBy || s.appliedBy || "", model: s.model === "custom" ? custom || "default" : s.model }),
  }
}
