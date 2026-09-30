import * as React from "react"
import { FileText, FolderKanban, Globe, Home, LayoutTemplate, Plus, Rocket, Search, Settings, Wrench, Users } from "lucide-react"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { SiteIcon } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { useApp } from "@/hooks/useApp"
import { api, type TemplateSummary } from "@/lib/api"
import { go, routes } from "@/lib/router"

/** Open quick find from anywhere (⌘K). */
export const openQuickFind = () => window.dispatchEvent(new CustomEvent("gw:quick-find"))

/** Quick find: jump to any project, site or template, or run a common action, by typing. */
export function QuickFind() {
  const { projects, runs, siteLabel } = useApp()
  const [open, setOpen] = React.useState(false)
  const [templates, setTemplates] = React.useState<TemplateSummary[]>([])
  React.useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener("gw:quick-find", on)
    return () => window.removeEventListener("gw:quick-find", on)
  }, [])
  React.useEffect(() => { if (open) api.templates().then(setTemplates).catch(() => {}) }, [open])
  const run = (f: () => void) => { setOpen(false); f() }
  const projectHosts = new Set(projects.map((p) => p.host).filter(Boolean))
  const sites = [...new Map(runs.filter((r) => !projectHosts.has(r.host)).map((r) => [r.host, r])).values()]
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Quick find" description="Jump to a project, site or template" className="sm:max-w-[640px]">
      <CommandInput placeholder="Search projects, sites, templates, actions…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Go to">
          <CommandItem value="home" onSelect={() => run(() => go(routes.home))}><Home />Home</CommandItem>
          <CommandItem value="templates" onSelect={() => run(() => go(routes.templates))}><LayoutTemplate />Templates</CommandItem>
          <CommandItem value="settings engines skills" onSelect={() => run(() => go(routes.settings()))}><Settings />Settings<CommandShortcut>⌘,</CommandShortcut></CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem value="new project" onSelect={() => run(() => newProject())}><Plus />New project<CommandShortcut>⌘N</CommandShortcut></CommandItem>
          <CommandItem value="scan a site" onSelect={() => run(() => go(routes.scan))}><Search />Scan a site</CommandItem>
        </CommandGroup>
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <React.Fragment key={p.id}>
                <CommandItem value={`${p.name} ${p.host || ""} checklist`} onSelect={() => run(() => go(routes.project(p.id)))}><SiteIcon runId={p.iconRun || undefined} name={p.name} className="size-4 rounded text-[8px]" />{p.name}<span className="text-muted-foreground">{p.current ? `${p.current.name}, ${p.current.done} of ${p.current.total}` : ""}</span></CommandItem>
                <CommandItem value={`${p.name} client waiting`} onSelect={() => run(() => go(routes.project(p.id, "client")))}><Users /><span className="text-muted-foreground">{p.name} /</span> Client</CommandItem>
                <CommandItem value={`${p.name} tools`} onSelect={() => run(() => go(routes.project(p.id, "tools")))}><Wrench /><span className="text-muted-foreground">{p.name} /</span> Tools</CommandItem>
                <CommandItem value={`${p.name} launch check report`} onSelect={() => run(() => go(routes.launch(p.id)))}><Rocket /><span className="text-muted-foreground">{p.name} /</span> Launch check</CommandItem>
              </React.Fragment>
            ))}
          </CommandGroup>
        )}
        {sites.length > 0 && (
          <CommandGroup heading="Other sites">
            {sites.map((r) => <CommandItem key={r.host} value={`${siteLabel(r.host)} ${r.host}`} onSelect={() => run(() => go(r.status === "done" || r.status === "partial" ? routes.review(r.id) : routes.run(r.id)))}><Globe />{siteLabel(r.host)}<span className="text-muted-foreground">{r.host}</span></CommandItem>)}
          </CommandGroup>
        )}
        {templates.length > 0 && (
          <CommandGroup heading="Templates">
            {templates.map((t) => <CommandItem key={t.id} value={`template ${t.name}`} onSelect={() => run(() => go(routes.template(t.id)))}>{t.kind === "checklist" ? <FolderKanban /> : <FileText />}{t.name}<span className="text-muted-foreground">{t.kind === "checklist" ? "checklist" : t.kind}</span></CommandItem>)}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
