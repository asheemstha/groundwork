import * as React from "react"
import { SiteIcon } from "@/components/common/bits"
import { useApp } from "@/hooks/useApp"
import { go, routes } from "@/lib/router"

const Sep = () => <span className="text-muted-foreground/60">/</span>

/**
 * Where a page sits in its project, Notion style: Projects / Project / Tools / Heading plan. Every scan and plan
 * belongs to a project, so the tool pages share this breadcrumb with the project's own pages.
 */
export function Crumbs({ projectId, label, children }: { projectId: string | null; label?: React.ReactNode; children?: React.ReactNode }) {
  const { projects } = useApp()
  const p = projects.find((x) => x.id === projectId)
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
      <button onClick={() => go(routes.home)} className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground">Projects</button>
      {p && (
        <>
          <Sep />
          <button onClick={() => go(routes.project(p.id))} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-muted/70">
            <SiteIcon runId={p.iconRun || undefined} name={p.name} className="size-[18px] rounded text-[9px]" /><span className="truncate">{p.name}</span>
          </button>
        </>
      )}
      {p && label && p.kind !== "audit" && <><Sep /><button onClick={() => go(routes.project(p.id, "tools"))} className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground">Tools</button></>}
      {label && <><Sep /><span className="shrink-0 px-1.5">{label}</span></>}
      {children}
    </div>
  )
}
