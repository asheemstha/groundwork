import * as React from "react"

/** Every tool on the Site tab looks the same: name and what it costs, one status line, one main button. */
export function ToolCard({ title, cost, status, action, children }: { title: string; cost: string; status: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-xl border bg-card px-4 py-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2"><h2 className="text-[14px] font-medium">{title}</h2><span className="text-[12.5px] text-muted-foreground">{cost}</span></div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{status}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
