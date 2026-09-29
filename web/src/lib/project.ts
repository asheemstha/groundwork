// Helpers for projects: due dates, due-rule labels and filling in message templates.
import type { DueRule, LaunchCheckId, MessageTemplate, PItem, Project } from "@/lib/api"

const parse = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(y!, m! - 1, day!) }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const today = () => iso(new Date())
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)

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

export const VARIABLES = ["client first name", "client name", "project", "launch date", "phase", "items", "your name"] as const

/** Fill a message template for a project. `items` are the client items the message lists. */
export function renderMessage(t: Pick<MessageTemplate, "subject" | "body">, p: Project | null, yourName: string, items: PItem[]) {
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
  canonicals: "Canonicals point to the live domain",
  legal: "Legal pages linked",
  https: "SSL and redirects",
}
