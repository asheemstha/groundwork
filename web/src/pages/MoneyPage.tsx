import * as React from "react"
import { cn } from "cn"
import { CalendarClock, Check, CircleCheck, Download, Hourglass, Receipt } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SiteIcon, TopBar } from "@/components/common/bits"
import { makeInvoice } from "@/components/project/InvoiceDialog"
import { useApp } from "@/hooks/useApp"
import { useTimeChanged } from "@/hooks/useTimer"
import { api, invoicesCsvUrl, invoiceUrl, type MoneyAll, type MoneyRow } from "@/lib/api"
import { dayOf, fmtDay, today } from "@/lib/project"
import { go, routes } from "@/lib/router"

/**
 * Money across every project: what's ready to invoice, what's waiting on payment, the payments still to come with a
 * phase, and what's been paid. Each row opens its project's Money tab, where the payment or invoice lives.
 */
export function MoneyPage() {
  const { projects } = useApp()
  const [m, setM] = React.useState<MoneyAll | null>(null)
  const load = React.useCallback(() => { api.money().then(setM).catch((e) => toast.error((e as Error).message)) }, [])
  React.useEffect(load, [load, projects])
  useTimeChanged(load)
  const sum = (t: string[]) => (t.length ? t.join(" + ") : "None")
  const late = (r: MoneyRow) => !!r.due && r.due < today()
  const paid = async (r: MoneyRow) => {
    try {
      if (r.source === "payment") await api.setPayment(r.projectId, r.key, { paid: true })
      else await api.setInvoice(r.projectId, r.invoiceId!, { paid: true })
      toast(`${r.number ? `Invoice ${r.number}` : r.label} marked paid`); load()
    } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <div className="flex h-full flex-col">
      <TopBar><span className="px-1.5 text-[14px]">Money</span><span className="flex-1" /><Button size="sm" variant="outline" nativeButton={false} render={<a href={invoicesCsvUrl({})} download />}><Download />Invoices CSV</Button></TopBar>
      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-10 pt-9 pb-14">
          <div>
            <h1 className="text-[30px] leading-tight font-medium">Money</h1>
            <p className="mt-1.5 text-[15px] text-foreground/80">{!m ? "" : m.toInvoice.length || m.waiting.length ? [m.toInvoice.length ? `${sum(m.totals.toInvoice)} is ready to invoice` : "", m.waiting.length ? `${sum(m.totals.waiting)} is waiting on payment` : ""].filter(Boolean).join(", and ") + "." : "Nothing to invoice and nothing waiting on payment."} <span className="text-muted-foreground">Groundwork makes the invoices; you send them and mark them paid.</span></p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card icon={<Receipt />} label="Ready to invoice" value={m ? sum(m.totals.toInvoice) : ""} sub={m ? `${m.toInvoice.length} ${m.toInvoice.length === 1 ? "payment" : "payments"}` : ""} />
            <Card icon={<Hourglass />} label="Waiting on payment" value={m ? sum(m.totals.waiting) : ""} sub={m ? <>{m.waiting.filter(late).length ? <span className="text-destructive">{m.waiting.filter(late).length} past due</span> : "None past due"}</> : ""} />
            <Card icon={<CalendarClock />} label="Coming up" value={m ? sum(m.totals.upcoming) : ""} sub="due with a sign-off still to come" />
            <Card icon={<CircleCheck />} label="Paid, last 30 days" value={m ? sum(m.totals.paid30) : ""} sub={m ? `${m.paid.filter((x) => x.at && Date.now() - x.at < 30 * 864e5).length} payments` : ""} />
          </div>
          {m && (
            <>
              <Section title="Ready to invoice" note="signed off, or the deposit" rows={m.toInvoice} empty="Nothing is ready to invoice.">
                {(r) => <Row r={r} what={r.why ? whyOf(r.why) : ""} right={<Button size="sm" variant="outline" onClick={() => makeInvoice({ projectId: r.projectId, kind: "milestone", phaseId: r.key })}><Receipt />Make the invoice</Button>} />}
              </Section>
              <Section title="Waiting on payment" note="invoiced, not paid yet" rows={m.waiting} empty="Nothing is waiting on payment.">
                {(r) => <Row r={r} what={<span className={cn(late(r) && "text-destructive")}>{r.at ? `Sent ${fmtDay(dayOf(r.at))}` : "Sent"}{r.due ? `, ${late(r) ? "was due" : "due"} ${fmtDay(r.due)}` : ""}</span>} right={<span className="flex gap-1.5">{r.invoiceId && <Button size="sm" variant="ghost" nativeButton={false} render={<a href={invoiceUrl(r.projectId, r.invoiceId)} download />}><Download />PDF</Button>}<Button size="sm" variant="outline" onClick={() => paid(r)}><Check />Mark paid</Button></span>} />}
              </Section>
              <Section title="Coming up" note="due with a sign-off" rows={m.upcoming} empty="No payments planned with a sign-off.">
                {(r) => <Row r={r} what={`With ${r.why || "a sign-off"}${r.due ? `, ${fmtDay(r.due)}` : ""}`} />}
              </Section>
              <Section title="Paid" note="most recent first" rows={m.paid.slice(0, 12)} empty="Nothing paid yet.">
                {(r) => <Row r={r} what={r.at ? `Paid ${fmtDay(dayOf(r.at))}` : "Paid"} />}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// "Designs approved, signed off 2026-10-01" reads better with the dates written out.
const whyOf = (why: string) => why.replace(/\d{4}-\d{2}-\d{2}/g, (d) => fmtDay(d))

function Card({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-xl border bg-card px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground [&_svg]:size-3.5">{icon}{label}</span>
      <span className="truncate text-[24px] leading-tight font-medium tabular">{value}</span>
      <span className="truncate text-[12.5px] text-muted-foreground">{sub}</span>
    </div>
  )
}

function Section({ title, note, rows, empty, children }: { title: string; note: string; rows: MoneyRow[]; empty: string; children: (r: MoneyRow) => React.ReactNode }) {
  return (
    <section className="grid">
      <div className="flex h-9 items-baseline gap-2 border-b"><h2 className="text-[14px] font-medium">{title}</h2><span className="text-[13px] text-muted-foreground tabular">{rows.length || ""}</span><span className="flex-1" /><span className="text-[12.5px] text-muted-foreground">{note}</span></div>
      {rows.length ? rows.map((r) => <React.Fragment key={r.projectId + r.key}>{children(r)}</React.Fragment>) : <p className="py-3 text-[13.5px] text-muted-foreground">{empty}</p>}
    </section>
  )
}

/** A payment or invoice: its project, what it is and when, the amount, and what to do next. */
function Row({ r, what, right }: { r: MoneyRow; what: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="grid min-h-[50px] grid-cols-[200px_minmax(0,1fr)_110px_minmax(0,auto)] items-center gap-4 border-b border-border/60 py-1.5 text-[13.5px]">
      <button onClick={() => go(routes.project(r.projectId, "money"))} className="flex min-w-0 items-center gap-2 text-left hover:underline">
        <SiteIcon runId={r.iconRun || undefined} name={r.projectName} color={r.color} className="size-5 shrink-0 rounded-[5px] text-[10px]" /><span className="truncate">{r.projectName}</span>
      </button>
      <span className="grid min-w-0"><span className="truncate">{whyOf(r.label)}{r.number ? <span className="text-muted-foreground">, {r.number}</span> : null}</span><span className="truncate text-[12.5px] text-muted-foreground">{what}</span></span>
      <span className="text-right tabular">{r.amount || <span className="text-muted-foreground">No amount</span>}</span>
      <span className="flex justify-end">{right}</span>
    </div>
  )
}
