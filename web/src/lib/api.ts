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
export interface Skill { id: string; builtin: boolean; name: string; slug: string; description: string; files: number; missing: { file: string; what: string }[]; added?: number }
export interface Skills { active: string; skills: Skill[]; added?: string }
export interface Settings {
  output: Output
  market: string
  liveDomain: string
  appliedBy: string
  engine: EngineId
  model: string
  effort: string
  notes?: string
  /** The skill a heading plan used (set by the server). */
  skill?: string
  skillName?: string
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
  seo: { status: SeoStatus; progress: Counts | null; percent: number | null } | null
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
  seo?: SeoRun
}
// ---------- SEO plan ----------
export type SeoStatus = "running" | "done" | "partial" | "failed" | "cancelled"
export type SeoFieldId = "title" | "description" | "slug"
export interface SeoSettings { market: string; liveDomain: string; engine: EngineId; model: string; effort: string; notes?: string }
export interface SeoRun { status: SeoStatus; settings: SeoSettings; selected: string[]; job: Job; error?: string; summary?: string; warnings?: string[]; progress?: Counts }
export interface SeoPage {
  id: string; name: string; path: string; group: string | null; collection: string | null; pattern: boolean; planned: boolean
  keyword: string | null; secondary: string[]; h1: string; keywordsFrom: "headings" | "seo"; status: number | null
  why: Partial<Record<SeoFieldId, string>>; notes: string[]
  fields: Record<SeoFieldId, { cur: string; to: string }>
}
export interface SeoResult {
  site: { name: string; url: string; ending: string; market: string; platform: string; checked: number; keywordsFrom: "headings" | "seo" }
  pages: SeoPage[]; notes: string[]; warnings: string[]
}
export interface SeoState {
  done: Record<string, { at: number; via: "manual" | "site" }>
  edits: Record<string, string>
  verify: { at: number; pages: Record<string, { rows: Record<string, "done" | "todo">; status: number; title: string; description: string }> } | null
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
export interface LogEntry { t: number; kind: "tool" | "ai" | "step" | "error" | "stderr"; text: string; job?: "seo" }
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

// ---------- projects and templates ----------
export type ToolId = "scan" | "headings" | "seo" | "launch" | "redirects"
export interface DueRule { from: "kickoff" | "launch"; days: number }
export type LaunchCheckId = "indexing" | "placeholders" | "links" | "seo" | "canonicals" | "legal" | "https"
export interface TItem { id: string; title: string; who: "us" | "client"; done: string; part: string | null; tool: ToolId | null; check?: LaunchCheckId | "plan" | "live" | "map" | "after" | null; due: DueRule | null }
export interface TGroup { id: string; name: string; items: TItem[] }
export interface TPhase { id: string; name: string; due: DueRule | null; groups: TGroup[]; handoff: { title: string; needs: "us" | "client"; items: TItem[] } }
export interface TPart { id: string; name: string; desc: string }
export interface ChecklistTemplate { id: string; kind: "checklist"; name: string; version: number; updated: number; parts: TPart[]; phases: TPhase[] }
export interface MessageTemplate { id: string; kind: "message" | "email"; name: string; subject: string; body: string; use: string[]; updated: number }
export type Template = ChecklistTemplate | MessageTemplate
export interface TemplateSummary { id: string; kind: Template["kind"]; name: string; updated: number; used: number; items?: number; phases?: number; subject?: string; preview?: string; use?: string[] }
export interface ToolInfo { id: ToolId; name: string; ready: boolean; text?: string; runId?: string; progress?: { done: number; total: number }; check?: LaunchCheckId | "plan" | "live" | "map" | "after"; checkName?: string; issues?: number }
export interface PItem { id: string; title: string; check: LaunchCheckId | "plan" | "live" | "map" | "after" | null; doneMeans: string; who: "us" | "client"; part: string | null; tool: ToolId | null; toolInfo: ToolInfo | null; due: string | null; status: "todo" | "done" | "na"; auto: boolean; at: number | null; note: string; link: string; asked: number | null; phaseId: string; phaseName: string; late: boolean; carriedFrom?: string; askBy?: string | null }
export interface Signoff { by: string; date: string; note: string; link: string; file: { name: string; stored: string } | null; at: number }
export interface PPhase { id: string; name: string; index: number; due: string | null; groups: { id: string; name: string; items: PItem[] }[]; handoff: { title: string; needs: "us" | "client"; items: PItem[] }; signoff: Signoff | null; state: "signed" | "current" | "upcoming"; done: number; total: number; ready: boolean }
export interface ProjectRun { id: string; status: RunStatus; created: number; pages: number; output: Output | null; progress: RunProgress | null; hasIcon: boolean; seo: { status: SeoStatus; progress: Counts | null } | null }
export interface Project {
  id: string; name: string; url: string | null; host: string | null; created: number; updated: number; kickoff: string | null; launch: string | null
  clientName: string; templateId: string; templateName: string; parts: string[]
  phases: PPhase[]; current: string | null
  client: { late: PItem[]; soon: PItem[]; notAsked: PItem[]; received: number }
  tools: {
    runs: ProjectRun[]; scan: { runId: string; urls: number; at: number } | null; plan: { runId: string; done: number; total: number; at: number; output: Output | null } | null; iconRun: string | null
    launch: LaunchSummary | null; launchRunning: { id: string } | null; launchHistory: LaunchSummary[]
    seo: { runId: string; done: number; total: number; pages: number; at: number } | null; seoRunning: string | null
    redirects: RedirectSummary | null; redirectsRunning: "build" | "test" | null; oldScan: { runId: string; urls: number; at: number } | null
  }
}
// ---------- redirect map ----------
export type RedirectHow = "same" | "seo" | "slug" | "similar" | "parent" | "home" | "manual"
export interface RedirectRow { from: string; title: string; to: string; how: RedirectHow; score: number; sure: boolean; checked?: boolean }
export type RedirectProblem = "error" | "missing" | "moved" | "none" | "loop" | "dead-end" | "wrong" | "temporary" | "chain"
export interface RedirectResult { ok: boolean; problem: RedirectProblem | null; status: number; final: string; finalStatus: number; hops: number }
export interface RedirectTest { at: number; url: string; live: boolean; total: number; ok: number }
export interface RedirectMap { built: number; oldHost: string; oldRunId: string; oldLive: boolean; newUrl: string; newPages: { path: string; title: string }[]; rows: RedirectRow[]; test: (RedirectTest & { results: Record<string, RedirectResult> }) | null; tests: RedirectTest[] }
export interface RedirectState { map: RedirectMap | null; job: { kind: "build" | "test"; progress: { step: string; done: number; total: number }; started: number } | null; error: string | null }
export interface RedirectSummary { built: number; total: number; redirects: number; same: number; review: number; test: RedirectTest | null }
export interface LaunchSummary { id: string; at: number; url: string; status: "done" | "failed"; staging: boolean; pages: number; checks: Partial<Record<LaunchCheckId, { ok: boolean; count: number }>> }
export interface LaunchIssue { text: string; pages: string[]; soft: boolean }
export interface LaunchCheck { id: LaunchCheckId; name: string; ok: boolean; issues: LaunchIssue[]; note?: string }
export interface LaunchReport {
  id: string; projectId: string; url: string; started: number; ended?: number; status: "running" | "done" | "failed"; error?: string
  progress: { step: "site" | "pages" | "links"; done: number; total: number }
  host?: string; liveHost?: string; staging?: boolean; pagesChecked?: number; linksChecked?: number; checks?: LaunchCheck[]
  info?: {
    sitemap: { found: boolean; url?: string; urls?: number } | null; robots: { found: boolean; blocksAll: boolean } | null; copyright: number | null
    phones: { page: string; number: string }[]; forms: { page: string; count: number }[]; mixed: { page: string; count: number }[]
    external: { checked: number; broken: { url: string; status: number; page: string }[]; social: number }
  }
  pages?: { path: string; status: number; title: string; error: string | null }[]
}
export interface ProjectSummary {
  id: string; name: string; host: string | null; url: string | null; launch: string | null; iconRun: string | null
  current: { index: number; id: string; name: string; done: number; total: number; ready: boolean; needs: "us" | "client"; handoffTitle: string } | null
  phases: { state: PPhase["state"]; done: number; total: number }[]
  clientOpen: number; clientLate: number
}
export interface NextUp { key: string; kind: "item" | "client" | "signoff"; projectId: string; projectName: string; iconRun: string | null; itemId?: string; title: string; phaseId: string; phaseName: string; due: string | null; late: boolean }
export interface HomeData { next: NextUp[]; stats: { dueThisWeek: number; overdue: number; waiting: number; late: number; signoffs: number; nextLaunch: { name: string; date: string } | null }; projects: ProjectSummary[] }
export interface NewProject { name: string; url?: string; templateId: string; kickoff?: string; launch?: string; parts: string[]; clientName?: string }
export interface SignoffInput { by: string; date: string; note?: string; link?: string; file?: { name: string; data: string } | null; carry?: string[]; skip?: string[] }

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
  run: (id: string) => req<{ run: Run; progress: Progress | null; seoProgress: Progress | null; log: LogEntry[] }>("GET", `/api/runs/${id}`),
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
  estimate: (settings: Partial<Settings>, pages: number, tool: "headings" | "seo" = "headings") => req<Estimate>("POST", "/api/estimate", { settings, pages, tool }),
  refreshLimits: () => req<Limits | null>("POST", "/api/limits/refresh"),
  crawl: (id: string, pid: string) => req<CrawlData>("GET", `/api/runs/${id}/crawl/${pid}`),
  skills: () => req<Skills>("GET", "/api/skills"),
  addSkill: (b: { files?: { path: string; data: string }[]; zip?: string }) => req<Skills>("POST", "/api/skills", b),
  useSkill: (id: string) => req<Skills>("POST", "/api/skills/active", { id }),
  removeSkill: (id: string) => req<Skills>("DELETE", `/api/skills/${id}`),
  copySkill: (id: string) => req<Skills>("POST", `/api/skills/${id}/copy`),
  openSkill: (id: string) => req<{ ok: boolean }>("POST", `/api/skills/${id}/open`),
  seoStart: (id: string, settings: SeoSettings, selected: string[]) => req<{ ok: boolean }>("POST", `/api/runs/${id}/seo/start`, { settings, selected }),
  seoResult: (id: string) => req<{ result: SeoResult | null; state: SeoState }>("GET", `/api/runs/${id}/seo/result`),
  seoState: (id: string, b: { set?: Record<string, boolean>; edits?: Record<string, string | null> }) => req<{ state: SeoState; progress: Counts }>("POST", `/api/runs/${id}/seo/state`, b),
  seoCheck: (id: string) => req<{ found: number; todo: number; state: SeoState; progress: Counts }>("POST", `/api/runs/${id}/seo/check`),
  // projects and templates
  home: () => req<HomeData>("GET", "/api/home"),
  projects: () => req<ProjectSummary[]>("GET", "/api/projects"),
  project: (id: string) => req<Project>("GET", `/api/projects/${id}`),
  createProject: (b: NewProject) => req<{ id: string; runId: string | null }>("POST", "/api/projects", b),
  updateProject: (id: string, b: Partial<{ name: string; kickoff: string | null; launch: string | null; clientName: string; url: string }>) => req<Project>("PATCH", `/api/projects/${id}`, b),
  removeProject: (id: string) => req<{ ok: boolean }>("DELETE", `/api/projects/${id}`),
  setItem: (id: string, itemId: string, b: Partial<{ status: PItem["status"]; note: string; link: string; asked: boolean | number; due: string | null }>) => req<Project>("POST", `/api/projects/${id}/items/${itemId}`, b),
  askItems: (id: string, items: string[]) => req<Project>("POST", `/api/projects/${id}/ask`, { items }),
  signoff: (id: string, phaseId: string, b: SignoffInput) => req<Project>("POST", `/api/projects/${id}/signoff/${phaseId}`, b),
  unsign: (id: string, phaseId: string) => req<Project>("DELETE", `/api/projects/${id}/signoff/${phaseId}`),
  scanProject: (id: string, url?: string) => req<{ runId: string }>("POST", `/api/projects/${id}/scan`, { url }),
  startLaunch: (id: string, url?: string) => req<{ checkId: string }>("POST", `/api/projects/${id}/launch`, { url }),
  launch: (id: string, checkId: string) => req<LaunchReport>("GET", `/api/projects/${id}/launch/${checkId}`),
  redirects: (id: string) => req<RedirectState>("GET", `/api/projects/${id}/redirects`),
  buildRedirects: (id: string, url: string) => req<RedirectState>("POST", `/api/projects/${id}/redirects/build`, { url }),
  testRedirects: (id: string, url: string) => req<RedirectState>("POST", `/api/projects/${id}/redirects/test`, { url }),
  setRedirects: (id: string, b: { to?: Record<string, string>; checked?: Record<string, boolean> }) => req<RedirectState>("POST", `/api/projects/${id}/redirects/rows`, b),
  templates: () => req<TemplateSummary[]>("GET", "/api/templates"),
  template: (id: string) => req<Template>("GET", `/api/templates/${id}`),
  saveTemplate: (id: string, doc: Partial<Template>) => req<Template>("PUT", `/api/templates/${id}`, doc),
  createTemplate: (b: { kind: Template["kind"]; name?: string; copyFrom?: string }) => req<Template>("POST", "/api/templates", b),
  removeTemplate: (id: string) => req<{ ok: boolean }>("DELETE", `/api/templates/${id}`),
}
// Screenshots are versioned by capture time so a retake always shows the new image.
export const shotUrl = (run: Pick<Run, "id" | "shotsAt" | "crawledAt">, pid: string) => `/api/runs/${run.id}/shot/${pid}?v=${run.shotsAt || run.crawledAt || 0}`
export const faviconUrl = (id: string) => `/api/runs/${id}/favicon`
export const exportUrl = (id: string, mode: Mode, download = false) => `/api/runs/${id}/export/${mode}${download ? "?download" : ""}`
export const proofUrl = (id: string, stored: string) => `/api/projects/${id}/files/${encodeURIComponent(stored)}`
export const seoCsvUrl = (id: string) => `/api/runs/${id}/seo/export.csv`
