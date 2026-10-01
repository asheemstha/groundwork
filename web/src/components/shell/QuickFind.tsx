import * as React from "react"
import { FileText, FolderKanban, LayoutTemplate, Plus, Rocket, Search, Settings, Sun, Timer, Wrench, Users } from "lucide-react"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { SiteIcon } from "@/components/common/bits"
import { newProject } from "@/components/project/NewProjectDialog"
import { useApp } from "@/hooks/useApp"
import { api, type TemplateSummary } from "@/lib/api"
import { go, routes } from "@/lib/router"

/** Open quick find from anywhere (⌘K). */
export const openQuickFind = () => window.dispatchEvent(new CustomEvent("gw:quick-find"))

/** Quick find: jump to any project or template, or run a common action, by typing. */
export function QuickFind() {
  const { projects } = useApp()
  const [open, setOpen] = React.useState(false)
  const [templates, setTemplates] = React.useState<TemplateSummary[]>([])
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof api.items>>>([])
  const [q, setQ] = React.useState("")
  React.useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener("gw:quick-find", on)
    return () => window.removeEventListener("gw:quick-find", on)
  }, [])
  React.useEffect(() => { if (open) { setQ(""); api.templates().then(setTemplates).catch(() => {}); api.items().then(setItems).catch(() => {}) } }, [open])
  // Items only show once you type, so the list starts with places to go.
  const found = q.trim().length > 1 ? items.filter((x) => x.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30) : []
  const run = (f: () => void) => { setOpen(false); f() }
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Quick find" description="Jump to a project or template" className="sm:max-w-[640px]">
      {/* The dialog is only the frame; cmdk's parts need their own Command around them. */}
      <Command>
      <CommandInput value={q} onValueChange={setQ} placeholder="Search projects, checklist items, templates, actions…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Go to">
          <CommandItem value="today home" onSelect={() => run(() => go(routes.home))}><Sun />Today</CommandItem>
          <CommandItem value="time log timer hours" onSelect={() => run(() => go(routes.time()))}><Timer />Time</CommandItem>
          <CommandItem value="templates" onSelect={() => run(() => go(routes.templates))}><LayoutTemplate />Templates</CommandItem>
          <CommandItem value="settings engines skills" onSelect={() => run(() => go(routes.settings()))}><Settings />Settings<CommandShortcut>⌘,</CommandShortcut></CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem value="new project" onSelect={() => run(() => newProject())}><Plus />New project<CommandShortcut>⌘N</CommandShortcut></CommandItem>
          <CommandItem value="check a site audit scan" onSelect={() => run(() => newProject({ audit: true }))}><Search />Check a site</CommandItem>
        </CommandGroup>
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <React.Fragment key={p.id}>
                <CommandItem value={`${p.name} ${p.host || ""} checklist`} onSelect={() => run(() => go(routes.project(p.id)))}><SiteIcon runId={p.iconRun || undefined} name={p.name} className="size-4 rounded text-[8px]" />{p.name}<span className="text-muted-foreground">{p.kind === "audit" ? "Audit" : p.current ? `${p.current.name}, ${p.current.done} of ${p.current.total}` : ""}</span></CommandItem>
                {p.kind !== "audit" && <>
                <CommandItem value={`${p.name} client waiting`} onSelect={() => run(() => go(routes.project(p.id, "client")))}><Users /><span className="text-muted-foreground">{p.name} /</span> Client</CommandItem>
                {p.website !== false && <CommandItem value={`${p.name} site tools`} onSelect={() => run(() => go(routes.project(p.id, "site")))}><Wrench /><span className="text-muted-foreground">{p.name} /</span> Site</CommandItem>}
                {p.website !== false && <CommandItem value={`${p.name} launch check report`} onSelect={() => run(() => go(routes.launch(p.id)))}><Rocket /><span className="text-muted-foreground">{p.name} /</span> Launch check</CommandItem>}
                <CommandItem value={`${p.name} time hours log`} onSelect={() => run(() => go(routes.time(p.id)))}><Timer /><span className="text-muted-foreground">{p.name} /</span> Time</CommandItem>
                </>}
              </React.Fragment>
            ))}
          </CommandGroup>
        )}
        {found.length > 0 && (
          <CommandGroup heading="Checklist items">
            {found.map((x) => <CommandItem key={x.projectId + x.id} value={`item ${x.title} ${x.projectName} ${x.projectId}${x.id}`} onSelect={() => run(() => go(routes.item(x.projectId, x.id)))}><span className={x.status === "todo" ? "" : "text-muted-foreground line-through decoration-muted-foreground/40"}>{x.title}</span><span className="ml-auto shrink-0 text-muted-foreground">{x.projectName} · {x.phaseName}</span></CommandItem>)}
          </CommandGroup>
        )}
        {templates.length > 0 && (
          <CommandGroup heading="Templates">
            {templates.map((t) => <CommandItem key={t.id} value={`template ${t.name}`} onSelect={() => run(() => go(routes.template(t.id)))}>{t.kind === "checklist" ? <FolderKanban /> : <FileText />}{t.name}<span className="text-muted-foreground">{t.kind === "checklist" ? "checklist" : t.kind}</span></CommandItem>)}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
