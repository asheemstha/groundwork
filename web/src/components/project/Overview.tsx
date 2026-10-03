import * as React from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { PlayButton, useRunningOn } from "@/components/time/TimeBits"
import { fmtMoney, type PItem, type Project } from "@/lib/api"
import { addDaysTo, dueLabel, fmtDay, hostOfUrl, today } from "@/lib/project"
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
 * The Overview: where the project stands in a sentence, what's next for you, what the client owes, and the time,
 * money and site in one line each.
 */
export function OverviewTab({ p, setItem }: { p: Project; setItem: (id: string, b: { status: "todo" | "done" }) => void }) {
  const all = itemsOf(p)
  // Yours, late first, then by date; items with no date last.
  const mine = all.filter((x) => x.who === "us" && x.status === "todo").sort((a, b) => Number(b.late) - Number(a.late) || (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 5)
  const theirs = [...p.client.late, ...p.client.soon, ...p.client.notAsked.filter((x) => !x.askBy || x.askBy <= today())]
  const m = p.money
  const last = p.tools.launch
  const fails = last ? Object.values(last.checks).filter((c) => c && !c.ok).length : 0
  return (
    <div className="grid gap-8 px-12 pt-2 pb-12">
      <section className="grid">
        <h2 className="mb-1.5 text-[15px] font-medium">Next for you</h2>
        {mine.length ? mine.map((x) => <NextItem key={x.id} p={p} x={x} onDone={() => setItem(x.id, { status: "done" })} />)
          : <p className="py-2 text-[14px] text-muted-foreground">{p.current ? "Nothing of yours is open in this phase." : "Nothing of yours is open."} <button onClick={() => go(routes.project(p.id, "checklist"))} className="underline underline-offset-2 hover:text-foreground">Open the checklist</button></p>}
      </section>

      <section className="grid">
        <h2 className="mb-1.5 flex items-baseline gap-2 text-[15px] font-medium">
          <span className="flex-1">Waiting on {first(p)}</span>
          {theirs.length > 0 && <Button size="xs" variant="outline" onClick={() => go(routes.project(p.id, "client"))}>{theirs.length === 1 ? "Ask for it" : `Ask for all ${theirs.length}`}</Button>}
        </h2>
        {theirs.length ? theirs.slice(0, 5).map((x) => (
          <button key={x.id} onClick={() => go(routes.project(p.id, "client"))} className="grid h-[42px] grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-1 text-left text-[14px] hover:bg-muted/30">
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="7.75" fill="none" className="stroke-client" strokeWidth="1.5" strokeDasharray={x.asked ? undefined : "2.5 2.5"} /></svg>
            <span className="truncate">{x.title}</span>
            <span className={cn("text-[13px]", x.late ? "text-destructive" : "text-muted-foreground")}>{x.late ? dueLabel(x) : x.asked ? `Asked ${new Date(x.asked).toLocaleDateString([], { month: "short", day: "numeric" })}` : x.due ? `Due ${fmtDay(x.due)}` : "Not asked yet"}</span>
          </button>
        )) : <p className="py-2 text-[14px] text-muted-foreground">{first(p)[0].toUpperCase() + first(p).slice(1)} doesn’t owe you anything right now.</p>}
        {theirs.length > 5 && <button onClick={() => go(routes.project(p.id, "client"))} className="mt-1 w-fit text-[13px] text-muted-foreground hover:text-foreground">{theirs.length - 5} more</button>}
      </section>

      <div className={cn("grid gap-6 border-t pt-4 text-[13px]", p.website ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <Stat label="Time" onClick={() => go(routes.time(p.id))}>{p.repeat && p.time.month != null ? `${fmtMins(p.time.month)}${p.planHours ? ` of ${p.planHours}h` : ""} this month` : p.time.mins ? `${fmtMins(p.time.mins)} logged` : "None logged yet"}</Stat>
        <Stat label="Money" onClick={() => go(routes.project(p.id, "money"))}>{!m ? "No payments set yet" : m.toInvoice > 0 ? `${money(m.toInvoice, m.currency)} ready to invoice` : m.waiting > 0 ? `${money(m.waiting, m.currency)} waiting on payment` : m.planned ? `${money(m.paid, m.currency)} of ${money(m.planned, m.currency)} paid` : "No payments set yet"}</Stat>
        {p.website && <Stat label="Site" onClick={() => go(routes.project(p.id, "site"))}>{p.tools.launchRunning ? "Checking now" : last ? (fails ? `${plural(fails, "check needs", "checks need")} fixing` : "Every check passed") : p.tools.oldScan ? `Old site scanned, ${plural(p.tools.oldScan.urls, "address", "addresses")}` : p.tools.scan ? `Scanned, ${plural(p.tools.scan.urls, "address", "addresses")}` : "Not checked yet"}</Stat>}
      </div>

    </div>
  )
}

function Stat({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="grid gap-0.5 text-left">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-[15px] hover:underline">{children}</span>
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

/** The phases in a row, the current one in bold, and the launch date at the end. */
export function PhaseStrip({ p }: { p: Project }) {
  // The launch date goes beside the phase called Launch, when there is one.
  const launchPhase = p.repeat ? null : p.phases.find((ph) => /^launch/i.test(ph.name)) || null
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
      {p.phases.map((ph, i) => (
        <React.Fragment key={ph.id}>
          {i > 0 && <span className={cn("h-0.5 w-6 rounded-full", ph.state === "upcoming" ? "bg-border" : "bg-muted-foreground/40")} />}
          <span className={cn(ph.state === "current" && "font-medium text-foreground")}>{ph.name}{ph === launchPhase && p.launch && <span className="text-muted-foreground">{p.launched ? `, live ${fmtDay(p.launched.on)}` : `, ${fmtDay(p.launch)}`}</span>}</span>
        </React.Fragment>
      ))}
      {p.launch && !p.repeat && !launchPhase && <><span className="h-0.5 w-6 rounded-full bg-border" /><span>{p.launched ? `Live ${fmtDay(p.launched.on)}` : `${p.labels?.launch || "Launch"} ${fmtDay(p.launch)}`}</span></>}
      {p.sites.live && <a href={p.sites.live} target="_blank" rel="noreferrer" className="ml-2 hover:text-foreground hover:underline">{hostOfUrl(p.sites.live)}</a>}
    </div>
  )
}
