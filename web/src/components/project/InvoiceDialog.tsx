import * as React from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateField } from "@/components/common/DateField"
import { useApp } from "@/hooks/useApp"
import { timeChanged } from "@/hooks/useTimer"
import { api, fmtMoney, invoiceUrl, type InvoiceDraft } from "@/lib/api"
import { fmtDay, today } from "@/lib/project"
import { fmtMins } from "@/lib/time"
import { go, routes } from "@/lib/router"

interface Ask { projectId: string; kind: "milestone" | "hours"; phaseId?: string; from?: string; to?: string }
/** Opens the invoice dialog: for a phase's payment, or for billable hours (between two dates, or all not invoiced yet). */
export const makeInvoice = (a: Ask) => window.dispatchEvent(new CustomEvent<Ask>("gw:invoice", { detail: a }))

const monthOf = (d: string, n = 0) => { const [y, m] = d.split("-").map(Number); const a = new Date(y!, m! - 1 + n, 1), b = new Date(y!, m! + n, 0); const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; return { from: f(a), to: f(b) } }

/**
 * Makes an invoice: Groundwork fills it in (the payment, or one line per item or task for the hours), you look it over
 * and change anything, then it's saved and downloaded as a PDF. The time on it can't be invoiced twice.
 */
export function InvoiceDialog() {
  const { projects, prefs } = useApp()
  const [ask, setAsk] = React.useState<Ask | null>(null)
  const [d, setD] = React.useState<InvoiceDraft | null>(null)
  const [err, setErr] = React.useState("")
  const [rate, setRate] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const load = React.useCallback(async (a: Ask, r?: string) => {
    setErr("")
    try { const x = await api.invoiceDraft(a.projectId, { kind: a.kind, phase: a.phaseId, from: a.from, to: a.to, rate: r }); setD(x); if (x.rate != null) setRate(fmtMoney(x.rate, x.currency).replace(/\.00(?=\D*$)/, "")) } catch (e) { setD(null); setErr((e as Error).message) }
  }, [])
  React.useEffect(() => {
    const on = (e: Event) => { const a = (e as CustomEvent<Ask>).detail; setAsk(a); setD(null); setRate(""); setBusy(false); load(a) }
    window.addEventListener("gw:invoice", on)
    return () => window.removeEventListener("gw:invoice", on)
  }, [load])
  const p = ask ? projects.find((x) => x.id === ask.projectId) : null
  const close = () => setAsk(null)
  const range = (r: { from?: string; to?: string }) => { if (!ask) return; const a = { ...ask, ...r }; setAsk(a); load(a, rate) }
  const line = (i: number, patch: Partial<InvoiceDraft["lines"][number]>) => setD((x) => {
    if (!x) return x
    const lines = x.lines.map((l, j) => { if (j !== i) return l; const n = { ...l, ...patch }; if (("qty" in patch || "unit" in patch) && n.qty != null && n.unit != null) n.amount = Math.round(n.qty * n.unit * 100) / 100; return n })
    return { ...x, lines, total: Math.round(lines.reduce((s, l) => s + (+l.amount || 0), 0) * 100) / 100 }
  })
  const save = async () => {
    if (!ask || !d) return
    setBusy(true)
    try {
      const r = await api.saveInvoice(ask.projectId, d)
      const a = document.createElement("a"); a.href = invoiceUrl(ask.projectId, r.invoice.id); a.download = ""; a.click()
      toast.success(`Invoice ${r.invoice.number} saved`, { description: "Downloading the PDF. Mark it paid when the money arrives." })
      timeChanged(); close()
    } catch (e) { toast.error((e as Error).message); setBusy(false) }
  }
  const noPay = !prefs.payLink && !prefs.payDetails
  return (
    <Dialog open={!!ask} onOpenChange={(o) => !o && close()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[680px]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Invoice{p ? ` for ${p.name}` : ""}</DialogTitle>
          <DialogDescription>{ask?.kind === "hours" ? (d ? `Billable time not invoiced yet${d.from ? `, ${fmtDay(d.from)} to ${fmtDay(d.to)}` : ""}: ${fmtMins(d.mins)}.` : "Billable time not invoiced yet.") : "The payment due with this sign-off."} Check it, change anything, then save it as a PDF.</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin grid max-h-[64vh] gap-4 overflow-auto px-6 py-5">
          {ask?.kind === "hours" && (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <DateField boxed value={ask.from || d?.from} onChange={(v) => range({ from: v || undefined })} className="h-8 w-auto" />
              <span className="text-muted-foreground">to</span>
              <DateField boxed value={ask.to || d?.to} onChange={(v) => range({ to: v || undefined })} className="h-8 w-auto" />
              <Button size="sm" variant="ghost" onClick={() => range(monthOf(today()))}>This month</Button>
              <Button size="sm" variant="ghost" onClick={() => range(monthOf(today(), -1))}>Last month</Button>
              <Button size="sm" variant="ghost" onClick={() => range({ from: undefined, to: undefined })}>Everything</Button>
              <span className="flex-1" />
              <label className="flex items-center gap-2">Rate<Input value={rate} onChange={(e) => setRate(e.target.value)} onBlur={() => ask && load(ask, rate)} placeholder="$90" className="h-8 w-24 text-[13px]" /></label>
            </div>
          )}
          {err && <p className="rounded-lg bg-muted/60 px-4 py-3 text-[13.5px]">{err}{/rate/i.test(err) && <> <button onClick={() => { close(); go(routes.settings()) }} className="underline underline-offset-2">Set it in Settings</button></>}</p>}
          {!d && !err && <div className="grid h-24 place-items-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>}
          {d && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <label className="grid gap-1.5 text-[13px] font-medium">Number<Input value={d.number} onChange={(e) => setD({ ...d, number: e.target.value })} className="font-normal" /></label>
                <div className="grid gap-1.5 text-[13px] font-medium">Date<DateField boxed value={d.date} onChange={(v) => setD({ ...d, date: v || d.date })} /></div>
                <div className="grid gap-1.5 text-[13px] font-medium">Due<DateField boxed value={d.due} onChange={(v) => setD({ ...d, due: v || d.due })} /></div>
              </div>
              <label className="grid gap-1.5 text-[13px] font-medium">Bill to<Textarea value={d.billTo} onChange={(e) => setD({ ...d, billTo: e.target.value })} rows={2} placeholder="Client name, company and address" className="font-normal" /></label>
              <div className="grid">
                <div className="grid h-8 grid-cols-[minmax(0,1fr)_64px_84px_110px_28px] items-center gap-2 border-b text-[12.5px] text-muted-foreground"><span>{d.kind === "hours" ? "Work" : "Description"}</span><span className="text-right">{d.kind === "hours" ? "Hours" : ""}</span><span className="text-right">{d.kind === "hours" ? "Rate" : ""}</span><span className="text-right">Amount</span><span /></div>
                {d.lines.map((l, i) => (
                  <div key={i} className="grid min-h-11 grid-cols-[minmax(0,1fr)_64px_84px_110px_28px] items-center gap-2 border-b border-border/60 text-[13.5px]">
                    <input value={l.text} onChange={(e) => line(i, { text: e.target.value })} aria-label="Line" className="h-8 min-w-0 rounded-md bg-transparent px-1.5 outline-none hover:bg-muted/60 focus:bg-muted/60" />
                    {d.kind === "hours" ? <input type="number" step="0.01" min="0" value={l.qty ?? ""} onChange={(e) => line(i, { qty: +e.target.value || 0 })} aria-label="Hours" className="h-8 [appearance:textfield] rounded-md bg-transparent px-1.5 text-right tabular outline-none hover:bg-muted/60 focus:bg-muted/60" /> : <span />}
                    <span className="text-right text-muted-foreground tabular">{d.kind === "hours" && l.unit != null ? fmtMoney(l.unit, d.currency) : ""}</span>
                    <input type="number" step="0.01" min="0" value={l.amount} onChange={(e) => line(i, { amount: +e.target.value || 0 })} aria-label="Amount" className="h-8 [appearance:textfield] rounded-md bg-transparent px-1.5 text-right tabular outline-none hover:bg-muted/60 focus:bg-muted/60" />
                    <button onClick={() => setD({ ...d, lines: d.lines.filter((_, j) => j !== i), total: Math.round(d.lines.filter((_, j) => j !== i).reduce((s, x) => s + (+x.amount || 0), 0) * 100) / 100 })} aria-label="Remove the line" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={() => setD({ ...d, lines: [...d.lines, { text: "", amount: 0 }] })} className="inline-flex h-7 items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><Plus className="size-3.5" />Add a line</button>
                  <span className="flex-1" />
                  <span className="text-[13px] text-muted-foreground">Total</span><span className="text-[16px] font-medium tabular">{fmtMoney(d.total, d.currency)}</span>
                </div>
              </div>
              <label className="grid gap-1.5 text-[13px] font-medium"><span>Note <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Thank you!" className="font-normal" /></label>
            </>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 items-center rounded-b-xl border-t bg-muted/30 px-6 py-3.5">
          <span className="mr-auto text-[12.5px] text-muted-foreground">{noPay ? <>Add how clients pay you in <button onClick={() => { close(); go(routes.settings()) }} className="underline underline-offset-2 hover:text-foreground">Settings</button>, so it’s on the invoice.</> : "Your payment details from Settings go at the bottom."}</span>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={save} disabled={!d || busy}>{busy && <Loader2 className="animate-spin" />}Save and download PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
