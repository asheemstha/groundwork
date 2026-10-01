// Helpers for projects: due dates, due-rule labels and filling in message templates.
import type { AppStatus, DueRule, LaunchCheckId, MessageTemplate, PItem, Project, SiteKey } from "@/lib/api"

const parse = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(y!, m! - 1, day!) }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const today = () => iso(new Date())
/** A time as a local YYYY-MM-DD day. (toISOString gives the UTC day, which is a day off in the evening.) */
export const dayOf = (t: number | Date) => iso(new Date(t))
const DAY = 864e5
/** How long the client has had an item: "asked Sep 12, 17 days ago". Counted in calendar days. */
export const waited = (x: Pick<PItem, "asked">) => {
  if (!x.asked) return "not asked yet"
  const days = Math.max(0, Math.round((parse(today()).getTime() - parse(dayOf(x.asked)).getTime()) / DAY))
  return `asked ${fmtDay(dayOf(x.asked))}, ${days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`}`
}
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
/** A YYYY-MM-DD day moved by `n` days. */
export const addDaysTo = (d: string, n: number) => { const x = parse(d); x.setDate(x.getDate() + n); return iso(x) }

/** "Oct 6", or "Tue, Oct 6" with the weekday. */
export const fmtDay = (d?: string | null, weekday = false) => (d ? parse(d).toLocaleDateString([], { ...(weekday ? { weekday: "short" } : {}), month: "short", day: "numeric" }) : "")
export const fmtLong = (d?: string | null) => (d ? parse(d).toLocaleDateString([], { month: "long", day: "numeric" }) : "")

/** Short due label for a list: "Today", "Thu" this week, "Oct 6" later, "2 days late" when overdue. */
export function dueLabel(item: Pick<PItem, "due" | "late" | "status">) {
  if (!item.due) return ""
  const n = daysBetween(today(), item.due)
  if (item.status === "todo" && n < 0) return `${-n} day${n === -1 ? "" : "s"} late`
  if (n === 0) return "Today"
  if (n === 1) return "Tomorrow"
  if (n > 1 && n < 7) return parse(item.due).toLocaleDateString([], { weekday: "short" })
  return fmtDay(item.due)
}

export function ruleLabel(r: DueRule | null) {
  if (!r) return "Phase date"
  const n = Math.abs(r.days), unit = n === 1 ? "day" : "days", what = r.from
  if (r.days === 0) return what === "launch" ? "Launch day" : "Kickoff day"
  return `${n} ${unit} ${r.days < 0 ? "before" : "after"} ${what}`
}

export const VARIABLES = ["client first name", "client name", "project", "launch date", "phase", "items", "your name", "status", "done this week", "up next", "waiting on you", "invoice", "amount"] as const

/** Fill a message template for a project. `items` are the client items the message lists. */
export function renderMessage(t: Pick<MessageTemplate, "subject" | "body">, p: Project | null, yourName: string, items: PItem[], extra: Record<string, string> = {}) {
  const first = (p?.clientName || "").split(/\s+/)[0] || "there"
  const cur = p?.phases.find((ph) => ph.id === p.current)
  const list = items.length
    ? items.map((x) => `• ${x.title}${x.late && x.due ? ` (it was due ${fmtDay(x.due)})` : x.due && x.asked ? `, by ${fmtDay(x.due, true)}` : ""}`).join("\n")
    : "• [Nothing is waiting right now]"
  const vals: Record<string, string> = {
    "client first name": first,
    "client name": p?.clientName || first,
    project: p?.name || "[Project]",
    "launch date": p?.launch ? fmtLong(p.launch) : "[launch date]",
    phase: cur?.name || "[phase]",
    items: list,
    "your name": yourName || "[Your name]",
    ...extra,
  }
  const fill = (s: string) => s.replace(/\{([a-z ]+)\}/g, (m, k: string) => vals[k] ?? m)
  return { subject: fill(t.subject || ""), body: fill(t.body || "") }
}

/** What each launch check covers, in the order the report lists them. */
export const LAUNCH_CHECKS: Record<LaunchCheckId, string> = {
  indexing: "Google can index the site",
  placeholders: "No placeholder text or dummy links",
  links: "Links work",
  seo: "Titles, descriptions, H1s, alt text, OG images, favicon",
  a11y: "Accessibility basics (WCAG 2.2 AA)",
  speed: "Speed on a phone (Core Web Vitals)",
  tracking: "Tracking: tags, cookie consent and ad clicks",
  canonicals: "Canonicals point to the live domain",
  legal: "Legal pages linked",
  https: "SSL and redirects",
}

/** Whose subscription the AI plans use, from what's signed in: "Claude", "ChatGPT" or "Claude or ChatGPT". */
export const subName = (s: AppStatus | null) => { const c = !!s?.engines.claude.loggedIn, x = !!s?.engines.codex.loggedIn; return c && !x ? "Claude" : x && !c ? "ChatGPT" : "Claude or ChatGPT" }

/** A project's three websites: the one being replaced, the new one on staging, and the live domain. */
export const SITE_NAME: Record<SiteKey, string> = { old: "Old site", staging: "Staging", live: "Live site" }
export const SITE_KEYS: SiteKey[] = ["old", "staging", "live"]
export const hostOfUrl = (u?: string | null) => { if (!u) return ""; try { return new URL(u).hostname.replace(/^www\./, "") } catch { return u } }

/**
 * The weekly client update, from the checklist: what got done since the last update (or the last 7 days), what's
 * next for us, and what's waiting on the client. It fills the Weekly update template's {status}, {done this week},
 * {up next} and {waiting on you}.
 */
export function weeklyUpdate(p: Project) {
  const since = p.lastUpdate || Date.now() - 7 * 864e5
  const all = p.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items])
  const done = all.filter((x) => x.status === "done" && (x.at || 0) >= since)
  const signed = p.phases.filter((ph) => ph.signoff && ph.signoff.at >= since)
  const cur = p.phases.find((ph) => ph.id === p.current)
  const soon = addDaysIso(today(), 14)
  const next = all.filter((x) => x.status === "todo" && x.who === "us" && (x.phaseId === cur?.id || (!!x.due && x.due <= soon))).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1).slice(0, 6)
  const waiting = [...p.client.late, ...p.client.soon, ...p.client.notAsked.filter((x) => !x.askBy || x.askBy <= today())]
  const line = (x: PItem) => `• ${x.title}${x.due && x.who === "client" ? ` (by ${fmtDay(x.due)})` : ""}`
  const behind = p.behind.days >= 7 && !!cur
  const status = !cur ? "Every phase is signed off." : behind ? `We’re working through ${cur.name}, about ${p.behind.days} days behind the plan${p.launch ? `, and still aiming for launch on ${fmtLong(p.launch)}` : ""}.` : p.client.late.length ? `We’re in ${cur.name}${p.launch ? ` and on course for launch on ${fmtLong(p.launch)}` : ""}, as long as the items below arrive soon.` : `We’re in ${cur.name}${p.launch ? ` and on track for launch on ${fmtLong(p.launch)}` : ""}.`
  return {
    since,
    counts: { done: done.length + signed.length, next: next.length, waiting: waiting.length },
    extra: {
      status,
      "done this week": [...signed.map((ph) => `• ${ph.handoff.title} (signed off)`), ...done.map((x) => `• ${x.who === "client" ? "Received: " : ""}${x.title}`)].join("\n") || "• Nothing new to show since the last update.",
      "up next": next.map(line).join("\n") || "• Nothing scheduled for the next two weeks.",
      "waiting on you": waiting.map(line).join("\n") || "• Nothing right now. Thank you!",
    } as Record<string, string>,
  }
}
const addDaysIso = (d: string, n: number) => { const x = parse(d); x.setDate(x.getDate() + n); return iso(x) }
