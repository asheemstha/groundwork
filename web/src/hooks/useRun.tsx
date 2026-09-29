/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { toast } from "sonner"
import { api, type CState, type LogEntry, type Progress, type Result, type Run } from "@/lib/api"
import { useApp } from "./useApp"
import { go, routes } from "@/lib/router"

interface RunCtx {
  run: Run | null
  progress: Progress | null
  log: LogEntry[]
  result: Result | null
  cstate: CState
  notFound: boolean
  reloadResult: () => Promise<void>
  setCState: React.Dispatch<React.SetStateAction<CState>>
}
const Ctx = React.createContext<RunCtx | null>(null)
const EMPTY: CState = { done: {}, verify: {} }

// Loads one run and keeps it live over server-sent events. Shared by the thread and the to-do list.
export function RunProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const app = useApp()
  const [run, setRun] = React.useState<Run | null>(null)
  const [progress, setProgress] = React.useState<Progress | null>(null)
  const [log, setLog] = React.useState<LogEntry[]>([])
  const [result, setResult] = React.useState<Result | null>(null)
  const [cstate, setCState] = React.useState<CState>(EMPTY)
  const [notFound, setNotFound] = React.useState(false)
  const statusRef = React.useRef<string | null>(null)
  const plannedRef = React.useRef<number | undefined>(undefined)
  const appRef = React.useRef(app)
  appRef.current = app

  const reloadResult = React.useCallback(async () => {
    const d = await api.result(id).catch(() => null)
    if (d) {
      setResult(d.result)
      setCState(d.state || EMPTY)
    }
  }, [id])

  React.useEffect(() => {
    let es: EventSource | null = null
    let alive = true
    setRun(null); setProgress(null); setLog([]); setResult(null); setCState(EMPTY); setNotFound(false)
    api
      .run(id)
      .then((d) => {
        if (!alive) return
        setRun(d.run); setProgress(d.progress); setLog(d.log || [])
        statusRef.current = d.run.status
        plannedRef.current = d.progress?.planned
        if (d.run.settings) reloadResult()
        es = new EventSource(`/api/runs/${id}/events`)
        es.onmessage = (ev) => {
          const m = JSON.parse(ev.data)
          if (m.type === "log") {
            setLog((l) => [...l.slice(-400), m.entry])
            return
          }
          if (m.type !== "snapshot") return
          const r: Run = m.run, p: Progress | null = m.progress
          setRun(r); setProgress(p)
          appRef.current.patchRun(id, { status: r.status, name: r.name, percent: p?.percent ?? null, progress: r.progress ?? null })
          const lw = p?.limits?.last
          if (lw) appRef.current.setLimits({ windows: lw, at: Date.now() })
          document.title = r.status === "running" ? `${p?.percent ?? 0}% · Planning ${r.name}` : r.status === "scanning" ? `Scanning ${r.name}…` : "Groundwork"
          const prev = statusRef.current
          statusRef.current = r.status
          if (prev !== r.status) {
            if (r.status === "done" || r.status === "partial") {
              reloadResult()
              appRef.current.refreshRuns()
              document.title = "Groundwork"
              toast.success(`Plan ready for ${r.name}`, { description: "Work through the to-do list page by page.", action: { label: "Open to-do list", onClick: () => go(routes.review(id)) } })
              if (document.hidden && "Notification" in window && Notification.permission === "granted") {
                const n = new Notification("Plan ready", { body: `${r.name}: the to-do list is ready.` })
                n.onclick = () => { window.focus(); go(routes.review(id)) }
              }
            } else if (r.status === "scanned" || r.status === "failed" || r.status === "cancelled") {
              reloadResult()
              appRef.current.refreshRuns()
            }
          } else if (r.status === "running" && p?.planned !== plannedRef.current) {
            reloadResult()
          }
          plannedRef.current = p?.planned
        }
      })
      .catch(() => alive && setNotFound(true))
    return () => {
      alive = false
      es?.close()
      document.title = "Groundwork"
    }
  }, [id, reloadResult])

  const value = React.useMemo(() => ({ run, progress, log, result, cstate, notFound, reloadResult, setCState }), [run, progress, log, result, cstate, notFound, reloadResult])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRun() {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useRun outside RunProvider")
  return c
}
