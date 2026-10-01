import type { PlatformId } from "@/lib/platforms"
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
  /** Claude Code can run confined to the scan's folder (its --restricted mode). */
  restricted?: boolean
}
export interface ModelInfo { id: string; name: string; desc: string; usage: number; speed: number; rec?: boolean }
export interface EngineCatalog {
  name: string
  /** Works, but tested far less than Claude Code. */
  beta?: boolean
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
export type SkillTool = "headings" | "seo"
export interface Skill { id: string; tool: SkillTool; builtin: boolean; name: string; slug: string; description: string; files: number; missing: { file: string; what: string }[]; added?: number }
export interface SkillSet { active: string; skills: Skill[] }
export interface Skills { headings: SkillSet; seo: SkillSet; added?: string }
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
  /** The checklist template last used for a new project. */
  template?: string
  /** The studio or agency name on client status pages. */
  agency?: string
  /** How the person writes, for "Rewrite in my voice". */
  voice?: string
  /** A morning notification with what's due today. */
  notify?: boolean
  /** Invoices: the usual hourly rate ("$90"), your business details, how clients pay you, the next number and the days to pay. */
  rate?: string
  bizDetails?: string
  payLink?: string
  payDetails?: string
  invoiceNext?: string
  payDays?: number
  /** The Google Cloud project ID, to fill in the connector setup commands. */
  gcpProject?: string
}
/** Which official connectors the user's Claude Code has, from `claude mcp list`. */
export type ConnectorId = "ga4" | "ads" | "meta" | "gsc"
export interface ConnectorCheck { at: number; installed: boolean; count?: number; found: Partial<Record<ConnectorId, { name: string; state: "connected" | "auth" | "failed"; note: string }>>; error?: string | null }
export interface Counts { tasks: number; done: number }
/** `all` is the merged to-do list; `live`/`optimize` come from runs made before it existed. */
export type RunProgress = { all?: Counts; now?: Counts; live?: Counts; optimize?: Counts }
export interface RunSummary {
  id: string
  /** The project the scan belongs to, and which of its sites it read. */
  projectId: string | null
  site: SiteKey | null
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
  /** The project the scan belongs to, and which of its sites it read. */
  projectId?: string | null
  site?: SiteKey | null
  url: string
  origin?: string
  name: string
  platform?: string
  created: number
  updated?: number
  status: RunStatus
  scan?: { started: number; step: string; done: number; total: number; ended?: number; error?: string; pagesStarted?: number; blocked?: number }
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
export interface SeoSettings { market: string; liveDomain: string; engine: EngineId; model: string; effort: string; notes?: string; skill?: string; skillName?: string }
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
export type ToolId = "scan" | "headings" | "seo" | "launch" | "redirects" | "inventory" | "requests"
export type Decision = "keep" | "rewrite" | "merge" | "remove"
export interface InventoryRow { path: string; name: string; title: string; words: number | null; status: number | null; nav: boolean; collection: string | null; decision: Decision; reason: string; into: string | null; by: "rule" | "ai" | "you"; sure: boolean }
export interface Inventory { at: number; runId: string; host: string; ai: boolean; rows: InventoryRow[] }
export interface InventorySummary { at: number; total: number; review: number; keep: number; rewrite: number; merge: number; remove: number; ai: boolean }
export interface DueRule { from: "kickoff" | "launch"; days: number }
export type LaunchCheckId = "indexing" | "placeholders" | "links" | "seo" | "canonicals" | "legal" | "https" | "a11y" | "speed" | "tracking"
export interface TItem { id: string; title: string; who: "us" | "client"; done: string; part: string | null; platforms?: PlatformId[] | null; tool: ToolId | null; check?: LaunchCheckId | "plan" | "live" | "map" | "after" | "recrawl" | "brand" | "content" | null; due: DueRule | null }
export interface TGroup { id: string; name: string; items: TItem[] }
export interface TPhase { id: string; name: string; due: DueRule | null; groups: TGroup[]; handoff: { title: string; needs: "us" | "client"; items: TItem[] } }
export interface TPart { id: string; name: string; desc: string }
/** What a checklist is for and where its steps come from, shown in the gallery. */
export interface TemplateMeta { desc?: string; basedOn?: { label: string; url: string }[]; labels?: DateLabels | null; repeat?: "monthly" | null; refSpan?: number
  /** False for work with no website (a brand, an ad setup): no site fields or Site tools until one is added. */
  website?: boolean }
/** A template's names for the two project dates, like "Store opens" or "Report due". */
export interface DateLabels { kickoff?: string; launch?: string }
export interface ChecklistTemplate extends TemplateMeta { id: string; kind: "checklist"; name: string; version: number; updated: number; parts: TPart[]; phases: TPhase[] }
export interface MessageTemplate { id: string; kind: "message" | "email"; name: string; subject: string; body: string; use: string[]; updated: number }
export type Template = ChecklistTemplate | MessageTemplate
export interface TemplateSummary extends TemplateMeta { id: string; kind: Template["kind"]; name: string; updated: number; used: number; items?: number; phases?: number; subject?: string; preview?: string; use?: string[] }
export interface ToolInfo { id: ToolId; name: string; ready: boolean; text?: string; runId?: string; progress?: { done: number; total: number }; check?: LaunchCheckId | "plan" | "live" | "map" | "after" | "recrawl" | "brand" | "content"; checkName?: string; issues?: number }
export interface PItem { id: string; title: string; check: LaunchCheckId | "plan" | "live" | "map" | "after" | "recrawl" | "brand" | "content" | null; doneMeans: string; who: "us" | "client"; part: string | null; tool: ToolId | null; toolInfo: ToolInfo | null; due: string | null; status: "todo" | "done" | "na"; auto: boolean; at: number | null; note: string; link: string; asked: number | null; nudged: number | null; hist: { at: number; what: string }[]; manualDue: boolean; phaseId: string; phaseName: string; late: boolean; carriedFrom?: string; askBy?: string | null; remindDue?: boolean
  /** The estimate and the time logged on the item, in minutes. */
  est: number | null; mins: number }
export interface Signoff { by: string; date: string; note: string; link: string; file: { name: string; stored: string } | null; at: number }
/** A payment due at a phase's sign-off: invoiced once the phase is signed off, then paid. */
export interface Payment { label: string; amount: string; invoiced: number | null; paid: number | null }
export interface PPhase { id: string; name: string; index: number; payment: Payment | null; due: string | null; groups: { id: string; name: string; items: PItem[] }[]; handoff: { title: string; needs: "us" | "client"; items: PItem[] }; signoff: Signoff | null; state: "signed" | "current" | "upcoming"; done: number; total: number; ready: boolean }
export type SiteKey = "old" | "staging" | "live"
export type Sites = Record<SiteKey, string | null>
export interface ProjectRun { id: string; site: SiteKey | null; status: RunStatus; created: number; pages: number; scanned: number; output: Output | null; progress: RunProgress | null; hasIcon: boolean; seo: { status: SeoStatus; progress: Counts | null } | null; error: string | null; url: string }
export interface Project {
  id: string; kind: "project" | "audit"; name: string; url: string | null; host: string | null; sites: Sites; platform: PlatformId | null;
  /** The project has a website (or its kind of work does): it shows the site details and the Tools tab. */
  website: boolean
  labels: DateLabels | null; repeat: "monthly" | null; cycle: number; cycles: { at: number; kickoff: string | null; launch: string | null; done: number; total: number }[]; sample: boolean; lastUpdate: number | null; remindEvery: number; created: number; updated: number; kickoff: string | null; launch: string | null
  clientName: string; templateId: string; templateName: string; parts: string[]
  /** Days the plan has been shifted, and how far behind it is now. */
  slip: number; behind: Behind
  /** The template has changed since the project was made or last updated from it. */
  templateChanged: boolean
  phases: PPhase[]; current: string | null
  client: { late: PItem[]; soon: PItem[]; notAsked: PItem[]; received: number }
  tools: {
    runs: ProjectRun[]; scan: { runId: string; urls: number; at: number } | null; plan: { runId: string; done: number; total: number; at: number; output: Output | null } | null; iconRun: string | null
    launch: LaunchSummary | null; launchRunning: { id: string } | null; launchHistory: LaunchSummary[]
    seo: { runId: string; done: number; total: number; pages: number; at: number } | null; seoRunning: string | null
    redirects: RedirectSummary | null; inventory: InventorySummary | null; redirectsRunning: "build" | "test" | "list" | null; oldScan: { runId: string; urls: number; at: number } | null
  }
  /** Time logged on the project, in minutes, counting a timer running on it. */
  time: { mins: number; billable: number; running: { itemId: string | null; start: number } | null; month: number | null }
  /** A care plan's hours each month, and whether the live site answered when Groundwork looked (last 30 days). */
  planHours: number | null
  uptime: { last: { at: number; ok: boolean; status: number; ms: number; error?: string }; checks: number; down: { at: number; status: number; error: string | null }[] } | null
  invoices: InvoiceSummary[]
  /** The project's own hourly rate, when it differs from Settings, and who invoices go to. */
  rate: string; billTo: string
  /** Payments marked paid and paid hours invoices, added up in one currency. */
  paid: { amount: number; currency: Currency; mixed: boolean } | null
  /** The project's money in one currency: planned in payments, paid, invoiced and waiting, ready to invoice. */
  money: { currency: Currency; planned: number; paid: number; waiting: number; toInvoice: number; mixed: boolean } | null
  /** The deposit due at kickoff, and what the client asked for beyond the agreed work. */
  deposit: Payment | null
  extras: Extra[]
  /** The live domain's SSL certificate and registration, checked once a day. */
  renewals: Renewals | null
  /** Who owns each account the work depends on, for the handoff. */
  accounts: Account[]
  /** CSV exports from Search Console, GA4 or Google Ads, newest first. */
  traffic: TrafficImport[] | null
  /** Files to get from the client, ticked off as they land in the project's folder. */
  requests: Requests
}
export interface FileRequest { id: string; title: string; kind: "content" | "brand" | "other"; match: string[]; path: string | null; status: "waiting" | "in"; file: { name: string; at: number } | null; in: number | null; at: number }
export interface Requests { folder: string | null; folderOk: boolean; due: string | null; rows: FileRequest[]; total: number; in: number; waiting: number; late: boolean }
export interface TrafficImport { id: string; at: number; name: string; source: string; metric: "clicks" | "sessions" | "views" | "users"; total: number; pages: number; before: boolean; top: { path: string; n: number }[] }
export interface Account { id: string; kind: string; name: string; where: string; owner: "" | "client" | "us" | "none"; login: string; access: boolean; revoke: boolean; note: string }
export interface Renewals {
  host: string; at: number; hosted: boolean
  ssl: { expires?: string; issuer?: string; trusted?: boolean; auto?: boolean; error?: string }
  domain: { domain: string; expires?: string | null; registrar?: string | null; error?: string }
  warnings: { what: "ssl" | "domain"; name: string; expires: string; days: number; late: boolean; auto?: boolean; by?: string | null }[]
}
export interface Currency { before: string; after: string }
export interface Extra { id: string; title: string; asked: string; status: "asked" | "quoted" | "approved" | "done" | "declined"; price: string; note: string; at: number; invoiceId?: string; mins: number }
export interface InvoiceLine { text: string; sub?: string; qty?: number; unit?: number; amount: number }
export interface InvoiceSummary { id: string; number: string; kind: "milestone" | "hours" | "extra"; date: string; due: string | null; phaseId: string | null; extraId?: string | null; from: string | null; to: string | null; total: number; currency: Currency; paid: number | null; hours: number | null }
export interface InvoiceDraft { kind: "milestone" | "hours" | "extra"; extraId?: string; number: string; date: string; due: string; billTo: string; note: string; lines: InvoiceLine[]; currency: Currency; total: number; phaseId?: string; from?: string; to?: string; entryIds?: string[]; rate?: number; mins?: number }
// ---------- redirect map ----------
export type RedirectHow = "same" | "seo" | "slug" | "similar" | "parent" | "home" | "manual"
export interface RedirectRow { from: string; title: string; to: string; how: RedirectHow; score: number; sure: boolean; checked?: boolean }
export type RedirectProblem = "error" | "missing" | "moved" | "none" | "loop" | "dead-end" | "wrong" | "temporary" | "chain"
export interface RedirectResult { ok: boolean; problem: RedirectProblem | null; status: number; final: string; finalStatus: number; hops: number }
export interface RedirectTest { at: number; url: string; live: boolean; oldSite?: boolean; total: number; ok: number }
export interface RedirectMap { built: number; oldHost: string; oldRunId: string; oldLive: boolean; newUrl: string; newPages: { path: string; title: string }[]; rows: RedirectRow[]; test: (RedirectTest & { results: Record<string, RedirectResult> }) | null; tests: RedirectTest[] }
export type ListProblem = "error" | "missing" | "dead-end" | "loop" | "offsite" | "wrong" | "home" | "temporary" | "chain"
export interface ListResult { input: string; url: string; path: string; ok: boolean; problem: ListProblem | null; status: number; final: string; finalStatus: number; hops: number; mapped: string | null }
export interface RedirectList { at: number; url: string; total: number; ok: number; results: ListResult[] }
export interface RedirectState { map: RedirectMap | null; list: RedirectList | null; job: { kind: "build" | "test" | "list"; progress: { step: string; done: number; total: number }; started: number } | null; error: string | null
  /** Clicks for each old URL from the newest export before launch, keyed like the map's paths. */
  traffic: { source: string; metric: string; at: number; total: number; by: Record<string, number> } | null }
export interface CompareChange { what: "page" | "title" | "description" | "h1" | "canonical"; kind: "missing" | "gone" | "changed" | "added" | "elsewhere"; before?: string; after?: string }
export interface Compare {
  old: { runId: string; host: string; at: number }; new: { runId: string; host: string; site: SiteKey; at: number } | null
  choices: { runId: string; site: SiteKey; host: string; at: number; pages: number }[]
  rows: { from: string; to: string; moved: boolean; scanned: boolean; changes: CompareChange[] }[]
  counts?: { pages: number; same: number; missing: number; gone: number; changed: number }
}
export interface RedirectSummary { built: number; total: number; redirects: number; same: number; review: number; test: RedirectTest | null }
export interface LaunchSummary { id: string; at: number; url: string; status: "done" | "failed" | "cancelled"; staging: boolean; oldSite?: boolean; watch?: number | null; newIssues?: number; pages: number; checks: Partial<Record<LaunchCheckId, { ok: boolean; count: number }>> }
export interface LaunchIssue { text: string; pages: string[]; soft: boolean; fix?: string; isNew?: boolean; examples?: { page: string; text: string; html?: string }[] }
export interface LaunchCheck { id: LaunchCheckId; name: string; ok: boolean; issues: LaunchIssue[]; note?: string; carried?: number }
export type Rating = "good" | "fix" | "poor" | null
export interface SpeedResult { path: string; error?: string; status?: number; lcp: number | null; cls: number; tbt: number; fcp: number | null; lcpEl: string; bytes: number; requests: number; heavy: { name: string; type: string; bytes: number }[]; rating: { lcp: Rating; cls: Rating; tbt: Rating } }
export interface LaunchReport {
  id: string; projectId: string; url: string; started: number; ended?: number; status: "running" | "done" | "failed" | "cancelled"; error?: string
  progress: { step: "site" | "pages" | "links" | "tracking" | "speed"; done: number; total: number; started?: number; stepAt?: number; times?: Record<string, number> }
  /** Whether this check runs the speed test, and the day after launch it re-checked (3, 7 or 30), if any. */
  speed?: boolean; watch?: number | null
  host?: string; liveHost?: string; staging?: boolean; oldSite?: boolean; pagesChecked?: number; linksChecked?: number; checks?: LaunchCheck[]
  info?: {
    sitemap: { found: boolean; url?: string; urls?: number } | null; robots: { found: boolean; blocksAll: boolean } | null; copyright: number | null
    phones: { page: string; number: string }[]; forms: { page: string; count: number }[]; mixed: { page: string; count: number }[]
    external: { checked: number; broken: { url: string; status: number; page: string }[]; social: number }
    speed?: SpeedResult[] | null; a11yPages?: number
    /** What the tracking check saw, and whether Search Console's verification tag is on the home page. */
    tracking?: TrackingInfo; trackingError?: string; searchConsole?: "meta" | null
    /** What the site runs on, as its pages show it, and who answers for its DNS. */
    stack?: { services: { name: string; kind: string; pages: number }[]; dns: { host: string | null; servers: string[] } | null }
  }
  pages?: { path: string; status: number; title: string; error: string | null }[]
  /** The last check of the same site, and what was fixed since. */
  previous?: { id: string; at: number }; fixed?: { check: LaunchCheckId; text: string; pages: number }[]
}
export interface TrackingInfo {
  tags: { tag: string; name: string; ids: string[]; pages: number; of: number }[]
  banner: string | null; buttons: { accept: string | null; reject: string | null } | null; consentMode: boolean
  /** The tags that tracked on a first visit, after rejecting and after accepting cookies. Null when that wasn't tested. */
  firstVisit: string[] | null; afterReject: string[] | null; afterAccept: string[] | null
  redirects: { from: string; to: string; kept: boolean }[]; blocked: number
}
export interface ProjectSummary {
  id: string; kind: "project" | "audit"; name: string; templateId: string | null; sample?: boolean; website?: boolean; host: string | null; url: string | null; launch: string | null; iconRun: string | null
  current: { index: number; id: string; name: string; done: number; total: number; ready: boolean; needs: "us" | "client"; handoffTitle: string } | null
  phases: { state: PPhase["state"]; done: number; total: number }[]
  clientOpen: number; clientLate: number; behind: Behind
  /** What's running for the project now ("Launch check", "SEO plan"…), or null. */
  running: string | null
}
/** Late items across the project (ours and the client's), and how late the oldest one in the current phase is. */
export interface Behind { items: number; ours: number; client: number; days: number }
export interface TemplateUpdate {
  template: string; version: number; projectVersion: number
  added: { title: string; phase: string }[]; changed: { title: string; was: string; phase: string; fields: string[] }[]; removed: { id: string; title: string; phase: string; touched: boolean }[]
}
export interface ShiftPreview {
  days: number; launch: { from: string | null; to: string | null }; late: { before: number; after: number }
  next: { title: string; due: string } | null; phases: { name: string; from: string | null; to: string; clash: boolean }[]
}
export interface NextUp { key: string; kind: "item" | "client" | "ask" | "signoff" | "watch" | "renewal" | "down" | "files"; projectId: string; itemId?: string; checkId?: string; title: string; phaseId?: string; phaseName?: string; due: string | null; late: boolean; asked?: boolean; ready?: boolean; leftover?: boolean }
/** Home: this week's work for one project, most urgent first. */
export interface HomeGroup { projectId: string; projectName: string; iconRun: string | null; rows: NextUp[]; more: number; late: number }
/** Messages to send today for one project: items to ask for, reminders, the weekly update and invoices. */
export interface BriefResult { name: string | null; clientName: string | null; sites: Sites; platform: PlatformId | null; kickoff: string | null; launch: string | null; parts: string[] | null; items: { title: string; who: "us" | "client"; phase: string; done: string }[]; ai: boolean }
export interface HomeMessages { projectId: string; projectName: string; iconRun: string | null; clientName: string; ask: number; remind: number; update: boolean; lastUpdate: number | null; invoices: { phaseId: string; label: string; amount: string }[]; unpaid: { phaseId: string | null; invoiceId?: string; label: string; amount: string; invoiced: number }[] }
export interface HomeData { groups: HomeGroup[]; messages: HomeMessages[]; stats: { dueThisWeek: number; dueToday: number; watchIssues: number; overdue: number; toAsk: number; waiting: number; late: number; signoffs: number; nextLaunch: { name: string; date: string } | null }; projects: ProjectSummary[] }
export interface NewProject { kind?: "project" | "audit"; platform?: PlatformId | null; extraItems?: BriefResult["items"]; name: string; sites?: Partial<Sites>; templateId?: string; kickoff?: string; launch?: string; parts?: string[]; clientName?: string; startAt?: string }
export interface SignoffInput { by: string; date: string; note?: string; link?: string; file?: { name: string; data: string } | null; carry?: string[]; skip?: string[] }

// ---------- time and tasks ----------
export interface TimeEntry {
  id: string; who: string; projectId: string | null; pname: string | null; gone?: boolean; itemId: string | null; item: { title: string; phase: string } | null; taskId: string | null
  title: string; day: string; mins: number; start: number | null; end: number | null; billable: boolean; by: "timer" | "hand"; at: number
  /** The invoice this time was billed on, and the extra request it was for. */
  invoice?: string; extraId?: string | null
}
export interface RunningTimer {
  id: string; projectId: string | null; pname: string | null; itemId: string | null; item: { title: string; phase: string } | null; taskId: string | null; extraId?: string | null; title: string; start: number; billable: boolean
  /** When "Still on it" was last answered, and time away from the Mac to ask about. */
  checked: number | null; away: { from: number; to: number } | null; now: number
}
export interface TimerState { running: RunningTimer | null; today: { mins: number; billable: number } }
export type Stopped = TimeEntry | { dropped: true } | null
export interface Task { id: string; title: string; est: number | null; projectId: string | null; pname: string | null; itemId: string | null; item: { title: string; phase: string; done: boolean } | null; day: string; done: number | null; created: number; mins: number }
export interface TimerStart { projectId?: string | null; itemId?: string | null; taskId?: string | null; extraId?: string | null; title?: string; billable?: boolean }

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
  diagnostics: () => req<{ text: string }>("GET", "/api/diagnostics"),
  connectors: () => req<ConnectorCheck | null>("GET", "/api/connectors"),
  checkConnectors: () => req<ConnectorCheck>("POST", "/api/connectors/check"),
  savePrefs: (p: Partial<Settings>) => req<Partial<Settings>>("POST", "/api/prefs", p),
  runs: () => req<RunSummary[]>("GET", "/api/runs"),
  run: (id: string) => req<{ run: Run; progress: Progress | null; seoProgress: Progress | null; log: LogEntry[] }>("GET", `/api/runs/${id}`),
  /** Every checklist item across projects, for quick find. */
  items: () => req<{ projectId: string; projectName: string; iconRun: string | null; id: string; title: string; phaseName: string; status: PItem["status"]; who: "us" | "client"; late: boolean }[]>("GET", "/api/items"),
  /** Zips the whole data folder into Documents/Groundwork Backups and shows it in Finder. */
  backup: () => req<{ file: string }>("POST", "/api/backup"),
  /** Brings in a project exported from Groundwork (the zip, base64). */
  importProject: (data: string) => req<{ id: string; name: string; runs: number }>("POST", "/api/projects/import", { data }),
  createSample: () => req<{ id: string }>("POST", "/api/sample"),
  /** Opens Groundwork's data folder in Finder. */
  openData: () => req<{ ok: boolean }>("POST", "/api/open-data"),
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
  addSkill: (b: { files?: { path: string; data: string }[]; zip?: string; tool: SkillTool }) => req<Skills>("POST", "/api/skills", b),
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
  updateProject: (id: string, b: Partial<{ name: string; kickoff: string | null; launch: string | null; clientName: string; url: string; sites: Partial<Sites>; platform: PlatformId | null; remindEvery: number; rate: string; planHours: number | null }>) => req<Project>("PATCH", `/api/projects/${id}`, b),
  templateUpdate: (id: string, b: { dryRun?: boolean; removeUntouched?: boolean }) => req<TemplateUpdate & { project?: Project }>("POST", `/api/projects/${id}/template`, b),
  shiftPlan: (id: string, b: { days: number; launch: boolean }) => req<Project>("POST", `/api/projects/${id}/shift`, b),
  /** The weekly update was sent today. */
  updateSent: (id: string) => req<Project>("POST", `/api/projects/${id}/update-sent`),
  /** Add, change or remove a phase's payment milestone, or mark it invoiced or paid. */
  setPayment: (id: string, phaseId: string, b: Partial<{ label: string; amount: string; invoiced: boolean; paid: boolean; remove: boolean }>) => req<Project>("POST", `/api/projects/${id}/payments/${phaseId}`, b),
  /** Suggested project details from a brief: with AI when an account is signed in, else only addresses and dates. */
  brief: (b: { text: string; templateId: string; useAi: boolean }) => req<BriefResult>("POST", "/api/brief", b),
  rewrite: (text: string, voice: string) => req<{ text: string }>("POST", "/api/rewrite", { text, voice }),
  /** A repeating project (a care plan) starts its next month. */
  nextCycle: (id: string) => req<Project>("POST", `/api/projects/${id}/next-cycle`),
  previewShift: (id: string, b: { days: number; launch: boolean }) => req<ShiftPreview>("POST", `/api/projects/${id}/shift`, { ...b, dryRun: true }),
  removeProject: (id: string) => req<{ ok: boolean }>("DELETE", `/api/projects/${id}`),
  setItem: (id: string, itemId: string, b: Partial<{ status: PItem["status"]; note: string; link: string; asked: boolean | number; nudged: boolean; due: string | null; est: number | null }>) => req<Project>("POST", `/api/projects/${id}/items/${itemId}`, b),
  askItems: (id: string, items: string[], nudge = false) => req<Project>("POST", `/api/projects/${id}/ask`, { items, nudge }),
  signoff: (id: string, phaseId: string, b: SignoffInput) => req<Project>("POST", `/api/projects/${id}/signoff/${phaseId}`, b),
  unsign: (id: string, phaseId: string) => req<Project>("DELETE", `/api/projects/${id}/signoff/${phaseId}`),
  scanProject: (id: string, site?: SiteKey, url?: string) => req<{ runId: string }>("POST", `/api/projects/${id}/scan`, { site, url }),
  startLaunch: (id: string, url?: string, speed = true) => req<{ checkId: string }>("POST", `/api/projects/${id}/launch`, { url, speed }),
  launch: (id: string, checkId: string) => req<LaunchReport>("GET", `/api/projects/${id}/launch/${checkId}`),
  cancelLaunch: (id: string, checkId: string) => req<{ ok: boolean }>("POST", `/api/projects/${id}/launch/${checkId}/cancel`),
  cancelRedirects: (id: string) => req<{ ok: boolean }>("POST", `/api/projects/${id}/redirects/cancel`),
  redirects: (id: string) => req<RedirectState>("GET", `/api/projects/${id}/redirects`),
  buildRedirects: (id: string, url: string) => req<RedirectState>("POST", `/api/projects/${id}/redirects/build`, { url }),
  testRedirects: (id: string, url: string) => req<RedirectState>("POST", `/api/projects/${id}/redirects/test`, { url }),
  /** Where each pasted URL ends up on `url`'s site. */
  testList: (id: string, text: string, url: string) => req<RedirectState>("POST", `/api/projects/${id}/redirects/list`, { text, url }),
  addToMap: (id: string, paths: string[]) => req<RedirectState & { added: number }>("POST", `/api/projects/${id}/redirects/add`, { paths }),
  inventory: (id: string) => req<Inventory | null>("GET", `/api/projects/${id}/inventory`),
  buildInventory: (id: string, ai: boolean) => req<Inventory>("POST", `/api/projects/${id}/inventory/build`, { ai }),
  setInventory: (id: string, b: { set?: Record<string, { decision: Decision; into?: string | null }>; accept?: string[] }) => req<Inventory>("POST", `/api/projects/${id}/inventory/rows`, b),
  applyInventory: (id: string) => req<{ changed: number }>("POST", `/api/projects/${id}/inventory/apply`),
  compare: (id: string, run?: string) => req<Compare>("GET", `/api/projects/${id}/compare${run ? "?run=" + run : ""}`),
  setRedirects: (id: string, b: { to?: Record<string, string>; checked?: Record<string, boolean> }) => req<RedirectState>("POST", `/api/projects/${id}/redirects/rows`, b),
  templates: () => req<TemplateSummary[]>("GET", "/api/templates"),
  template: (id: string) => req<Template>("GET", `/api/templates/${id}`),
  saveTemplate: (id: string, doc: Partial<Template>) => req<Template>("PUT", `/api/templates/${id}`, doc),
  createTemplate: (b: { kind: Template["kind"]; name?: string; copyFrom?: string }) => req<Template>("POST", "/api/templates", b),
  /** Puts back a template that was just deleted (for Undo). */
  restoreTemplate: (t: Template) => req<Template>("POST", "/api/templates", { kind: t.kind, restore: t }),
  removeTemplate: (id: string) => req<{ ok: boolean }>("DELETE", `/api/templates/${id}`),
  // time and tasks
  timer: () => req<TimerState>("GET", "/api/timer"),
  /** Starts a timer; one already running stops and is logged first. */
  startTimer: (b: TimerStart) => req<TimerState & { stopped: Stopped }>("POST", "/api/timer/start", b),
  /** Stops the timer, at `at` when it was forgotten. Under a minute isn't logged. */
  stopTimer: (at?: number) => req<TimerState & { stopped: Stopped }>("POST", "/api/timer/stop", { at }),
  stillOn: () => req<TimerState>("POST", "/api/timer/still"),
  /** Time away with the timer running: keep it, take it out and carry on, or stop when you left. */
  awayTime: (what: "keep" | "trim" | "stop") => req<TimerState>("POST", "/api/timer/away", { what }),
  time: (q: { from?: string; to?: string; project?: string | null }) => req<TimerState & { entries: TimeEntry[] }>("GET", "/api/time?" + new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])),
  addTime: (b: { title?: string; projectId?: string | null; itemId?: string | null; day?: string; dur?: string; mins?: number; billable?: boolean }) => req<TimeEntry>("POST", "/api/time", b),
  editTime: (id: string, b: Partial<{ title: string; projectId: string | null; itemId: string | null; day: string; dur: string; mins: number; start: number; end: number; billable: boolean }>) => req<TimeEntry>("PATCH", `/api/time/${id}`, b),
  removeTime: (id: string) => req<{ ok: boolean }>("DELETE", `/api/time/${id}`),
  tasks: (day?: string) => req<TimerState & { tasks: Task[] }>("GET", "/api/tasks" + (day ? "?day=" + day : "")),
  /** A task typed as "Call Sam 30m": the time at the end becomes its estimate. */
  addTask: (b: { text?: string; title?: string; projectId?: string | null; itemId?: string | null; day?: string }) => req<Task>("POST", "/api/tasks", b),
  editTask: (id: string, b: Partial<{ title: string; projectId: string | null; itemId: string | null; est: number | string | null; day: string; done: boolean }>) => req<Task>("PATCH", `/api/tasks/${id}`, b),
  removeTask: (id: string) => req<{ ok: boolean }>("DELETE", `/api/tasks/${id}`),
  // invoices
  /** A new invoice to look over: for a phase's payment, or for billable hours between two dates. */
  invoiceDraft: (id: string, q: { kind: "milestone" | "hours" | "extra"; phase?: string; extra?: string; from?: string; to?: string; rate?: string }) => req<InvoiceDraft>("GET", `/api/projects/${id}/invoice-draft?` + new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])),
  saveInvoice: (id: string, d: InvoiceDraft) => req<{ invoice: InvoiceSummary; project: Project }>("POST", `/api/projects/${id}/invoices`, d),
  setInvoice: (id: string, invId: string, b: { paid: boolean }) => req<Project>("POST", `/api/projects/${id}/invoices/${invId}`, b),
  removeInvoice: (id: string, invId: string) => req<Project>("DELETE", `/api/projects/${id}/invoices/${invId}`),
  /** A Search Console, GA4 or Google Ads CSV export, read on this Mac. */
  importTraffic: (id: string, name: string, text: string) => req<Project>("POST", `/api/projects/${id}/traffic`, { name, text }),
  removeTraffic: (id: string, impId: string) => req<Project>("DELETE", `/api/projects/${id}/traffic/${impId}`),
  /** An extra request: add one (no id), change it, or remove it. */
  addExtra: (id: string, b: Partial<Pick<Extra, "title" | "asked" | "status" | "price" | "note">>) => req<Project>("POST", `/api/projects/${id}/extras`, b),
  setExtra: (id: string, extraId: string, b: Partial<Pick<Extra, "title" | "asked" | "status" | "price" | "note">>) => req<Project>("POST", `/api/projects/${id}/extras/${extraId}`, b),
  removeExtra: (id: string, extraId: string) => req<Project>("DELETE", `/api/projects/${id}/extras/${extraId}`),
  setRequests: (id: string, b: { due?: string | null; add?: { title: string; kind?: FileRequest["kind"]; match?: string }[]; usual?: boolean; fromInventory?: boolean; set?: Record<string, { title?: string; match?: string; kind?: FileRequest["kind"]; status?: FileRequest["status"] }>; remove?: string[] }) => req<Project>("POST", `/api/projects/${id}/requests`, b),
  scanRequests: (id: string) => req<Project & { came: number }>("POST", `/api/projects/${id}/requests/scan`),
  /** Opens a folder picker in the app; `folder: null` forgets the folder. */
  requestFolder: (id: string, folder?: string | null) => req<Project>("POST", `/api/projects/${id}/requests/folder`, folder === undefined ? {} : { folder }),
  openRequestFolder: (id: string) => req<{ ok: true }>("POST", `/api/projects/${id}/requests/open`),
  setAccounts: (id: string, accounts: Account[]) => req<Project>("POST", `/api/projects/${id}/accounts`, { accounts }),
  /** Reads the live domain's SSL certificate and domain expiry now. */
  checkRenewals: (id: string) => req<Project>("POST", `/api/projects/${id}/renewals`),
}
/** Every invoice for the accountant, as a CSV: for a year, or one project. */
export const invoicesCsvUrl = (q: { year?: string; project?: string }) => "/api/invoices.csv?" + new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
export const invoiceUrl = (id: string, invId: string, html = false) => `/api/projects/${id}/invoices/${invId}${html ? "?format=html" : ""}`
/** "$2,400.00", "1,250.50 EUR". */
export const fmtMoney = (n: number, c: Currency) => `${c.before || ""}${(Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${c.after ? " " + c.after : ""}`
export const timeCsvUrl = (q: { from?: string; to?: string; project?: string | null }) => "/api/time.csv?" + new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
// Screenshots are versioned by capture time so a retake always shows the new image.
export const shotUrl = (run: Pick<Run, "id" | "shotsAt" | "crawledAt">, pid: string) => `/api/runs/${run.id}/shot/${pid}?v=${run.shotsAt || run.crawledAt || 0}`
export const faviconUrl = (id: string) => `/api/runs/${id}/favicon`
export const exportUrl = (id: string, mode: Mode, download = false) => `/api/runs/${id}/export/${mode}${download ? "?download" : ""}`
export const proofUrl = (id: string, stored: string) => `/api/projects/${id}/files/${encodeURIComponent(stored)}`
export const seoCsvUrl = (id: string) => `/api/runs/${id}/seo/export.csv`
