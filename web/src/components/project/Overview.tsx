import * as React from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { PlayButton, useRunningOn } from "@/components/time/TimeBits"
import { fmtMoney, type PItem, type Project } from "@/lib/api"
import { Globe, Receipt, Timer } from "lucide-react"
import { SITE_KEYS, addDaysTo, dayOf, dueLabel, fmtDay, today } from "@/lib/project"
import { fmtMins } from "@/lib/time"
import { go, routes } from "@/lib/router"

const first = (p: Project) => (p.clientName ? p.clientName.split(" ")[0] : "the client")
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
// Whole amounts without the cents: "$4,200", "$1,250.50".
const money = (n: number, c: Parameters<typeof fmtMoney>[1]) => fmtMoney(n, c).replace(/\.00(?=\D*$)/, "")
const itemsOf = (p: Project) => p.phases.flatMap((ph) => [...ph.groups.flatMap((g) => g.items), ...ph.handoff.items])

/** One or two sentences on where the project stands: the phase against its sign-off date, and what the client owes. */
export function standLine(p: Project) {
  const cur = p.phases.find((ph) => ph.id === p.current)
  const out: string[] = []
  if (p.closed) return `Closed ${new Date(p.closed.at).toLocaleDateString([], { month: "long", day: "numeric" })}. It’s out of Today, and its site isn’t checked any more.`
  if (p.launched && !p.repeat) {
    // After launch: the day it went live and the next after-launch check.
    const next = [3, 7, 30].map((n) => ({ n, d: addDaysTo(p.launched!.on, n) })).find((x) => x.d >= today())
    out.push(`Launched ${new Date(p.launched.on + "T00:00").toLocaleDateString([], { month: "long", day: "numeric" })}.${next ? ` The day ${next.n} check is ${next.d === today() ? "today" : `on ${fmtDay(next.d)}`}.` : ""}`)
  } else if (p.repeat) out.push(cur ? `This month’s care: ${cur.done} of ${cur.total} done.` : "This month’s care is done.")
  else if (p.kickoff && p.kickoff > today()) out.push(`Starts ${fmtDay(p.kickoff, true)}.`)
  else if (!cur) out.push("Every phase is signed off.")
  else if (cur.ready) out.push(`${cur.name} is ready to sign off.`)
  else if (p.behind.days > 0) out.push(`${cur.name} is ${plural(p.behind.days, "day", "days")} behind${cur.due ? `, with sign-off due ${fmtDay(cur.due)}` : ""}.`)
  else {
    // The phase is on time, but items left open in an earlier one can still be late.
    const ours = p.behind.ours
    out.push(`${cur.name} is ${cur.due ? `on track for sign-off on ${new Date(cur.due + "T00:00").toLocaleDateString([], { month: "long", day: "numeric" })}` : "under way"}${ours ? `, but ${plural(ours, "of your items is", "of your items are")} late from before` : ""}.`)
  }
  const late = p.client.late.length, owes = late + p.client.soon.length
  if (late) out.push(`${first(p)[0].toUpperCase() + first(p).slice(1)} is late with ${plural(late, "thing", "things")}.`)
  else if (owes) out.push(`Waiting on ${first(p)} for ${plural(owes, "thing", "things")}.`)
  return out.join(" ")
}

/**
 * The Overview, in two columns like Linear's project page. On the left, the phases as a track, what's next for you and
 * what the client owes; on the right, the project's details, then its money, time and site, each a click from its tab.
 */
export function OverviewTab({ p, setItem, details }: { p: Project; setItem: (id: string, b: { status: "todo" | "done" }) => void; details: React.ReactNode }) {
  const all = itemsOf(p)
  // Yours, late first, then by date; items with no date last.
  const mine = all.filter((x) => x.who === "us" && x.status === "todo").sort((a, b) => Number(b.late) - Number(a.late) || (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 5)
  const theirs = [...p.client.late, ...p.client.soon, ...p.client.notAsked.filter((x) => !x.askBy || x.askBy <= today())]
  const m = p.money
  const last = p.tools.launch
  const fails = last ? Object.values(last.checks).filter((c) => c && !c.ok).length : 0
  const cur = p.phases.find((ph) => ph.id === p.current)
  return (
    <div className="grid items-start gap-8 px-12 pt-5 pb-12 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid min-w-0 gap-8">
      {p.phases.length > 1 && <PhaseTrack p={p} />}
      <section className="grid">
        <h2 className="mb-1 flex items-baseline gap-2 text-[15px] font-medium"><span className="flex-1">Next for you</span>{cur && <span className="text-[12.5px] font-normal text-muted-foreground tabular">{cur.name}, {cur.done} of {cur.total} done</span>}</h2>
        {mine.length ? mine.map((x) => <NextItem key={x.id} p={p} x={x} onDone={() => setItem(x.id, { status: "done" })} />)
          : <p className="py-2 text-[14px] text-muted-foreground">{p.current ? "Nothing of yours is open in this phase." : "Nothing of yours is open."} <button onClick={() => go(routes.project(p.id, "checklist"))} className="underline underline-offset-2 hover:text-foreground">Open the checklist</button></p>}
      </section>

      <section className="grid">
        <h2 className="mb-1.5 flex items-baseline gap-2 text-[15px] font-medium">
          <span className="flex-1">Waiting on {first(p)}</span>
          {theirs.length > 0 && <Button size="xs" variant="outline" onClick={() => go(routes.project(p.id, "client"))}>{theirs.length === 1 ? "Ask for it" : `Ask for all ${theirs.length}`}</Button>}
        </h2>
        {theirs.length ? theirs.slice(0, 5).map((x) => (
          <button key={x.id} onClick={() => go(routes.project(p.id, "client"))} className="grid h-[42px] grid-cols-[18px_minmax(0,1fr)_auto_32px] items-center gap-3 border-b border-border/60 px-1 text-left text-[14px] hover:bg-muted/30">
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="7.75" fill="none" className="stroke-client" strokeWidth="1.5" strokeDasharray={x.asked ? undefined : "2.5 2.5"} /></svg>
            <span className="truncate">{x.title}</span>
            <span className={cn("text-[13px]", x.late ? "text-destructive" : "text-muted-foreground")}>{x.late ? dueLabel(x) : x.asked ? `Asked ${new Date(x.asked).toLocaleDateString([], { month: "short", day: "numeric" })}` : x.due ? `Due ${fmtDay(x.due)}` : "Not asked yet"}</span>
            <span />
          </button>
        )) : <p className="py-2 text-[14px] text-muted-foreground">{first(p)[0].toUpperCase() + first(p).slice(1)} doesn’t owe you anything right now.</p>}
        {theirs.length > 5 && <button onClick={() => go(routes.project(p.id, "client"))} className="mt-1 w-fit text-[13px] text-muted-foreground hover:text-foreground">{theirs.length - 5} more</button>}
      </section>

      </div>

      <aside className="grid gap-4">
        <section className="rounded-xl border bg-card px-3.5 pt-3 pb-1.5">
          <h2 className="pb-1 text-[12.5px] font-medium text-muted-foreground">Details</h2>
          {details}
        </section>
        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="px-3.5 pt-3 pb-1.5 text-[12.5px] font-medium text-muted-foreground">At a glance</h2>
          <Glance icon={<Receipt />} label="Money" onClick={() => go(routes.project(p.id, "money"))}
            value={!m || !m.planned && !m.toInvoice && !m.waiting ? "No payments yet" : m.toInvoice > 0 ? money(m.toInvoice, m.currency) : m.waiting > 0 ? money(m.waiting, m.currency) : `${money(m.paid, m.currency)} paid`}
            sub={!m || !m.planned && !m.toInvoice && !m.waiting ? "Set a deposit and a payment with each sign-off" : m.toInvoice > 0 ? `ready to invoice${m.waiting > 0 ? `, ${money(m.waiting, m.currency)} waiting on payment` : ""}` : m.waiting > 0 ? "waiting on payment" : `of ${money(m.planned, m.currency)} in payments`} />
          <Glance icon={<Timer />} label="Time" onClick={() => go(routes.time(p.id))}
            value={p.repeat && p.time.month != null ? `${fmtMins(p.time.month)}${p.planHours ? ` of ${p.planHours}h` : ""}` : p.time.mins ? fmtMins(p.time.mins) : "None yet"}
            sub={p.repeat && p.time.month != null ? "this month" : p.time.mins ? (p.time.billable === p.time.mins ? "logged, all billable" : `logged, ${fmtMins(p.time.billable)} billable`) : "Start a timer from any item"} />
          {p.website && <Glance icon={<Globe />} label="Site" onClick={() => go(routes.project(p.id, "site"))}
            value={p.tools.launchRunning ? "Checking now" : last ? (fails ? plural(fails, "check to fix", "checks to fix") : "Every check passed") : p.tools.oldScan ? "Old site scanned" : p.tools.scan ? "Scanned" : "Not checked yet"}
            sub={last ? `Checked ${fmtDay(dayOf(last.at))}` : p.tools.oldScan ? plural(p.tools.oldScan.urls, "address saved", "addresses saved") : p.tools.scan ? plural(p.tools.scan.urls, "address", "addresses") : SITE_KEYS.some((k) => p.sites[k]) ? "Scan it from the Site tab" : "Add the addresses to scan the old site"} />}
        </section>
      </aside>
    </div>
  )
}

/** A line in "At a glance": what it is, the figure, and a note under it. Opens its tab. */
function Glance({ icon, label, value, sub, onClick }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid w-full gap-0.5 border-t px-3.5 py-2.5 text-left hover:bg-muted/40">
      <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground [&_svg]:size-3.5">{icon}{label}</span>
      <span className="text-[15px] font-medium tabular">{value}</span>
      <span className="text-[12.5px] text-muted-foreground">{sub}</span>
    </button>
  )
}

function NextItem({ p, x, onDone }: { p: Project; x: PItem; onDone: () => void }) {
  const running = useRunningOn({ projectId: p.id, itemId: x.id })
  return (
    <div className="group grid h-[46px] grid-cols-[18px_minmax(0,1fr)_96px_32px] items-center gap-3 border-b border-border/60 px-1">
      <button onClick={onDone} aria-label={`Mark ${x.title} done`} className="size-4 rounded-full border-[1.5px] border-input hover:border-foreground/50" />
      <button onClick={() => go(routes.item(p.id, x.id))} className="truncate text-left text-[14px] hover:underline">{x.title}</button>
      <span className={cn("text-right text-[13px]", x.late ? "text-destructive" : x.due === today() ? "text-foreground" : "text-muted-foreground")}>{dueLabel(x)}</span>
      <PlayButton running={running} start={{ projectId: p.id, itemId: x.id, title: x.title }} className={running ? "" : "opacity-60 group-hover:opacity-100"} label="Start a timer on this item" />
    </div>
  )
}

/** The phases as a track: a bar for each (green once signed off, orange for how far the current one is), with its
 *  name and its sign-off date under it. Each opens the checklist at that phase. */
export function PhaseTrack({ p }: { p: Project }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${p.phases.length}, minmax(0, 1fr))` }}>
      {p.phases.map((ph) => {
        const frac = ph.state === "signed" ? 1 : ph.total ? ph.done / ph.total : 0
        const launch = !p.repeat && /^launch/i.test(ph.name)
        return (
          <button key={ph.id} onClick={() => go(routes.phase(p.id, ph.id))} className="group grid min-w-0 gap-1.5 text-left">
            <span className="h-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", ph.state === "signed" ? "bg-done" : "bg-brand")} style={{ width: `${frac * 100}%` }} /></span>
            <span className={cn("truncate text-[13px] group-hover:underline", ph.state === "current" ? "font-medium" : "text-muted-foreground")}>{ph.name}</span>
            <span className="truncate text-[12px] text-muted-foreground tabular">{ph.signoff ? `Signed off ${fmtDay(ph.signoff.date)}` : launch && p.launched ? `Live ${fmtDay(p.launched.on)}` : launch && p.launch ? fmtDay(p.launch) : ph.due ? (ph.state === "current" ? `Sign-off ${fmtDay(ph.due)}` : fmtDay(ph.due)) : ""}</span>
          </button>
        )
      })}
    </div>
  )
}
