// Helpers for time: lengths in minutes, the running timer's clock, and the days in a week or month.
import type { RunningTimer } from "@/lib/api"
import { dayOf } from "@/lib/project"

/** "45m", "3h", "1h 05m". */
export const fmtMins = (m?: number | null, zero = "0m") => {
  m = Math.max(0, Math.round(m || 0))
  if (!m) return zero
  const h = Math.floor(m / 60), r = m % 60
  return h ? (r ? `${h}h ${String(r).padStart(2, "0")}m` : `${h}h`) : `${r}m`
}
/** Whole minutes the timer has run. */
export const runMins = (r: Pick<RunningTimer, "start">, now = Date.now()) => Math.max(0, Math.floor((now - r.start) / 60e3))
/** The timer's clock, hours and minutes: "0:42", "2:05". */
export const clockOf = (r: Pick<RunningTimer, "start">, now = Date.now()) => { const m = runMins(r, now); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` }
/** "9:10 AM" */
export const timeOf = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

/** A length typed by hand, as the server reads it: "1h 30m", "1.5", "90m", "1:30". A bare number is hours. */
export function parseDur(s: string) {
  s = s.trim().toLowerCase().replace(",", ".")
  if (!s) return null
  let m = s.match(/^(\d+):(\d{1,2})$/)
  if (m) return +m[1]! * 60 + +m[2]!
  m = s.match(/^(\d+(?:\.\d+)?)$/)
  if (m) return Math.round(+m[1]! * 60)
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?$/)
  if (m && (m[1] || m[2])) return Math.round((+(m[1] || 0)) * 60 + (+(m[2] || 0)))
  return null
}

const parse = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(y!, m! - 1, day!) }
export const addDays = (d: string, n: number) => { const x = parse(d); x.setDate(x.getDate() + n); return dayOf(x) }
export type Period = "day" | "week" | "month"
/** The days a period covers, weeks starting on Monday as on most timesheets. */
export function rangeOf(period: Period, at: string) {
  if (period === "day") return { from: at, to: at }
  const d = parse(at)
  if (period === "week") { const from = addDays(at, -((d.getDay() + 6) % 7)); return { from, to: addDays(from, 6) } }
  return { from: dayOf(new Date(d.getFullYear(), d.getMonth(), 1)), to: dayOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}
/** The same period before or after. */
export function shiftPeriod(period: Period, at: string, n: number) {
  if (period === "day") return addDays(at, n)
  if (period === "week") return addDays(at, 7 * n)
  const d = parse(at)
  return dayOf(new Date(d.getFullYear(), d.getMonth() + n, 1))
}
export const longDay = (d: string) => parse(d).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
export const shortDay = (d: string) => parse(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
/** "September 28 to October 4", "October 2026", "Thursday, October 1". */
export function periodLabel(period: Period, at: string) {
  const r = rangeOf(period, at)
  if (period === "day") return longDay(at)
  if (period === "month") return parse(at).toLocaleDateString([], { month: "long", year: "numeric" })
  const f = (d: string) => parse(d).toLocaleDateString([], { month: "long", day: "numeric" })
  return `${f(r.from)} to ${f(r.to)}`
}
