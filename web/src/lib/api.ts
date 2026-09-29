// Types and calls for the local Groundwork server (server.js).

export type EngineId = "claude" | "codex"
export type Output = "live" | "optimize" | "both"
export type Mode = "live" | "optimize"
export type RunStatus = "scanning" | "scan_failed" | "scanned" | "running" | "done" | "partial" | "failed" | "cancelled"

export interface EngineStatus {
  installed: boolean
  loggedIn: boolean
  version?: string
  account?: string | null
  plan?: string | null
  billing?: "subscription" | "api"
}
export interface ModelInfo { id: string; name: string; desc: string; usage: number; speed: number; rec?: boolean }
export interface EngineCatalog {
  name: string
  vendor: string
  plans: string
  plansUrl: string
  docsUrl: string
  install: { label: string; cmd: string }[]
  login: string
  models: ModelInfo[]
  efforts: string[]
}
export interface EffortInfo { name: string; desc: string; usage: number; speed: number }
export interface LimitWindow { utilization: number; resetsAt?: number }
export interface Limits { windows: Record<string, LimitWindow>; status?: string; at: number }
export interface AppStatus {
  app: string
  engines: Record<EngineId, EngineStatus>
  browser: { ok: boolean; name?: string; error?: string }
  catalog: Record<EngineId, EngineCatalog>
  effort: Record<string, EffortInfo>
  limits: Limits | null
}
export interface Settings {
  output: Output
  market: string
  liveDomain: string
  appliedBy: string
  engine: EngineId
  model: string
  effort: string
  notes?: string
}
export interface Counts { tasks: number; done: number }
/** `all` is the merged to-do list; `live`/`optimize` come from runs made before it existed. */
export type RunProgress = { all?: Counts; now?: Counts; live?: Counts; optimize?: Counts }
export interface RunSummary {
  id: string
  name: string
  url: string
  host: string
  /** optional name the user gave the site; shared by every version */
  siteName?: string | null
  hasIcon?: boolean
  status: RunStatus
  created: number
  updated?: number
  pages: number
  progress: RunProgress | null
  percent: number | null
  settings: Settings | null
}
export interface ScanPage {
  id: string
  path: string
  name: string
  navGroup: string | null
  sources: string[]
  collection: string | null
  legal: boolean
  selected: boolean
  status: number | null
  error?: string | null
  counts?: Record<string, number> | null
  title?: string
  height?: number
  headings?: number
  styled?: number
}
export interface Estimate {
  kw: number
  perPage: number
  build: number
  total: number
  usage: "Light" | "Moderate" | "Heavy" | "Very heavy"
  usageScore: number
  calibrated: number
  limitPct: number | null
}
export interface Tokens { input: number; output: number; cached: number }
export interface JobLimits { first?: Record<string, LimitWindow>; last?: Record<string, LimitWindow>; status?: string; resetsAt?: number }
export interface Job {
  started: number
  ended?: number
  stage: string
  estimate: Estimate
  tokens: Tokens | null
  kwAt?: number
  aiStarted?: number
  limits?: JobLimits
  limitDelta?: number
  fixStarted?: number
}
export interface Run {
  id: string
  tool: string
  url: string
  origin?: string
  name: string
  platform?: string
  created: number
  updated?: number
  status: RunStatus
  scan?: { started: number; step: string; done: number; total: number; ended?: number; error?: string; pagesStarted?: number }
  pages: ScanPage[]
  selected: string[]
  navText?: string
  dead?: string[]
  crawledAt?: number
  shotsAt?: number
  settings?: Settings
  job?: Job
  error?: string
  summary?: string
  warnings?: string[]
  progress?: RunProgress
}
export interface Stage { key: string; label: string; state: "done" | "active" | "todo"; done?: number; total?: number; at?: number | null }
export interface Progress {
  percent: number
  etaSec: number | null
  elapsedSec: number
  stage?: string
  kwDone?: boolean
  planned?: number
  total?: number
  current?: { id: string; name: string } | null
  plannedIds?: string[]
  stages?: Stage[]
  tokens?: Tokens | null
  limits?: JobLimits | null
}
export interface LogEntry { t: number; kind: "tool" | "ai" | "step" | "error" | "stderr"; text: string }
export type Rect = [number, number, number, number]
export interface Row {
  key: string
  s?: string
  ref?: string
  cur?: string
  text?: string
  rec?: string
  act?: "keep" | "retag" | "tag" | "none" | "rewrite" | "add" | "remove"
  note?: string
  to?: string
  rect?: Rect | null
  hidden?: boolean
  zone?: string | null
  auto?: boolean
  /** set on merged to-do lists */
  mode?: Mode
  phase?: 1 | 2
  from?: string
}
export interface H1Info { cur: string; status: "keep" | "client" | "optional"; proposed: string; why: string }
export interface ModeData { h1: H1Info; rows: Row[]; notes: string[] }
export interface Keywords { primary: [string, number | null]; secondary: [string, number | null][]; note: string }
export interface ResultPage {
  id: string
  name: string
  path: string
  status: number
  title: string
  desc: string
  counts: Record<string, number>
  purpose: string
  intent: string
  keywords: Keywords | null
  planned: boolean
  modes: Partial<Record<Mode, ModeData>>
  group: string | null
}
export type NavItem = { id: string } | { group: string; items: string[] }
export interface Result {
  site: { name: string; url: string; liveDomain: string; platform: string; market: string; appliedBy: string; checked: string; kwSource: string; sharedHeadings: string[]; modes: Mode[] }
  nav: NavItem[]
  pages: ResultPage[]
  sitewide: [string, string][]
  gaps: { cluster: string; volume: number | null; note: string }[]
  warnings: string[]
}
export interface CState {
  approved?: { at: number } | null
  done: Record<string, { at: number; via: "manual" | "site"; by?: string }>
  verify: Record<string, { at: number; pages: Record<string, { rows: Record<string, "done" | "todo">; matches?: boolean; error?: string }> }>
}
export interface CrawlItem { ref?: string; kind: string; text: string; hidden?: boolean; zone?: string | null; styled?: boolean; rect?: Rect | null }
export interface CrawlData { status: number; title: string; items: CrawlItem[]; height: number; counts: Record<string, number> }

export interface UpdateInfo { enabled: boolean; version: string; commit: string | null; behind: number; latest: string | null; checkedAt: number; error: string | null; launcher: boolean; app?: boolean; url?: string }

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || "Something went wrong.")
  return j as T
}

export const api = {
  version: (check = false) => req<UpdateInfo>("GET", "/api/version" + (check ? "?check" : "")),
  update: () => req<{ ok: boolean; restart: "auto" | "manual" }>("POST", "/api/update"),
  status: (fresh = false) => req<AppStatus>("GET", "/api/status" + (fresh ? "?fresh" : "")),
  prefs: () => req<Partial<Settings>>("GET", "/api/prefs"),
  savePrefs: (p: Partial<Settings>) => req<Partial<Settings>>("POST", "/api/prefs", p),
  runs: () => req<RunSummary[]>("GET", "/api/runs"),
  run: (id: string) => req<{ run: Run; progress: Progress | null; log: LogEntry[] }>("GET", `/api/runs/${id}`),
  scan: (url: string, name?: string) => req<{ id: string }>("POST", "/api/scan", { url, name }),
  setSiteName: (host: string, name: string) => req<{ ok: boolean; name: string | null }>("POST", "/api/sites", { host, name }),
  rescan: (id: string) => req<{ id: string }>("POST", `/api/runs/${id}/rescan`),
  reshoot: (id: string) => req<{ ok: boolean; pages: number }>("POST", `/api/runs/${id}/reshoot`),
  remove: (id: string) => req<{ ok: boolean }>("DELETE", `/api/runs/${id}`),
  start: (id: string, settings: Settings, selected: string[]) => req<{ ok: boolean }>("POST", `/api/runs/${id}/start`, { settings, selected }),
  cancel: (id: string) => req<{ ok: boolean }>("POST", `/api/runs/${id}/cancel`),
  result: (id: string) => req<{ result: Result | null; state: CState }>("GET", `/api/runs/${id}/result`),
  setDone: (id: string, set: Record<string, boolean>) => req<{ state: CState; progress: RunSummary["progress"] }>("POST", `/api/runs/${id}/state`, { set }),
  setApproved: (id: string, approved: boolean) => req<{ state: CState; progress: RunSummary["progress"] }>("POST", `/api/runs/${id}/state`, { approved }),
  checkLive: (id: string) => req<{ found: number; todo: number; pages: number; state: CState }>("POST", `/api/runs/${id}/check`, {}),
  estimate: (settings: Partial<Settings>, pages: number) => req<Estimate>("POST", "/api/estimate", { settings, pages }),
  refreshLimits: () => req<Limits | null>("POST", "/api/limits/refresh"),
  crawl: (id: string, pid: string) => req<CrawlData>("GET", `/api/runs/${id}/crawl/${pid}`),
}
// Screenshots are versioned by capture time so a retake always shows the new image.
export const shotUrl = (run: Pick<Run, "id" | "shotsAt" | "crawledAt">, pid: string) => `/api/runs/${run.id}/shot/${pid}?v=${run.shotsAt || run.crawledAt || 0}`
export const faviconUrl = (id: string) => `/api/runs/${id}/favicon`
export const exportUrl = (id: string, mode: Mode, download = false) => `/api/runs/${id}/export/${mode}${download ? "?download" : ""}`
