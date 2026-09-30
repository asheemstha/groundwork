import * as React from "react"
import { cn } from "cn"
import { Layers } from "lucide-react"
import type { Row, RunSummary } from "@/lib/api"
import { isH } from "@/lib/checks"

/** Brand mark: a solid accent square. No gradients. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-6 place-items-center rounded-md bg-brand text-brand-foreground", className)}>
      <Layers className="size-3.5" strokeWidth={2.2} />
    </span>
  )
}

export function Dot({ tone = "muted", pulse, className }: { tone?: "muted" | "brand" | "ink" | "bad"; pulse?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        tone === "brand" && "bg-brand",
        tone === "ink" && "bg-strong",
        tone === "bad" && "bg-destructive",
        tone === "muted" && "bg-muted-foreground/50",
        pulse && "animate-pulse",
        className
      )}
    />
  )
}

/** Small circular progress, filled black when complete. */
export function Ring({ done, total, size = 16 }: { done: number; total: number; size?: number }) {
  if (!total)
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 text-input">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    )
  if (done >= total)
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
        <circle cx="8" cy="8" r="7.5" className="fill-done" />
        <path d="m5 8.2 2 2 4-4" className="stroke-background" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  const c = 2 * Math.PI * 6
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
      <circle cx="8" cy="8" r="6" fill="none" className="stroke-input" strokeWidth="2.2" />
      <circle cx="8" cy="8" r="6" fill="none" className="stroke-brand" strokeWidth="2.2" strokeDasharray={`${(c * done) / total} ${c}`} transform="rotate(-90 8 8)" strokeLinecap="round" />
    </svg>
  )
}

/** Usage bars (1–max), like a signal meter. */
export function Meter({ value, max = 4, className }: { value: number; max?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-[2px]", className)} aria-label={`Usage ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={cn("block w-[3px] rounded-[1px]", i < value ? "bg-strong" : "bg-input")} style={{ height: 5 + i * 2 }} />
      ))}
    </span>
  )
}

export function Bar({ value, className, tone = "ink" }: { value: number; className?: string; tone?: "ink" | "brand" }) {
  return (
    <span className={cn("block h-1 w-full overflow-hidden rounded-full bg-muted", className)}>
      <i className={cn("block h-full rounded-full transition-[width] duration-700", tone === "brand" ? "bg-brand" : "bg-strong")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  )
}

/** Small mono label in a thin pill. */
export function Tag({ children, className, tone }: { children: React.ReactNode; className?: string; tone?: "brand" | "solid" | "muted" }) {
  return (
    <span
      className={cn(
        "tag-label",
        tone === "brand" && "border-brand/40 text-brand-ink",
        tone === "solid" && "border-transparent bg-muted text-foreground",
        tone === "muted" && "border-border text-muted-foreground",
        !tone && "border-input text-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}

/** Heading level chip: H2, H3… or "text". */
export function HTag({ tag, to }: { tag?: string; to?: boolean }) {
  const h = isH(tag)
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-7 items-center justify-center rounded-[5px] border px-1 tabular text-[11px] font-medium",
        to ? "border-transparent bg-muted text-foreground" : "border-input text-muted-foreground",
        !h && !to && "font-normal lowercase"
      )}
    >
      {h ? tag : tag === "—" || !tag ? "text" : tag}
    </span>
  )
}

export const ACT: Record<NonNullable<Row["act"]>, { label: string; cls: string }> = {
  retag: { label: "Re-tag", cls: "bg-muted text-foreground" },
  tag: { label: "Make heading", cls: "bg-muted text-foreground" },
  rewrite: { label: "Rewrite", cls: "bg-brand/10 text-brand-ink" },
  add: { label: "Add heading", cls: "bg-brand/10 text-brand-ink" },
  remove: { label: "Remove", cls: "border border-destructive text-destructive" },
  keep: { label: "Keep", cls: "border border-input text-muted-foreground" },
  none: { label: "Not a heading", cls: "border border-input text-muted-foreground" },
}
export function ActBadge({ act }: { act: NonNullable<Row["act"]> }) {
  const a = ACT[act]
  return <span className={cn("inline-flex h-5 items-center rounded-[5px] px-1.5 text-[11px] font-medium whitespace-nowrap", a.cls)}>{a.label}</span>
}

export function Favicon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border bg-card tabular text-[11px] font-medium uppercase", className)}>{(name || "?")[0]}</span>
}

export function TopBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("app-drag app-topbar flex h-12 shrink-0 items-center gap-2 border-b px-4", className)}>{children}</div>
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-input border-t-brand", className)} />
}

export function runLabel(r: Pick<RunSummary, "status" | "percent" | "progress" | "pages"> & { seo?: RunSummary["seo"] }) {
  const m = r.progress && (r.progress.all || r.progress.live || r.progress.optimize)
  if (r.seo?.status === "running" && r.status !== "scanning" && r.status !== "running") return { title: "SEO plan", sub: `${r.seo.percent || 0}%`, tone: "brand" as const, busy: true }
  // A site with only an SEO plan shows that plan's progress.
  if (r.status === "scanned" && r.seo && (r.seo.status === "done" || r.seo.status === "partial") && r.seo.progress) return { title: "SEO plan", sub: `${r.seo.progress.done}/${r.seo.progress.tasks}`, tone: "ink" as const, done: r.seo.progress.done, total: r.seo.progress.tasks }
  switch (r.status) {
    case "scanning": return { title: "Scanning", sub: `${r.percent || 0}%`, tone: "brand" as const, busy: true }
    case "scan_failed": return { title: "Scan failed", sub: "Try again", tone: "bad" as const }
    case "scanned": return { title: "Scan", sub: "Ready to plan", tone: "muted" as const }
    case "running": return { title: "Planning", sub: `${r.percent || 0}%`, tone: "brand" as const, busy: true }
    case "failed": return { title: "Plan failed", sub: "", tone: "bad" as const }
    case "cancelled": return { title: "Plan stopped", sub: "", tone: "muted" as const }
    default: return { title: "Heading plan", sub: m ? `${m.done}/${m.tasks}` : "", tone: "ink" as const, done: m?.done ?? 0, total: m?.tasks ?? 0 }
  }
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-b-2 px-1 tabular text-[10.5px] text-muted-foreground">{children}</kbd>
}

/** The site's own favicon, falling back to its first letter. */
export function SiteIcon({ runId, name, className }: { runId?: string; name: string; className?: string }) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [runId])
  if (!runId || failed) return <Favicon name={name} className={className} />
  return (
    <span className={cn("grid size-6 shrink-0 place-items-center overflow-hidden rounded-md", className)}>
      <img src={`/api/runs/${runId}/favicon`} alt="" className="size-full object-contain" onError={() => setFailed(true)} />
    </span>
  )
}

