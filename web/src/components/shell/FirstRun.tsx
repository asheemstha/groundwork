import * as React from "react"
import { cn } from "cn"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useApp } from "@/hooks/useApp"
import { api } from "@/lib/api"
import { PLATFORMS, type PlatformId } from "@/lib/platforms"
import { go, routes } from "@/lib/router"
import { newProject } from "@/components/project/NewProjectDialog"
import { SERVICES } from "@/lib/services"

// The second step's choices, in plain words, with the checklist each one starts.
const WORK: { id: string; title: string; text: string; site: boolean }[] = [
  { id: "website-lean", title: "Redesigning a client’s site", text: "Keeps the old site’s URLs and search traffic, then checks the launch", site: true },
  { id: "website-new", title: "A new website", text: "For a business that doesn’t have a site yet", site: true },
  { id: "store", title: "An online store", text: "Payments, tax, shipping and test orders included", site: true },
  { id: "landing", title: "A landing page or campaign", text: "Short, with tracking checked before it goes live", site: true },
  { id: "care", title: "Looking after a live site", text: "Monthly checks and a care report for the client", site: true },
  { id: "migration", title: "An SEO site migration", text: "New domain or new platform, without losing rankings", site: true },
  { id: "seo-monthly", title: "Monthly SEO", text: "A month of SEO work, reported to the client", site: true },
  { id: "brand", title: "Brand identity", text: "Concepts, rounds of feedback and the final files", site: false },
  { id: "ads-setup", title: "Google Ads or Meta setup", text: "Accounts, tracking and the first campaigns", site: false },
  { id: "social-month", title: "A month of social content", text: "The plan, the posts and the client’s approvals", site: false },
]

/**
 * The first run, in two short steps: who runs the projects and what you do for clients, then what you're working on.
 * It ends in the new project's details, with the checklist and platform picked.
 */
export function FirstRun() {
  const { prefs, setPrefs, refreshProjects } = useApp()
  const [step, setStep] = React.useState<1 | 2>(prefs.who ? 2 : 1)
  const [who, setWho] = React.useState<"solo" | "studio">(prefs.who || "solo")
  const [services, setServices] = React.useState<string[]>(prefs.services?.length ? prefs.services : ["websites"])
  const [pick, setPick] = React.useState("")
  const [platform, setPlatform] = React.useState<PlatformId | "">("")
  const sample = async () => { try { const r = await api.createSample(); await refreshProjects(); go(routes.project(r.id)) } catch (e) { toast.error((e as Error).message) } }
  const toggle = (id: string) => setServices((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const next = async () => {
    // Weekly-update reminders start off for someone new; they're one switch away in Settings.
    const p = { who, services, weeklyUpdates: false }
    api.savePrefs(p).catch(() => {}); setPrefs(p); setStep(2)
  }
  const wanted = new Set(SERVICES.filter((s) => services.includes(s.id)).flatMap((s) => s.templates))
  const choices = WORK.filter((w) => wanted.has(w.id)).length ? WORK.filter((w) => wanted.has(w.id)) : WORK.slice(0, 4)
  const chosen = WORK.find((w) => w.id === pick)
  const start = () => { if (!pick) return; newProject({ template: pick, platform: platform || undefined }) }
  return (
    <div className="mx-auto grid w-full max-w-[680px] gap-7 py-6">
      {step === 1 ? (
        <>
          <div className="grid gap-2">
            <div className="text-[13px] text-muted-foreground">Welcome to Groundwork · 1 of 2</div>
            <h1 className="text-[30px] leading-tight font-medium">Who’s running the projects?</h1>
            <p className="text-[15px] leading-relaxed text-foreground/80">This sets the checklists you see first. Both can change later in Settings.</p>
          </div>
          <div role="radiogroup" aria-label="Who’s running the projects" className="grid gap-2.5 sm:grid-cols-2">
            {([["solo", "Just me", "A freelancer, or the one person running the projects. Your tasks, hours and money in one place."], ["studio", "A studio with a team", "Hours are kept per person, ready for a shared studio log later. For now each person uses Groundwork on their own Mac."]] as const).map(([k, title, text]) => (
              <button key={k} role="radio" aria-checked={who === k} onClick={() => setWho(k)} className={cn("grid grid-cols-[18px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl border bg-card p-4 text-left", who === k ? "border-foreground" : "hover:border-foreground/30")}>
                <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]", who === k ? "border-foreground" : "border-input")}>{who === k && <span className="size-2 rounded-full bg-foreground" />}</span>
                <span className="font-medium">{title}</span><span /><span className="text-[13px] leading-snug text-muted-foreground">{text}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            <div className="grid gap-0.5"><h2 className="text-[15px] font-medium">What do you do for clients?</h2><span className="text-[13px] text-muted-foreground">Pick all that fit. Each one puts its checklists first.</span></div>
            <div role="group" aria-label="What you do for clients" className="flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <button key={s.id} aria-pressed={services.includes(s.id)} onClick={() => toggle(s.id)} className={cn("flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 text-[13.5px]", services.includes(s.id) ? "border-foreground" : "text-foreground/80 hover:border-foreground/30")}>
                  {services.includes(s.id) && <Check className="size-3.5" />}{s.label}
                </button>
              ))}
            </div>
            <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">Websites and stores come with checks on the real site. Everything else gets a checklist, client requests, time and money.</p>
          </div>
          <div className="flex items-center gap-5">
            <Button onClick={next} disabled={!services.length}>Continue</Button>
            <button onClick={sample} className="text-[13.5px] underline underline-offset-2 hover:text-foreground">Explore a sample project first</button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <div className="text-[13px] text-muted-foreground">Welcome to Groundwork · 2 of 2</div>
            <h1 className="text-[30px] leading-tight font-medium">What are you working on?</h1>
            <p className="text-[15px] leading-relaxed text-foreground/80">Pick the closest. Groundwork sets up a checklist with dates, and on websites the checks that fit. You can change anything later.</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {choices.map((w) => (
              <button key={w.id} onClick={() => setPick(w.id)} aria-pressed={pick === w.id} className={cn("grid content-start gap-1 rounded-xl border bg-card p-4 text-left", pick === w.id ? "border-foreground" : "hover:border-foreground/30")}>
                <span className="font-medium">{w.title}</span><span className="text-[13px] leading-snug text-muted-foreground">{w.text}</span>
              </button>
            ))}
            <button onClick={() => newProject()} className="grid content-start gap-1 rounded-xl border border-dashed p-4 text-left hover:border-foreground/30">
              <span className="font-medium">Something else</span><span className="text-[13px] leading-snug text-muted-foreground">Pick from every checklist, or start with phases and add your own items</span>
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {chosen?.site && (
              <label className="grid flex-1 gap-1.5 text-[13px] font-medium">Built with
                <select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId | "")} className="h-9 rounded-lg border border-input bg-card px-2.5 text-[14px] font-normal">
                  <option value="">Not sure yet</option>
                  {PLATFORMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
            )}
            <Button onClick={start} disabled={!pick}>Continue</Button>
          </div>
          <div className="flex flex-wrap gap-5 border-t pt-3 text-[13.5px]">
            <button onClick={sample} className="underline underline-offset-2 hover:text-foreground">Explore a sample project first</button>
            <button onClick={() => newProject({ audit: true })} className="underline underline-offset-2 hover:text-foreground">Just check a site</button>
            <button onClick={() => go(routes.templates)} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">See every checklist</button>
            <button onClick={() => setStep(1)} className="ml-auto text-muted-foreground hover:text-foreground">Back</button>
          </div>
        </>
      )}
    </div>
  )
}
