/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { toast } from "sonner"
import { api, type AppStatus, type Limits, type ProjectSummary, type RunSummary, type Settings, type UpdateInfo } from "@/lib/api"
import { store } from "@/lib/store"

interface AppCtx {
  status: AppStatus | null
  runs: RunSummary[]
  projects: ProjectSummary[]
  refreshProjects: () => Promise<void>
  prefs: Partial<Settings>
  sidebar: boolean
  setSidebar: (v: boolean) => void
  refreshStatus: (fresh?: boolean) => Promise<void>
  refreshRuns: () => Promise<void>
  setLimits: (l: Limits) => void
  patchRun: (id: string, patch: Partial<RunSummary>) => void
  setPrefs: (p: Partial<Settings>) => void
  /** The name to show for a site: the user's name for it, or its address. */
  siteLabel: (host: string) => string
  update: UpdateInfo | null
  checkUpdate: () => Promise<UpdateInfo | null>
  installUpdate: () => Promise<void>
  updating: boolean
}

const Ctx = React.createContext<AppCtx | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AppStatus | null>(null)
  const [runs, setRuns] = React.useState<RunSummary[]>([])
  const [projects, setProjects] = React.useState<ProjectSummary[]>([])
  const [prefs, setPrefsState] = React.useState<Partial<Settings>>({})
  const [sidebar, setSidebarState] = React.useState(() => store.get("sidebar", true))
  const [update, setUpdate] = React.useState<UpdateInfo | null>(null)
  const [updating, setUpdating] = React.useState(false)
  const checkUpdate = React.useCallback(async () => { const u = await api.version(true).catch(() => null); if (u) setUpdate(u); return u }, [])
  React.useEffect(() => {
    api.version().then(setUpdate).catch(() => {})
    const t = setInterval(() => api.version().then(setUpdate).catch(() => {}), 30 * 60e3)
    return () => clearInterval(t)
  }, [])
  const installUpdate = React.useCallback(async () => {
    setUpdating(true)
    try {
      const before = update?.commit
      const r = await api.update()
      if (r.restart === "manual") { toast.success("Update downloaded", { description: "Close the Groundwork window and open it again to finish." }); setUpdating(false); return }
      // The launcher pulls the update and restarts the server; reload once the new one answers.
      const t0 = Date.now()
      const poll = async () => {
        const u = await api.version().catch(() => null)
        if (u && u.commit && u.commit !== before) return location.reload()
        if (Date.now() - t0 > 120e3) { setUpdating(false); toast.error("The update is taking longer than expected. Check the Groundwork window."); return }
        setTimeout(poll, 1500)
      }
      setTimeout(poll, 2500)
    } catch (e) { toast.error((e as Error).message); setUpdating(false) }
  }, [update])

  const refreshStatus = React.useCallback(async (fresh = false) => {
    setStatus(await api.status(fresh))
  }, [])
  const refreshProjects = React.useCallback(async () => {
    setProjects(await api.projects())
  }, [])
  // Runs feed the projects' tool items (scans and plans), so refreshing runs refreshes projects too.
  const refreshRuns = React.useCallback(async () => {
    setRuns(await api.runs())
    api.projects().then(setProjects).catch(() => {})
  }, [])

  React.useEffect(() => {
    refreshStatus().catch(() => {})
    refreshRuns().catch(() => {})
    api.prefs().then(setPrefsState).catch(() => {})
  }, [refreshStatus, refreshRuns])

  // Keep the sidebar fresh: fast while something is scanning or planning, slow otherwise.
  const active = runs.some((r) => r.status === "running" || r.status === "scanning")
  React.useEffect(() => {
    const t = setInterval(() => refreshRuns().catch(() => {}), active ? 3000 : 20000)
    return () => clearInterval(t)
  }, [active, refreshRuns])

  const value = React.useMemo<AppCtx>(
    () => ({
      status,
      runs,
      projects,
      refreshProjects,
      prefs,
      sidebar,
      setSidebar: (v) => {
        setSidebarState(v)
        store.set("sidebar", v)
      },
      refreshStatus,
      refreshRuns,
      setLimits: (l) => setStatus((s) => (s ? { ...s, limits: l } : s)),
      patchRun: (id, patch) => setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))),
      setPrefs: (p) => setPrefsState((x) => ({ ...x, ...p })),
      siteLabel: (host) => runs.find((r) => r.host === host && r.siteName)?.siteName || host,
      update, checkUpdate, installUpdate, updating,
    }),
    [status, runs, projects, refreshProjects, prefs, sidebar, refreshStatus, refreshRuns, update, checkUpdate, installUpdate, updating]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useApp outside AppProvider")
  return c
}
