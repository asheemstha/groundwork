import * as React from "react"
import { SiteIcon } from "@/components/common/bits"
import { useApp } from "@/hooks/useApp"
import { go, routes } from "@/lib/router"

const Sep = () => <span className="text-muted-foreground/60">/</span>

/**
 * Where a page sits in its project, Notion style: "Projects / Project" on the project's own pages, and
 * "Project / Site / Heading plan" deeper in. Every scan and plan belongs to a project, so they share this trail.
 */
export function Crumbs({ projectId, label, children }: { projectId: string | null; label?: React.ReactNode; children?: React.ReactNode }) {
  const { projects } = useApp()
  const p = projects.find((x) => x.id === projectId)
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
      {/* On a project's own pages the trail starts at Projects; deeper pages start at the project, to leave room. */}
      {(!p || !label) && <button onClick={() => go(routes.projects())} className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground">Projects</button>}
      {p && (
        <>
          {!label && <Sep />}
          <button onClick={() => go(routes.project(p.id))} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-muted/70">
            <SiteIcon runId={p.iconRun || undefined} name={p.name} className="size-[18px] rounded text-[9px]" /><span className="truncate">{p.name}</span>
          </button>
        </>
      )}
      {p && label && p.kind !== "audit" && <><Sep /><button onClick={() => go(routes.project(p.id, "site"))} className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground">Site</button></>}
      {label && <><Sep /><span className="shrink-0 px-1.5">{label}</span></>}
      {children}
    </div>
  )
}
