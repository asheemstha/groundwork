import * as React from "react"
import { cn } from "cn"
import { ChevronDown, Copy, LayoutTemplate, ListChecks, Mail, MessageSquare, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TopBar } from "@/components/common/bits"
import { api, type Template, type TemplateSummary } from "@/lib/api"
import { go, routes } from "@/lib/router"

const KINDS = [
  { kind: "checklist", label: "Project checklists", hint: "phases, items and who does them", icon: ListChecks, add: "New checklist" },
  { kind: "message", label: "Messages", hint: "short notes for email or Slack, filled in from the project", icon: MessageSquare, add: "New message" },
  { kind: "email", label: "Emails", hint: "longer notes with a subject line", icon: Mail, add: "New email" },
] as const

export async function createTemplate(kind: Template["kind"], copyFrom?: string) {
  try { const t = await api.createTemplate({ kind, copyFrom }); go(routes.template(t.id)) } catch (e) { toast.error((e as Error).message) }
}

/** Templates: checklists to start projects from, and messages and emails to send clients. */
export function TemplatesPage() {
  const [list, setList] = React.useState<TemplateSummary[] | null>(null)
  const [show, setShow] = React.useState<"all" | Template["kind"]>("all")
  const load = () => api.templates().then(setList).catch(() => {})
  React.useEffect(() => { load() }, [])
  const count = (k: Template["kind"]) => list?.filter((t) => t.kind === k).length ?? 0
  const remove = async (t: TemplateSummary) => {
    if (t.kind === "checklist" && t.used) return toast.error(`${t.used} ${t.used === 1 ? "project uses" : "projects use"} this checklist. Projects keep their own copy, so you can duplicate it and change the copy instead.`)
    await api.removeTemplate(t.id); load(); toast(`Deleted ${t.name}`)
  }
  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="text-sm font-medium">Templates</span><span className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" />}><Plus />New template<ChevronDown className="opacity-70" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">{KINDS.map((k) => <DropdownMenuItem key={k.kind} onClick={() => createTemplate(k.kind)}><k.icon />{k.add.replace("New ", "")}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </TopBar>
      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Template types" className="flex flex-col gap-px border-r px-3 py-5">
          <TypeLink on={show === "all"} onClick={() => setShow("all")} icon={LayoutTemplate} label="All" n={list?.length ?? 0} />
          {KINDS.map((k) => <TypeLink key={k.kind} on={show === k.kind} onClick={() => setShow(k.kind)} icon={k.icon} label={k.label} n={count(k.kind)} />)}
        </nav>
        <div className="scrollbar-thin min-w-0 overflow-auto px-8 py-7">
          <h1 className="text-[22px] font-medium">Templates</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Checklists you start projects from, and the messages and emails you send to clients.</p>
          {KINDS.filter((k) => show === "all" || show === k.kind).map((k) => (
            <section key={k.kind} className="mt-6 grid gap-2.5">
              <div className="flex items-baseline gap-2"><h2 className="text-sm font-medium">{k.label}</h2><span className="text-[12.5px] text-muted-foreground">{k.hint}</span></div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {list?.filter((t) => t.kind === k.kind).map((t) => (
                  <div key={t.id} className="group relative">
                    <button onClick={() => go(routes.template(t.id))} className="flex h-[124px] w-full flex-col gap-1.5 rounded-xl border bg-card p-3.5 text-left hover:border-input">
                      {t.kind === "checklist" ? (
                        <>
                          <span className="mb-1 grid size-7 place-items-center rounded-md bg-muted text-foreground/70"><ListChecks className="size-[15px]" /></span>
                          <span className="truncate font-medium">{t.name}</span>
                          <span className="text-[12.5px] text-muted-foreground">{t.items} items in {t.phases} phases</span>
                          <span className={cn("text-[12.5px]", t.used ? "text-muted-foreground" : "text-muted-foreground/60")}>{t.used ? `Used by ${t.used} ${t.used === 1 ? "project" : "projects"}` : "Not used yet"}</span>
                        </>
                      ) : (
                        <>
                          <span className="truncate pr-6 font-medium">{t.name}</span>
                          <span className="line-clamp-2 text-[12.5px] leading-normal text-muted-foreground">{t.kind === "email" ? `Subject: ${t.subject}` : t.preview}</span>
                          <span className="mt-auto text-xs text-muted-foreground/70">{t.use?.includes("client-request") ? "Used on the Client tab" : "Pick it on the Client tab"}</span>
                        </>
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<button className="absolute top-2.5 right-2.5 hidden size-6 place-items-center rounded-md text-muted-foreground group-hover:grid hover:bg-muted data-[popup-open]:grid" aria-label={`${t.name} options`} />}><MoreHorizontal className="size-3.5" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => createTemplate(t.kind, t.id)}><Copy /> Duplicate</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => remove(t)}><Trash2 /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                <button onClick={() => createTemplate(k.kind)} className="flex h-[124px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-muted-foreground hover:bg-muted/30"><Plus className="size-4" />{k.add}</button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function TypeLink({ on, onClick, icon: Icon, label, n }: { on: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; n: number }) {
  return (
    <button onClick={onClick} className={cn("grid h-8 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-2 text-left text-[13.5px] hover:bg-muted/60", on && "bg-muted font-medium")}>
      <Icon className="size-4 text-foreground/70" /><span>{label}</span><span className="text-xs font-normal text-muted-foreground tabular">{n}</span>
    </button>
  )
}
