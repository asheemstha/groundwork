/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { toast } from "sonner"
import { api, type CState, type LogEntry, type Progress, type Result, type Run, type SeoResult, type SeoState } from "@/lib/api"
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
  /** The SEO plan, kept beside the heading plan in the same scan. */
  seoProgress: Progress | null
  seo: SeoResult | null
  seoState: SeoState
  setSeoState: React.Dispatch<React.SetStateAction<SeoState>>
  reloadSeo: () => Promise<void>
}
const Ctx = React.createContext<RunCtx | null>(null)
const EMPTY: CState = { done: {}, verify: {} }
const SEO_EMPTY: SeoState = { done: {}, edits: {}, verify: null }

// Loads one run and keeps it live over server-sent events. Shared by the thread and the to-do list.
export function RunProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const app = useApp()
  const [run, setRun] = React.useState<Run | null>(null)
  const [progress, setProgress] = React.useState<Progress | null>(null)
  const [log, setLog] = React.useState<LogEntry[]>([])
  const [result, setResult] = React.useState<Result | null>(null)
  const [cstate, setCState] = React.useState<CState>(EMPTY)
  const [notFound, setNotFound] = React.useState(false)
  const [seoProgress, setSeoProgress] = React.useState<Progress | null>(null)
  const [seo, setSeo] = React.useState<SeoResult | null>(null)
  const [seoState, setSeoState] = React.useState<SeoState>(SEO_EMPTY)
  const seoStatusRef = React.useRef<string | null>(null)
  const seoPlannedRef = React.useRef<number | undefined>(undefined)
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

  const reloadSeo = React.useCallback(async () => {
    const d = await api.seoResult(id).catch(() => null)
    if (d) { setSeo(d.result); setSeoState({ ...SEO_EMPTY, ...d.state }) }
  }, [id])

  React.useEffect(() => {
    let es: EventSource | null = null
    let alive = true
    setRun(null); setProgress(null); setLog([]); setResult(null); setCState(EMPTY); setNotFound(false); setSeo(null); setSeoState(SEO_EMPTY); setSeoProgress(null)
    api
      .run(id)
      .then((d) => {
        if (!alive) return
        setRun(d.run); setProgress(d.progress); setLog(d.log || [])
        statusRef.current = d.run.status
        plannedRef.current = d.progress?.planned
        if (d.run.settings) reloadResult()
        setSeoProgress(d.seoProgress || null)
        seoStatusRef.current = d.run.seo?.status || null
        seoPlannedRef.current = d.seoProgress?.planned
        if (d.run.seo) reloadSeo()
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
          const sp: Progress | null = m.seoProgress || null
          setSeoProgress(sp)
          const seoPrev = seoStatusRef.current, seoNow = r.seo?.status || null
          seoStatusRef.current = seoNow
          if (seoPrev !== seoNow && seoPrev === "running") {
            reloadSeo(); appRef.current.refreshRuns()
            if (seoNow === "done" || seoNow === "partial") {
              toast.success(`SEO plan ready for ${r.name}`, { description: "Titles, descriptions and slugs, page by page.", action: { label: "Open it", onClick: () => go(routes.seo(id)) } })
              if (document.hidden && "Notification" in window && Notification.permission === "granted") {
                const n = new Notification("SEO plan ready", { body: `${r.name}: titles, descriptions and slugs are ready.` })
                n.onclick = () => { window.focus(); go(routes.seo(id)) }
              }
            }
          } else if (seoNow === "running" && sp?.planned !== seoPlannedRef.current) reloadSeo()
          seoPlannedRef.current = sp?.planned
          if (seoNow === "running") appRef.current.patchRun(id, { seo: { status: "running", progress: null, percent: sp?.percent ?? null } })
          appRef.current.patchRun(id, { status: r.status, name: r.name, percent: p?.percent ?? null, progress: r.progress ?? null })
          const lw = p?.limits?.last
          if (lw) appRef.current.setLimits({ windows: lw, at: Date.now() })
          document.title = r.status === "running" ? `${p?.percent ?? 0}% · Planning ${r.name}` : r.status === "scanning" ? `Scanning ${r.name}…` : seoNow === "running" ? `${sp?.percent ?? 0}% · SEO for ${r.name}` : "Groundwork"
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
  }, [id, reloadResult, reloadSeo])

  const value = React.useMemo(() => ({ run, progress, log, result, cstate, notFound, reloadResult, setCState, seoProgress, seo, seoState, setSeoState, reloadSeo }), [run, progress, log, result, cstate, notFound, reloadResult, seoProgress, seo, seoState, reloadSeo])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRun() {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useRun outside RunProvider")
  return c
}
