import { cn } from "cn"
import { Check, Download, MoreHorizontal, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { timeChanged } from "@/hooks/useTimer"
import { api, fmtMoney, invoiceUrl, type Project } from "@/lib/api"
import { dayOf, fmtDay, today } from "@/lib/project"

/** A project's invoices: for payments and for hours, with when they're due or were paid. */
export function Invoices({ p, onChange }: { p: Project; onChange: (x: Project) => void }) {
  if (!p.invoices.length) return null
  const act = async (f: () => Promise<Project>, msg?: string) => { try { onChange(await f()); timeChanged(); if (msg) toast(msg) } catch (e) { toast.error((e as Error).message) } }
  return (
    <section aria-label="Invoices" className="grid">
      <div className="flex h-9 items-baseline gap-2 border-b"><h2 className="flex-1 text-[14px] font-medium">Invoices</h2><span className="text-[13px] text-muted-foreground">{p.invoices.filter((x) => !x.paid).length} waiting on payment</span></div>
      {p.invoices.map((x) => {
        const late = !x.paid && !!x.due && x.due < today()
        const what = x.kind === "hours" ? `${x.hours ? `${x.hours} hours` : "Hours"}${x.from ? `, ${fmtDay(x.from)} to ${fmtDay(x.to)}` : ""}` : x.kind === "extra" ? `Extra: ${p.extras.find((e) => e.id === x.extraId)?.title || "request"}` : x.phaseId === "deposit" ? p.deposit?.label || "Deposit" : p.phases.find((ph) => ph.id === x.phaseId)?.payment?.label || "Payment"
        return (
          <div key={x.id} className="group grid min-h-[46px] grid-cols-[110px_minmax(0,1fr)_140px_110px_28px] items-center gap-3 border-b border-border/60 text-[13.5px]">
            <a href={invoiceUrl(p.id, x.id)} download className="tabular hover:underline">{x.number}</a>
            <span className="truncate text-muted-foreground">{what}</span>
            <span className={cn("text-right text-[13px]", late ? "text-destructive" : "text-muted-foreground")}>{x.paid ? `Paid ${fmtDay(dayOf(x.paid))}` : late ? `Was due ${fmtDay(x.due)}` : x.due ? `Due ${fmtDay(x.due)}` : "Not paid yet"}</span>
            <span className="text-right tabular">{fmtMoney(x.total, x.currency)}</span>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Invoice options" className="opacity-60 group-hover:opacity-100" />}><MoreHorizontal /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem render={<a href={invoiceUrl(p.id, x.id)} download />}><Download />Download the PDF</DropdownMenuItem>
                {x.paid ? <DropdownMenuItem onClick={() => act(() => api.setInvoice(p.id, x.id, { paid: false }))}><Undo2 />Not paid after all</DropdownMenuItem> : <DropdownMenuItem onClick={() => act(() => api.setInvoice(p.id, x.id, { paid: true }), `Invoice ${x.number} marked paid`)}><Check />Mark paid</DropdownMenuItem>}
                {!x.paid && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => act(() => api.removeInvoice(p.id, x.id), x.kind !== "milestone" ? "Removed the invoice. Its hours can be invoiced again." : "Removed the invoice. The payment is ready to invoice again.")}><Trash2 />Remove the invoice</DropdownMenuItem></>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}
    </section>
  )
}

