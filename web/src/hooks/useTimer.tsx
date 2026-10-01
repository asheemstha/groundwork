/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { toast } from "sonner"
import { api, type Stopped, type TimerStart, type TimerState } from "@/lib/api"
import { fmtMins } from "@/lib/time"

interface TimerCtx {
  state: TimerState | null
  /** Ticks every 20 seconds so clocks move. */
  now: number
  refresh: () => Promise<void>
  start: (b: TimerStart) => Promise<void>
  stop: (at?: number) => Promise<void>
  set: (s: TimerState) => void
}
const Ctx = React.createContext<TimerCtx | null>(null)

/** Anything that changes time or tasks says so, and the pages showing them reload. */
export const timeChanged = () => window.dispatchEvent(new Event("gw:time"))
export function useTimeChanged(f: () => void) {
  const ref = React.useRef(f)
  React.useEffect(() => { ref.current = f })
  React.useEffect(() => { const on = () => ref.current(); window.addEventListener("gw:time", on); return () => window.removeEventListener("gw:time", on) }, [])
}

/** What a stopped timer logged, as a toast. */
export function toastStopped(s: Stopped) {
  if (!s) return
  if ("dropped" in s) return toast("Under a minute, so it wasn’t logged")
  toast(`Logged ${fmtMins(s.mins)}`, { description: [s.title, s.pname].filter(Boolean).join(" · ") })
}

/** The one running timer, shared by the sidebar, Today, the checklist and the Time page. */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<TimerState | null>(null)
  const [now, setNow] = React.useState(() => Date.now())
  const refresh = React.useCallback(async () => { const s = await api.timer().catch(() => null); if (s) setState(s) }, [])
  React.useEffect(() => {
    refresh()
    const tick = setInterval(() => setNow(Date.now()), 20e3)
    const poll = setInterval(refresh, 60e3)
    const focus = () => { setNow(Date.now()); refresh() }
    window.addEventListener("focus", focus)
    return () => { clearInterval(tick); clearInterval(poll); window.removeEventListener("focus", focus) }
  }, [refresh])
  useTimeChanged(refresh)
  const start = React.useCallback(async (b: TimerStart) => {
    try { const r = await api.startTimer(b); setState(r); setNow(Date.now()); toastStopped(r.stopped); timeChanged() } catch (e) { toast.error((e as Error).message) }
  }, [])
  const stop = React.useCallback(async (at?: number) => {
    try { const r = await api.stopTimer(at); setState(r); setNow(Date.now()); toastStopped(r.stopped); timeChanged() } catch (e) { toast.error((e as Error).message) }
  }, [])
  const value = React.useMemo(() => ({ state, now, refresh, start, stop, set: setState }), [state, now, refresh, start, stop])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTimer() {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useTimer outside TimerProvider")
  return c
}
