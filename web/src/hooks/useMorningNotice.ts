import * as React from "react"
import { api, type HomeData } from "@/lib/api"
import { today } from "@/lib/project"
import { go, routes } from "@/lib/router"
import { store } from "@/lib/store"

/** How many messages Home lists: requests, reminders, weekly updates, invoices and payment reminders. */
export const messageCount = (d: HomeData) => d.messages.reduce((n, m) => n + (m.ask ? 1 : 0) + (m.remind ? 1 : 0) + (m.update ? 1 : 0) + m.invoices.length + m.unpaid.length, 0)

/** The morning note in one line, or null when there's nothing to do today. */
export function morningLine(d: HomeData) {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  const msgs = messageCount(d), s = d.stats
  const bits = [
    s.overdue ? n(s.overdue, "of your items is late", "of your items are late") : "",
    s.dueToday ? n(s.dueToday, "item is due today", "items are due today") : "",
    s.late ? n(s.late, "client item is late", "client items are late") : "",
    s.watchIssues ? n(s.watchIssues, "after-launch check needs a look", "after-launch checks need a look") : "",
    msgs ? n(msgs, "message to send", "messages to send") : "",
    s.signoffs ? n(s.signoffs, "sign-off to record", "sign-offs to record") : "",
  ].filter(Boolean)
  if (!bits.length) return null
  const t = bits.join(", ")
  return t[0]!.toUpperCase() + t.slice(1) + "."
}

/** With notifications on, one Mac notification a day, from 9am, with what's due and the messages to send. */
export function useMorningNotice(on: boolean | undefined) {
  React.useEffect(() => {
    if (!on || typeof Notification === "undefined") return
    const check = async () => {
      if (new Date().getHours() < 9 || store.get("notifiedOn", "") === today()) return
      const d = await api.home().catch(() => null)
      if (!d) return
      store.set("notifiedOn", today())
      const body = morningLine(d)
      if (!body) return
      if (Notification.permission === "default") await Notification.requestPermission().catch(() => {})
      if (Notification.permission !== "granted") return
      const n = new Notification("Today in Groundwork", { body })
      n.onclick = () => { window.focus(); go(routes.home) }
    }
    check()
    const t = setInterval(check, 15 * 60e3)
    return () => clearInterval(t)
  }, [on])
}
