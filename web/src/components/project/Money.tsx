import * as React from "react"
import { cn } from "cn"
import { Check, Download, MoreHorizontal, Pencil, Plus, Receipt, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { makeInvoice } from "@/components/project/InvoiceDialog"
import { Invoices } from "@/components/project/Invoices"
import { PlayButton } from "@/components/time/TimeBits"
import { useTimer } from "@/hooks/useTimer"
import { api, fmtMoney, invoicesCsvUrl, type Extra, type Payment, type Project } from "@/lib/api"
import { dayOf, fmtDay } from "@/lib/project"
import { clockOf, fmtMins } from "@/lib/time"
import { go, routes } from "@/lib/router"

const STATES: [Extra["status"], string][] = [["asked", "Asked"], ["quoted", "Quoted"], ["approved", "Approved"], ["done", "Done"], ["declined", "Not doing"]]

/**
 * Money for a project in one place: what's been paid and what's waiting, the payments (a deposit and one per
 * sign-off), extra requests so scope creep gets billed, the invoices, and the hours.
 */
export function MoneyTab({ p, setP }: { p: Project; setP: (x: Project) => void }) {
  const m = p.money
  const act = async (f: () => Promise<Project>, msg?: string) => { try { setP(await f()); if (msg) toast(msg) } catch (e) { toast.error((e as Error).message) } }
  const free = p.phases.filter((ph) => !ph.payment)
  const perHour = p.paid && p.time.mins >= 60 && !p.paid.mixed ? fmtMoney(p.paid.amount / (p.time.mins / 60), p.paid.currency).replace(/\.\d\d(?=\D*$)/, "") : null
  return (
    <div className="grid gap-9 px-12 pt-6 pb-12">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <Tile label="Paid" value={m ? fmtMoney(m.paid, m.currency) : "None yet"} sub={m && m.planned ? `of ${fmtMoney(m.planned, m.currency)} in payments` : "Add the payments below"} />
        <Tile label="Waiting on payment" value={m ? fmtMoney(m.waiting, m.currency) : "None"} sub="invoiced, not paid yet" />
        <Tile label="Ready to invoice" value={m ? fmtMoney(m.toInvoice, m.currency) : "None"} sub="signed off, or the deposit" />
        <Tile label="Time" value={fmtMins(p.time.mins)} sub={perHour ? `${perHour} for each hour, from what’s paid` : `${fmtMins(p.time.billable)} billable`} />
      </div>

      <section className="grid">
        <div className="flex h-9 items-baseline gap-2 border-b"><h2 className="flex-1 text-[14px] font-medium">Payments</h2><span className="text-[13px] text-muted-foreground">a deposit, and one with each sign-off</span></div>
        {p.deposit && <PayLine p={p} id="deposit" pay={p.deposit} when={p.kickoff ? `Due at kickoff, ${fmtDay(p.kickoff)}` : "Due at kickoff"} ready setP={setP} />}
        {p.phases.filter((ph) => ph.payment).map((ph) => <PayLine key={ph.id} p={p} id={ph.id} pay={ph.payment!} when={ph.signoff ? `${ph.handoff.title}, signed off ${fmtDay(ph.signoff.date)}` : `With ${ph.handoff.title}${ph.due ? `, ${fmtDay(ph.due)}` : ""}`} ready={!!ph.signoff} setP={setP} />)}
        {!p.deposit && !p.phases.some((ph) => ph.payment) && <p className="py-3 text-[13.5px] text-muted-foreground">No payments yet. Add the deposit and the payment due with each sign-off, and Today reminds you to invoice each one when it’s due.</p>}
        <div className="flex flex-wrap items-center gap-2 pt-2.5">
          {!p.deposit && <Button size="sm" variant="outline" onClick={() => act(() => api.setPayment(p.id, "deposit", { label: "Deposit", amount: "" }))}><Plus />Add a deposit</Button>}
          {free.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}><Plus />Add a payment with a sign-off</DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {free.map((ph) => <DropdownMenuItem key={ph.id} onClick={() => act(() => api.setPayment(p.id, ph.id, { label: `${ph.name} sign-off`, amount: "" }))}>{ph.handoff.title}<span className="ml-auto text-xs text-muted-foreground">{ph.name}</span></DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </section>

      <Extras p={p} setP={setP} />

      {p.invoices.length > 0 && <Invoices p={p} onChange={setP} />}

      <section className="flex flex-wrap items-center gap-2 border-t pt-4 text-[13px]">
        <span className="flex-1 text-muted-foreground">{fmtMins(p.time.mins)} logged, {fmtMins(p.time.billable)} billable.</span>
        <Button size="sm" variant="ghost" onClick={() => go(routes.time(p.id))}>Open the Time page</Button>
        <Button size="sm" variant="outline" onClick={() => makeInvoice({ projectId: p.id, kind: "hours" })}><Receipt />Invoice hours</Button>
        <Button size="sm" variant="outline" nativeButton={false} render={<a href={invoicesCsvUrl({ project: p.id })} download />}><Download />Invoices CSV</Button>
      </section>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="grid content-start gap-0.5 border-l pl-4">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[22px] leading-tight font-medium tabular">{value}</span>
      {sub && <span className="truncate text-[12.5px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

/** One payment: what it's for, when it's due, and the next step (make the invoice, mark it paid). */
function PayLine({ p, id, pay, when, ready, setP }: { p: Project; id: string; pay: Payment; when: string; ready: boolean; setP: (x: Project) => void }) {
  const [editing, setEditing] = React.useState(!pay.amount)
  const [label, setLabel] = React.useState(pay.label), [amount, setAmount] = React.useState(pay.amount)
  const save = async (b: Parameters<typeof api.setPayment>[2]) => { try { setP(await api.setPayment(p.id, id, b)) } catch (e) { toast.error((e as Error).message) } }
  const inv = p.invoices.find((x) => x.phaseId === id) || null
  if (editing) return (
    <form onSubmit={(e) => { e.preventDefault(); save({ label, amount }); setEditing(false) }} className="grid min-h-12 grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-2 border-b border-border/60 py-1.5">
      <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} aria-label="What it’s for" className="h-8 text-[13px]" />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount, like $2,400" aria-label="Amount" className="h-8 text-[13px]" />
      <span className="flex gap-1"><Button size="sm" type="submit">Save</Button><Button size="sm" variant="ghost" type="button" onClick={() => (pay.amount ? setEditing(false) : save({ remove: true }))}>Cancel</Button></span>
    </form>
  )
  const late = !!pay.invoiced && !pay.paid && Date.now() - pay.invoiced >= 14 * 864e5
  const state = pay.paid ? `Paid ${fmtDay(dayOf(pay.paid))}` : pay.invoiced ? `${inv ? `Invoice ${inv.number} sent` : "Invoiced"} ${fmtDay(dayOf(pay.invoiced))}` : ready ? "Ready to invoice" : "Not due yet"
  return (
    <div className="group grid min-h-12 grid-cols-[minmax(0,1fr)_120px_190px_170px_28px] items-center gap-3 border-b border-border/60 py-1.5 text-[13.5px]">
      <span className="grid min-w-0"><span className="truncate">{pay.label}</span><span className="truncate text-[12px] text-muted-foreground">{when}</span></span>
      <span className="text-right tabular">{pay.amount}</span>
      <span className={cn("text-right text-[13px]", late ? "text-destructive" : pay.paid ? "text-muted-foreground" : "text-foreground/80")}>{state}</span>
      <span className="flex justify-end">
        {pay.paid ? null : pay.invoiced ? <Button size="sm" variant="outline" onClick={() => save({ paid: true })}><Check />Mark paid</Button>
          : ready ? <Button size="sm" variant="outline" onClick={() => makeInvoice({ projectId: p.id, kind: "milestone", phaseId: id })}><Receipt />Make the invoice</Button> : null}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Payment options" className="opacity-60 group-hover:opacity-100" />}><MoreHorizontal /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => { setLabel(pay.label); setAmount(pay.amount); setEditing(true) }}><Pencil />Edit</DropdownMenuItem>
          {!pay.invoiced && <DropdownMenuItem onClick={() => save({ invoiced: true })}><Check />Mark invoiced, invoice made elsewhere</DropdownMenuItem>}
          {pay.paid && <DropdownMenuItem onClick={() => save({ paid: false })}><Undo2 />Not paid after all</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => save({ remove: true })}><Trash2 />Remove the payment</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Extra requests: what the client asked for beyond the agreed work, quoted or timed, and billed. */
function Extras({ p, setP }: { p: Project; setP: (x: Project) => void }) {
  const [title, setTitle] = React.useState(""), [price, setPrice] = React.useState("")
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    try { setP(await api.addExtra(p.id, { title, price })); setTitle(""); setPrice("") } catch (err) { toast.error((err as Error).message) }
  }
  const open = p.extras.filter((x) => x.status !== "declined" && !x.invoiceId)
  const unbilled = open.filter((x) => x.status === "done" || x.status === "approved").length
  return (
    <section className="grid">
      <div className="flex h-9 items-baseline gap-2 border-b"><h2 className="flex-1 text-[14px] font-medium">Extra requests</h2><span className="text-[13px] text-muted-foreground">{p.extras.length ? `${p.extras.filter((x) => x.invoiceId).length} of ${p.extras.filter((x) => x.status !== "declined").length} billed${unbilled ? `, ${unbilled} ready to bill` : ""}` : "anything asked for beyond the agreed work"}</span></div>
      <form onSubmit={add} className="grid min-h-11 grid-cols-[minmax(0,1fr)_200px_auto] items-center gap-2 border-b border-border/60 py-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What they asked for, like “Add a careers page”" aria-label="What they asked for" className="h-8 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground" />
        <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price, or leave it for hours" aria-label="Price" className="h-8 text-[13px]" />
        <Button size="sm" type="submit" disabled={!title.trim()}><Plus />Add</Button>
      </form>
      {p.extras.map((x) => <ExtraRow key={x.id} p={p} x={x} setP={setP} />)}
      {!p.extras.length && <p className="py-3 text-[13.5px] text-muted-foreground">Log each “could you also…” here when it’s asked. Give it a price, or time it, and bill it when it’s done, so extra work doesn’t go unpaid.</p>}
    </section>
  )
}

function ExtraRow({ p, x, setP }: { p: Project; x: Extra; setP: (x: Project) => void }) {
  const { now, state } = useTimer()
  const t = state?.running
  const live = t && t.projectId === p.id && t.extraId === x.id ? t : null
  const [price, setPrice] = React.useState(x.price)
  const [title, setTitle] = React.useState(x.title)
  const save = async (b: Parameters<typeof api.setExtra>[2]) => { try { setP(await api.setExtra(p.id, x.id, b)) } catch (e) { toast.error((e as Error).message) } }
  const inv = x.invoiceId ? p.invoices.find((i) => i.id === x.invoiceId) : null
  const declined = x.status === "declined"
  return (
    <div className={cn("group grid min-h-12 grid-cols-[110px_minmax(0,1fr)_120px_96px_28px_150px_28px] items-center gap-3 border-b border-border/60 py-1.5 text-[13.5px]", declined && "text-muted-foreground")}>
      <select value={x.status} onChange={(e) => save({ status: e.target.value as Extra["status"] })} aria-label="Where it stands" className="h-8 rounded-md border border-transparent bg-transparent px-1 text-[13px] hover:border-input">
        {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span className="grid min-w-0"><input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== x.title ? save({ title }) : setTitle(x.title)} aria-label="What they asked for" className={cn("-ml-1.5 h-7 min-w-0 rounded-md bg-transparent px-1.5 outline-none hover:bg-muted/60 focus:bg-muted/60", declined && "line-through")} /><span className="text-[12px] text-muted-foreground">Asked {fmtDay(x.asked)}</span></span>
      <input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => price !== x.price && save({ price })} placeholder="No price" aria-label={`Price for ${x.title}`} className="-mr-1.5 h-8 min-w-0 rounded-md bg-transparent px-1.5 text-right tabular outline-none placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:bg-muted/60" />
      <span className={cn("text-right text-[13px] tabular", live ? "text-brand-ink" : "text-muted-foreground")}>{live ? clockOf(live, now) : x.mins ? fmtMins(x.mins) : ""}</span>
      {!declined && !inv ? <PlayButton running={live} start={{ projectId: p.id, extraId: x.id, title: x.title }} label="Start a timer on this request" /> : <span />}
      <span className="flex justify-end">
        {inv ? <span className="text-[13px] text-muted-foreground">On invoice {inv.number}</span>
          : declined ? null
          : <Button size="sm" variant={x.status === "done" ? "outline" : "ghost"} onClick={() => makeInvoice({ projectId: p.id, kind: "extra", extraId: x.id })} disabled={!x.price && !x.mins}><Receipt />Invoice it</Button>}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Request options" className="opacity-60 group-hover:opacity-100" />}><MoreHorizontal /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={async () => { try { setP(await api.removeExtra(p.id, x.id)); toast("Removed the request") } catch (e) { toast.error((e as Error).message) } }}><Trash2 />Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
